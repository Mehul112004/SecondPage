import { adminClient } from '@/lib/supabase/admin'
import { access, noAccess, sameOrigin } from '@/lib/api'
import { getQuotes, validLots, validBrackets } from '@/lib/market'
export async function POST(request: Request) {
  if (!sameOrigin(request)) return Response.json({ error: 'Origin not allowed' }, { status: 403 })
  const auth = await access()
  if (!auth) return noAccess()
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return Response.json({ error: 'Server trading credentials are not configured.' }, { status: 503 })
  let body
  try { body = await request.json() } catch { return Response.json({ error: 'Invalid request' }, { status: 400 }) }
  const { contract, lots, positionId, requestId, takeProfit = null, stopLoss = null } = body || {}
  if (!validBrackets(takeProfit, stopLoss) || !validLots(lots) || typeof contract !== 'string' || !/^[0-9a-f-]{36}$/i.test(requestId || '') || (positionId !== undefined && !/^[0-9a-f-]{36}$/i.test(positionId))) return Response.json({ error: 'Invalid order' }, { status: 400 })
  const quote = getQuotes().find(q => q.id === contract)
  if (!quote) return Response.json({ error: 'Unknown contract' }, { status: 400 })
  // Only this server can provide fill prices. The browser never submits a trusted price.
  const admin = adminClient()
  const { error } = await admin.rpc('execute_order', { p_user: auth.user.id, p_request: requestId, p_contract: contract, p_lots: lots, p_lot_size: quote.lotSize, p_price: positionId ? quote.bid : quote.ask, p_position: positionId || null, p_tp: takeProfit, p_sl: stopLoss })
  if (error) return Response.json({ error: error.code === 'P0001' ? error.message : 'Order could not be placed. Check account setup and try again.' }, { status: 400 })
  return Response.json({ ok: true })
}
