export type Quote = { id: string; strike: number; type: 'CE' | 'PE'; bid: number; ask: number; ltp: number; lotSize: number; timestamp: number }
export type Position = { id: string; contract: string; lots: number; lot_size: number; entry_price: number; opened_at: string; status: 'open' | 'closed'; exit_price: number | null; closed_at: string | null; take_profit?: number | null; stop_loss?: number | null; exit_reason?: string | null }
export type Fill = { id: string; contract: string; side: string; lots: number; lot_size: number; price: number; created_at: string }
export type TradeNotification = { id: string; message: string; created_at: string }
export type Workspace = { cash: number; positions: Position[]; fills: Fill[]; notifications?: TradeNotification[] }
export const INITIAL_CASH = 50_000
// Synthetic, deterministic practice feed. No exchange prices, expiry or live lot sizes implied.
export function getQuotes(now = Date.now()): Quote[] {
  const tick = Math.floor(now / 5000)
  return [23300, 23400, 23500, 23600, 23700].flatMap(strike => (['CE', 'PE'] as const).map(type => {
    const intrinsic = Math.max(0, (type === 'CE' ? 23500 - strike : strike - 23500) * 0.6)
    const premium = Math.max(8, 50 + intrinsic + Math.sin(tick / 5 + strike / 100) * 8 + Math.sin(tick / 17) * (type === 'CE' ? 10 : -10))
    const ltp = Math.round(premium * 20) / 20
    return { id: `DEMO-${strike}-${type}`, strike, type, bid: Math.round((ltp - 0.5) * 100) / 100, ask: Math.round((ltp + 0.5) * 100) / 100, ltp, lotSize: 25, timestamp: now }
  }))
}
export function unrealized(position: Position, quote?: Quote) {
  return quote ? (quote.bid - position.entry_price) * position.lots * position.lot_size : null
}
export function realized(position: Position) {
  return position.exit_price === null ? 0 : (position.exit_price - position.entry_price) * position.lots * position.lot_size
}
export function validLots(value: unknown): value is number { return Number.isInteger(value) && Number(value) >= 1 && Number(value) <= 100 }
export function demoOrder(workspace: Workspace, contract: string, lots: number, positionId?: string, takeProfit: number | null = null, stopLoss: number | null = null, suppliedQuote?: Quote, reason = 'manual'): Workspace {
  const quote = suppliedQuote || getQuotes().find(q => q.id === contract)
  if (!quote || !validLots(lots)) throw Error('Choose a contract and 1–100 whole lots.')
  const positions = workspace.positions.map(p => ({ ...p }))
  const now = new Date().toISOString()
  let cash = workspace.cash
  const position = positionId ? positions.find(p => p.id === positionId && p.status === 'open') : undefined
  if (positionId) {
    if (!position) throw Error('Position is no longer open.')
    if (position.contract !== contract || position.lots !== lots) throw Error('Close the full position quantity.')
    position.exit_price = quote.bid; position.closed_at = now; position.status = 'closed'; position.exit_reason = reason
    cash += quote.bid * lots * position.lot_size
  } else {
    if (!validBrackets(takeProfit, stopLoss) || (takeProfit !== null && takeProfit <= quote.ask) || (stopLoss !== null && stopLoss >= quote.ask)) throw Error('TP must be above entry; SL must be positive and below entry.')
    const cost = quote.ask * lots * quote.lotSize
    if (cost > cash) throw Error('Insufficient virtual funds.')
    cash -= cost
    positions.unshift({ id: crypto.randomUUID(), contract, lots, lot_size: quote.lotSize, entry_price: quote.ask, opened_at: now, status: 'open', exit_price: null, closed_at: null, take_profit: takeProfit, stop_loss: stopLoss })
  }
  return { cash, positions, notifications: workspace.notifications || [], fills: [{ id: crypto.randomUUID(), contract, side: positionId ? 'SELL' : 'BUY', lots, lot_size: quote.lotSize, price: positionId ? quote.bid : quote.ask, created_at: now }, ...workspace.fills] }
}

export function validBrackets(tp: unknown, sl: unknown) {
  return [tp, sl].every(value => value === null || (typeof value === 'number' && Number.isFinite(value) && value > 0 && value <= 100000 && Math.abs(value * 100 - Math.round(value * 100)) < 0.00001))
}
export function bracketReason(position: Position, quote: Quote): 'stop_loss' | 'take_profit' | null {
  if (position.status !== 'open' || quote.id !== position.contract || Date.now() - quote.timestamp > 15000) return null
  if (position.stop_loss != null && quote.bid <= position.stop_loss) return 'stop_loss'
  if (position.take_profit != null && quote.bid >= position.take_profit) return 'take_profit'
  return null
}
export function demoMonitor(workspace: Workspace, quotes: Quote[]): Workspace {
  let next = workspace
  for (const position of workspace.positions) {
    const quote = quotes.find(q => q.id === position.contract)
    const reason = quote && bracketReason(position, quote)
    if (!quote || !reason) continue
    next = demoOrder(next, position.contract, position.lots, position.id, null, null, quote, reason)
    next.notifications = [{ id: crypto.randomUUID(), message: `${reason === 'take_profit' ? 'Take profit' : 'Stop loss'} triggered: ${position.contract} closed at ₹${quote.bid.toFixed(2)} per unit.`, created_at: new Date().toISOString() }, ...(next.notifications || [])]
  }
  return next
}
