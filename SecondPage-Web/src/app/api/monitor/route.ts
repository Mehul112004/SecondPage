import { timingSafeEqual } from 'node:crypto'
import { monitor } from '@/lib/trading/monitor'
export const maxDuration = 60
export async function POST(request: Request) {
  const secret=process.env.MONITOR_SECRET
  const supplied=request.headers.get('authorization')||''
  const expected=`Bearer ${secret}`
  if (!secret || Buffer.byteLength(supplied)!==Buffer.byteLength(expected) || !timingSafeEqual(Buffer.from(supplied),Buffer.from(expected))) return Response.json({error:'Unauthorized'},{status:401})
  try {return Response.json(await monitor(),{headers:{'Cache-Control':'no-store'}})}
  catch {return Response.json({error:'Monitor failed. Check provider access and database migration.'},{status:503})}
}
