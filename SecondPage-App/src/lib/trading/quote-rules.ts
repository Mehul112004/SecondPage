import type { Quote } from '../market'
export function normalOptionSession(now: number) {
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone:'Asia/Kolkata', weekday:'short', hour:'2-digit', minute:'2-digit', hourCycle:'h23' }).formatToParts(new Date(now))
  const get=(type:string)=>parts.find(p=>p.type===type)?.value || ''
  const minute=Number(get('hour'))*60+Number(get('minute'))
  return !['Sat','Sun'].includes(get('weekday')) && minute>=555 && minute<930
}
export function executableQuote(quote: Quote, status: string, side: 'BUY'|'SELL', now = Date.now()) {
  if (status !== 'NORMAL_OPEN' || !normalOptionSession(now)) return 'Market is closed or not in a normal trading session.'
  const times = [quote.timestamp, quote.lastTradeAt, quote.receivedAt]
  if (times.some(t=>!Number.isFinite(t) || t! > now+5000) || now-quote.timestamp>15000 || now-quote.receivedAt!>15000 || now-quote.lastTradeAt!>60000) return 'Quote is stale or has no recent trade. Wait for a fresh quote.'
  if (!(quote.bid > 0 && quote.ask > 0 && quote.bid <= quote.ask)) return 'No valid two-sided market for this contract.'
  if ((side==='BUY' ? quote.askQty : quote.bidQty)! <= 0 || !Number.isFinite(side==='BUY' ? quote.askQty : quote.bidQty)) return 'No executable quantity is available.'
  return null
}
