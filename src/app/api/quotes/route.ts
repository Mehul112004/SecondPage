import { access, noAccess } from '@/lib/api'
import { getQuotes } from '@/lib/market'
export async function GET() {
  if (!await access()) return noAccess()
  return Response.json({ quotes: getQuotes(), source: 'synthetic' }, { headers: { 'Cache-Control': 'no-store' } })
}
