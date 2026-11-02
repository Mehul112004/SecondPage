import { access, noAccess } from '@/lib/api'
import { chainSnapshot } from '@/lib/providers/upstox'
export const maxDuration = 30
export async function GET(request: Request) {
  const auth = await access()
  if (!auth) return noAccess()
  try {
    const {data,error}=await auth.client.from('positions').select('contract').eq('user_id',auth.user.id).eq('status','open').limit(1000)
    if (error) throw Error('Open positions could not be loaded.')
    return Response.json(await chainSnapshot(new URL(request.url).searchParams.get('expiry'), data.map(p=>p.contract)), {headers:{'Cache-Control':'private, no-store'}})
  } catch(e) { return Response.json({error:e instanceof Error?e.message:'Market data unavailable'}, {status:503}) }
}
