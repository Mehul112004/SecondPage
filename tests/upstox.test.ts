import { test } from 'node:test'
import assert from 'node:assert/strict'
import { contracts, quotesFor, chainSnapshot, clearProviderCache, normalizeQuote, type Contract } from '../src/lib/providers/upstox.ts'
import { executableQuote, normalOptionSession } from '../src/lib/trading/quote-rules.ts'
const now=Date.parse('2026-11-02T05:00:00Z')
const c:Contract={instrument_key:'NSE_FO|100',trading_symbol:'NIFTY 23500 CE',expiry:'2026-11-03',strike_price:23500,instrument_type:'CE',lot_size:65,tick_size:5,freeze_quantity:1800}
const raw={instrument_token:c.instrument_key,symbol:c.trading_symbol,last_price:50,timestamp:new Date(now).toISOString(),last_trade_time:String(now),depth:{buy:[{price:49.5,quantity:650}],sell:[{price:50.5,quantity:130}]}}
test('provider normalization preserves exchange timestamps, lot sizes and depth',()=>{
 const quote=normalizeQuote(c,raw,now)
 assert.equal(quote.lotSize,65)
 assert.equal(quote.lastTradeAt,now)
 assert.equal(quote.bidQty,650)
 assert.equal(executableQuote(quote,'NORMAL_OPEN','BUY',now),null)
 assert.match(executableQuote({...quote,lastTradeAt:now-61000},'NORMAL_OPEN','BUY',now)!,/stale/)
 assert.match(executableQuote({...quote,timestamp:NaN},'NORMAL_OPEN','BUY',now)!,/stale/)
 assert.match(executableQuote({...quote,askQty:0},'NORMAL_OPEN','BUY',now)!,/quantity/)
 assert.match(executableQuote({...quote,bid:51},'NORMAL_OPEN','SELL',now)!,/two-sided/)
 assert.match(executableQuote(quote,'CLOSED','BUY',now)!,/closed/)
 assert.equal(normalOptionSession(Date.parse('2026-11-02T14:00:00Z')),false)
 assert.equal(normalOptionSession(Date.parse('2026-11-01T05:00:00Z')),false)
})
test('snapshot includes selected expiry and open contracts in other expiries, and never persists quotes',async()=>{
 const original=globalThis.fetch; const old=process.env.UPSTOX_ANALYTICS_TOKEN
 process.env.UPSTOX_ANALYTICS_TOKEN='test-read-only-token';clearProviderCache()
 const other={...c,instrument_key:'NSE_FO|200',expiry:'2026-11-09'}
 const calls:URL[]=[]
 globalThis.fetch=async(input,options)=>{
  const url=new URL(input instanceof Request?input.url:input.toString());calls.push(url)
  assert.equal((options?.headers as Record<string,string>).Authorization,'Bearer test-read-only-token')
  assert.equal(options?.cache,'no-store')
  let data:unknown
  if(url.pathname.endsWith('/option/contract'))data=[c,other]
  else if(url.pathname.endsWith('/option/chain'))data=[{strike_price:23500,underlying_spot_price:23501}]
  else if(url.pathname.endsWith('/market/status/NSE'))data={status:'CLOSED'}
  else {const keys=url.searchParams.get('instrument_key')!.split(',');data=Object.fromEntries(keys.map(key=>[key,{...raw,instrument_token:key}]))}
  return Response.json({status:'success',data})
 }
 try {
  const snapshot=await chainSnapshot('2026-11-03',['NSE_FO|200','DEMO-23500-CE'])
  assert.equal(snapshot.quotes.length,2)
  assert.equal(snapshot.status,'CLOSED')
  assert.deepEqual(snapshot.unavailablePositions,['DEMO-23500-CE'])
  assert.deepEqual(snapshot.expiries,['2026-11-03','2026-11-09'])
  assert.ok(calls.every(url=>url.hostname==='api.upstox.com'))
  await assert.rejects(chainSnapshot('2000-01-01',[]),/expiry/)
 } finally {globalThis.fetch=original;if(old===undefined)delete process.env.UPSTOX_ANALYTICS_TOKEN;else process.env.UPSTOX_ANALYTICS_TOKEN=old;clearProviderCache()}
})
test('upstream failures fail closed without exposing response or using synthetic prices',async()=>{
 const original=globalThis.fetch; const old=process.env.UPSTOX_ANALYTICS_TOKEN
 process.env.UPSTOX_ANALYTICS_TOKEN='test';clearProviderCache()
 try {
  globalThis.fetch=async()=>Response.json({error:'sensitive upstream body'},{status:401})
  await assert.rejects(contracts(),error=>error instanceof Error && /rejected/.test(error.message) && !/sensitive/.test(error.message))
  globalThis.fetch=async()=>Response.json({status:'success',data:{}})
  assert.deepEqual(await quotesFor([c]),[])
 }finally{globalThis.fetch=original;if(old===undefined)delete process.env.UPSTOX_ANALYTICS_TOKEN;else process.env.UPSTOX_ANALYTICS_TOKEN=old;clearProviderCache()}
})
