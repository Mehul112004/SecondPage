import type { Quote } from '../market'
export type Contract = { instrument_key: string; trading_symbol: string; expiry: string; strike_price: number; instrument_type: 'CE' | 'PE'; lot_size: number; tick_size: number; freeze_quantity: number }
type RawQuote = { instrument_token: string; symbol: string; last_price: number; timestamp: string; last_trade_time: string; depth?: { buy?: { price: number; quantity: number }[]; sell?: { price: number; quantity: number }[] } }
export class ProviderError extends Error {}
// Ephemeral cache only; never written to the database or Next.js persistent data cache.
const cache = new Map<string, { expires: number; value: unknown }>()
const pending = new Map<string, Promise<unknown>>()
export function clearProviderCache() { cache.clear(); pending.clear() }
async function request<T>(path: string, params: Record<string,string> = {}, ttl = 0): Promise<T> {
  const token = process.env.UPSTOX_ANALYTICS_TOKEN
  if (!token) throw new ProviderError('Upstox token is not configured on the server.')
  const url = new URL(`https://api.upstox.com/v2/${path}`)
  url.search = new URLSearchParams(params).toString()
  const key = url.toString()
  const hit = cache.get(key)
  if (hit && hit.expires > Date.now()) return hit.value as T
  if (pending.has(key)) return pending.get(key) as Promise<T>
  const operation = (async () => {
    let response: Response
    try { response = await fetch(url, { cache: 'no-store', headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' }, signal: AbortSignal.timeout(10000) }) }
    catch { throw new ProviderError('Upstox could not be reached. Trading is paused; try again shortly.') }
    if (!response.ok) {
      if ([401,403].includes(response.status)) throw new ProviderError('Upstox access was rejected. Check or renew the server token.')
      if (response.status === 429) throw new ProviderError('Upstox rate limit reached. Wait before retrying.')
      throw new ProviderError('Upstox market data is unavailable. Trading is paused.')
    }
    let body
    try { body = await response.json() } catch { throw new ProviderError('Upstox returned an invalid response.') }
    if (body.status !== 'success' || body.data == null) throw new ProviderError('Upstox returned no usable market data.')
    if (ttl) {
      if (cache.size > 100) cache.clear()
      cache.set(key, { expires: Date.now() + ttl, value: body.data })
    }
    return body.data as T
  })()
  pending.set(key, operation)
  try { return await operation } finally { pending.delete(key) }
}
export async function contracts(): Promise<Contract[]> {
  const rows = await request<Contract[]>('option/contract', { instrument_key: 'NSE_INDEX|Nifty 50' }, 300000)
  if (!Array.isArray(rows)) throw new ProviderError('Upstox contract catalogue is unavailable.')
  return rows.filter(c => /^NSE_FO\|\d+$/.test(c.instrument_key) && ['CE','PE'].includes(c.instrument_type) && Number.isInteger(c.lot_size) && c.lot_size > 0)
}
export async function marketStatus() {
  return (await request<{status:string}>('market/status/NSE', {}, 3000)).status
}
export function normalizeQuote(contract: Contract, raw: RawQuote, receivedAt = Date.now()): Quote {
  const bid = raw.depth?.buy?.[0]
  const ask = raw.depth?.sell?.[0]
  return { id: contract.instrument_key, symbol: contract.trading_symbol, expiry: contract.expiry, strike: contract.strike_price, type: contract.instrument_type, lotSize: contract.lot_size,
    bid: Number(bid?.price) || 0, ask: Number(ask?.price) || 0, bidQty: Number(bid?.quantity) || 0, askQty: Number(ask?.quantity) || 0,
    ltp: Number(raw.last_price) || 0, timestamp: Date.parse(raw.timestamp), lastTradeAt: Number(raw.last_trade_time), receivedAt, source: 'upstox', freezeQuantity: contract.freeze_quantity }
}
export async function quotesFor(selected: Contract[], fresh = false): Promise<Quote[]> {
  const unique = [...new Map(selected.map(c => [c.instrument_key,c])).values()]
  const result: Quote[] = []
  for (let index=0; index<unique.length; index+=100) {
    const batch = unique.slice(index,index+100)
    const rows = await request<Record<string,RawQuote>>('market-quote/quotes', { instrument_key: batch.map(c=>c.instrument_key).join(',') }, fresh ? 0 : 2000)
    const byKey = new Map(Object.values(rows).map(row => [row.instrument_token,row]))
    for (const contract of batch) {
      const raw = byKey.get(contract.instrument_key)
      if (raw) result.push(normalizeQuote(contract,raw))
    }
  }
  return result
}
export async function chainSnapshot(expiry: string | null, openKeys: string[]) {
  const catalogue = await contracts()
  const expiries = [...new Set(catalogue.map(c=>c.expiry))].sort()
  const selectedExpiry = expiry || expiries[0]
  if (!expiries.includes(selectedExpiry)) throw new ProviderError('This expiry is unavailable. Choose a listed expiry.')
  const chain = await request<{strike_price:number; underlying_spot_price:number}[]>('option/chain', { instrument_key: 'NSE_INDEX|Nifty 50', expiry_date: selectedExpiry }, 2000)
  if (!Array.isArray(chain) || !chain.length) throw new ProviderError('Upstox returned an empty option chain.')
  const spot = chain.find(row=>Number.isFinite(row.underlying_spot_price))?.underlying_spot_price
  if (!Number.isFinite(spot)) throw new ProviderError('NIFTY spot price is unavailable.')
  const strikes = [...new Set(chain.map(row=>row.strike_price))].sort((a,b)=>Math.abs(a-spot!)-Math.abs(b-spot!)).slice(0,21).sort((a,b)=>a-b)
  const displayed = catalogue.filter(c=>c.expiry===selectedExpiry && strikes.includes(c.strike_price))
  const selected = [...displayed, ...catalogue.filter(c=>openKeys.includes(c.instrument_key))]
  const [quotes, status] = await Promise.all([quotesFor(selected),marketStatus()])
  return { quotes, status, source: 'upstox', spot, expiry: selectedExpiry, expiries, strikes, checkedAt: Date.now(), unavailablePositions: openKeys.filter(key=>!quotes.some(q=>q.id===key)) }
}
