import { test } from 'node:test'
import assert from 'node:assert/strict'
import { bracketReason, demoMonitor, demoOrder, getQuotes, INITIAL_CASH, validBrackets, type Workspace } from '../src/lib/market.ts'
test('₹50,000 wallet and bracket validation', () => {
 assert.equal(INITIAL_CASH, 50000)
 for (const [tp,sl] of [[0,null],[Infinity,null],[NaN,null],[30.001,null],['50',null],[-1,null]]) assert.equal(validBrackets(tp,sl),false)
 assert.equal(validBrackets(70,40),true)
 assert.throws(() => demoOrder({cash:50000,positions:[],fills:[]},'DEMO-23500-CE',1,undefined,1,1000), /TP must/)
})
test('SL and TP use bid, gap fills at observed price, duplicate monitor does not close twice', () => {
 const quote={...getQuotes()[0],id:'DEMO-23500-CE',bid:49,ask:50,ltp:49.5}
 const bought=demoOrder({cash:50000,positions:[],fills:[]},quote.id,1,undefined,70,40,quote)
 const p=bought.positions[0]
 assert.equal(bracketReason(p,{...quote,bid:69,ltp:75}),null)
 assert.equal(bracketReason(p,{...quote,bid:70}),'take_profit')
 assert.equal(bracketReason(p,{...quote,bid:39}),'stop_loss')
 assert.equal(bracketReason(p,{...quote,bid:30,timestamp:Date.now()-16000}),null)
 const closed=demoMonitor(bought,[{...quote,bid:35}])
 assert.equal(closed.cash,49625)
 assert.equal(closed.positions[0].exit_price,35)
 assert.equal(closed.positions[0].exit_reason,'stop_loss')
 assert.equal(closed.notifications?.length,1)
 const again=demoMonitor(closed,[{...quote,bid:35}])
 assert.equal(again.cash,closed.cash)
 assert.equal(again.fills.length,2)
 assert.equal(again.notifications?.length,1)
 assert.equal(bought.positions[0].status,'open')
})
test('unprotected positions stay open',()=>{
 const bought:Workspace=demoOrder({cash:50000,positions:[],fills:[]},'DEMO-23500-CE',1)
 assert.equal(demoMonitor(bought,getQuotes()).positions[0].status,'open')
})
