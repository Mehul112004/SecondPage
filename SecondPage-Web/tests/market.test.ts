import { test } from 'node:test'
import assert from 'node:assert/strict'
import { demoOrder, getQuotes, INITIAL_CASH, realized, unrealized, validLots } from '../src/lib/market.ts'
test('position P&L scales price change by units, and missing quote is unknown', () => {
  const ws = demoOrder({ cash: INITIAL_CASH, positions: [], fills: [] }, 'DEMO-23500-CE', 2)
  const p = { ...ws.positions[0], entry_price: 50 }
  const q = { ...getQuotes()[0], bid: 60 }
  assert.equal(unrealized(p, q), 500)
  assert.equal(unrealized(p), null)
  assert.equal(realized({ ...p, exit_price: 45 }), -250)
})
test('buy and close preserve account equity less bid/ask spread', () => {
  const buy = demoOrder({ cash: INITIAL_CASH, positions: [], fills: [] }, 'DEMO-23500-CE', 2)
  const p = buy.positions[0]
  assert.equal(buy.cash, INITIAL_CASH - p.entry_price * 50)
  const close = demoOrder(buy, p.contract, p.lots, p.id)
  assert.equal(close.positions[0].status, 'closed')
  assert.equal(close.cash, INITIAL_CASH + realized(close.positions[0]))
  assert.equal(buy.positions[0].status, 'open', 'must not mutate prior state')
  assert.throws(() => demoOrder(close, p.contract, p.lots, p.id), /no longer open/)
})
test('invalid quantities, insufficient funds and short closes are rejected', () => {
  for (const n of [0, -1, 1.5, 101, '2', null]) assert.equal(validLots(n), false)
  const ws = { cash: 1, positions: [], fills: [] }
  assert.throws(() => demoOrder(ws, 'DEMO-23500-CE', 1), /Insufficient/)
  assert.throws(() => demoOrder(ws, 'DEMO-23500-CE', 1, crypto.randomUUID()), /no longer open/)
  assert.throws(() => demoOrder(ws, 'unknown', 1), /Choose a contract/)
})
