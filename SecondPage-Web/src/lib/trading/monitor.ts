import 'server-only'
import { adminClient } from '../supabase/admin'
import { contracts, marketStatus, quotesFor } from '../providers/upstox'
import { executableQuote, normalOptionSession } from './quote-rules'
import type { Position } from '../market'
export async function monitor(userId?: string) {
  const admin = adminClient()
  const status = await marketStatus()
  if (status !== 'NORMAL_OPEN' || !normalOptionSession(Date.now())) return { checked: 0, closed: 0, status }
  let query = admin.from('positions').select('*,profiles!inner(active)').eq('profiles.active',true).eq('status','open').eq('quote_source','upstox').or('take_profit.not.is.null,stop_loss.not.is.null').order('user_id').order('id').limit(1000)
  if (userId) query = query.eq('user_id',userId)
  const {data,error} = await query
  if (error) throw Error('TP/SL monitor unavailable. Apply database migration 003.')
  if (!data?.length) return { checked: 0, closed: 0, status }
  const catalogue = await contracts()
  const needed = new Set(data.map(p=>p.contract))
  const quotes = await quotesFor(catalogue.filter(c=>needed.has(c.instrument_key)))
  let closed = 0
  for (const p of data as (Position & {user_id:string})[]) {
    const q=quotes.find(q=>q.id===p.contract)
    if (!q || executableQuote(q,status,'SELL') || q.bidQty! < p.lots*p.lot_size) continue
    const reason = p.stop_loss != null && q.bid<=p.stop_loss ? 'stop_loss' : p.take_profit != null && q.bid>=p.take_profit ? 'take_profit' : null
    if (!reason) continue
    const {data:filled,error:fillError}=await admin.rpc('execute_upstox_order',{p_user:p.user_id,p_request:crypto.randomUUID(),p_quote:q,p_lots:p.lots,p_position:p.id,p_reason:reason})
    if (fillError) throw Error('A TP/SL execution failed. Check monitor logs and database setup.')
    if (filled) closed++
  }
  return { checked:data.length,closed,status }
}
