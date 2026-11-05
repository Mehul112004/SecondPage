import { monitor } from '@/lib/trading/monitor'
import { access, noAccess } from '@/lib/api'
export const maxDuration = 30
export async function GET(request: Request) {
  const auth = await access(request)
  if (!auth) return noAccess()
  try { await monitor(auth.user.id) } catch { return Response.json({error:'Market monitoring unavailable. Check Upstox access and migration 003.'},{status:503}) }
  const [account, positions, notifications, fills] = await Promise.all([
    auth.client.from('accounts').select('cash').eq('user_id', auth.user.id).single(),
    auth.client.from('positions').select('*').eq('user_id', auth.user.id).order('opened_at', { ascending: false }).limit(1000),
    auth.client.from('notifications').select('*').eq('user_id', auth.user.id).order('created_at', { ascending: false }).limit(50),
    auth.client.from('fills').select('*').eq('user_id', auth.user.id).order('created_at', { ascending: false }).limit(100),
  ])
  if (account.error || positions.error || fills.error || notifications.error) return Response.json({ error: 'Workspace unavailable. Check the database migration and account setup.' }, { status: 503 })
  return Response.json({ cash: Number(account.data.cash), positions: positions.data, fills: fills.data, notifications: notifications.data }, { headers: { 'Cache-Control': 'no-store' } })
}
