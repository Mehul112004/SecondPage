import { adminClient } from '@/lib/supabase/admin'
import { access, noAccess, sameOrigin } from '@/lib/api'
import { validLots, validBrackets } from '@/lib/market'
import { contracts, quotesFor, marketStatus } from '@/lib/providers/upstox'
import { executableQuote } from '@/lib/trading/quote-rules'
export const maxDuration = 30
export async function POST(request: Request) {
  if (!sameOrigin(request)) return Response.json({error:'Origin not allowed'},{status:403})
  const auth=await access(request)
  if (!auth) return noAccess()
  let body
  try {body=await request.json()} catch {return Response.json({error:'Invalid request'},{status:400})}
  const {contract,lots,positionId,requestId,takeProfit=null,stopLoss=null}=body||{}
  if (!validBrackets(takeProfit,stopLoss)||!validLots(lots)||typeof contract!=='string'||!/^[0-9a-f-]{36}$/i.test(requestId||'')||(positionId!==undefined&&!/^[0-9a-f-]{36}$/i.test(positionId))) return Response.json({error:'Invalid order'},{status:400})
  try {
    const catalogue=await contracts()
    const instrument=catalogue.find(c=>c.instrument_key===contract)
    if (!instrument) return Response.json({error:'Contract unavailable or expired. Trading is disabled.'},{status:400})
    const [quotes,status]=await Promise.all([quotesFor([instrument],true),marketStatus()])
    const quote=quotes[0]
    if (!quote) return Response.json({error:'Quote unavailable'},{status:409})
    const problem=executableQuote(quote,status,positionId?'SELL':'BUY')
    if (problem) return Response.json({error:problem},{status:409})
    if (lots*quote.lotSize>(positionId?quote.bidQty!:quote.askQty!) || (quote.freezeQuantity && lots*quote.lotSize>quote.freezeQuantity)) return Response.json({error:'Order exceeds available best-price quantity or exchange freeze limit. Reduce lots.'},{status:409})
    const {error}=await adminClient().rpc('execute_upstox_order',{p_user:auth.user.id,p_request:requestId,p_quote:quote,p_lots:lots,p_position:positionId||null,p_tp:takeProfit,p_sl:stopLoss})
    if (error) return Response.json({error:error.code==='P0001'?error.message:'Order failed. Check migration 003 and account setup.'},{status:400})
    return Response.json({ok:true})
  } catch(e) {return Response.json({error:e instanceof Error?e.message:'Market data unavailable'},{status:503})}
}
