import { access, noAccess, sameOrigin } from '@/lib/api'
import { validBrackets } from '@/lib/market'
export async function POST(request: Request) {
  if (!sameOrigin(request)) return Response.json({ error: 'Origin not allowed' }, { status: 403 })
  const auth = await access()
  if (!auth) return noAccess()
  let body
  try { body = await request.json() } catch { return Response.json({ error: 'Invalid request' }, { status: 400 }) }
  const { positionId, takeProfit, stopLoss } = body || {}
  if (!/^[0-9a-f-]{36}$/i.test(positionId || '') || !validBrackets(takeProfit, stopLoss)) return Response.json({ error: 'Invalid TP/SL values.' }, { status: 400 })
  const { error } = await auth.client.rpc('set_brackets', { p_position: positionId, p_tp: takeProfit, p_sl: stopLoss })
  if (error) return Response.json({ error: error.code === 'P0001' ? error.message : 'Unable to save TP/SL. Check database migration.' }, { status: 400 })
  return Response.json({ ok: true })
}
