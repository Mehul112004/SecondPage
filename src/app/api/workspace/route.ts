import { adminClient } from '@/lib/supabase/admin'
import { access, noAccess } from '@/lib/api'
export async function GET() {
  const auth = await access()
  if (!auth) return noAccess()
  // Also evaluate on refresh; Cron handles monitoring while all browsers are closed.
  const { error: monitorError } = await adminClient().rpc('monitor_brackets', { p_user: auth.user.id })
  if (monitorError) return Response.json({ error: 'TP/SL monitor unavailable. Apply migration 002 before trading.' }, { status: 503 })
  const [account, positions, notifications, fills] = await Promise.all([
    auth.client.from('accounts').select('cash').eq('user_id', auth.user.id).single(),
    auth.client.from('positions').select('*').eq('user_id', auth.user.id).order('opened_at', { ascending: false }).limit(1000),
    auth.client.from('notifications').select('*').eq('user_id', auth.user.id).order('created_at', { ascending: false }).limit(50),
    auth.client.from('fills').select('*').eq('user_id', auth.user.id).order('created_at', { ascending: false }).limit(100),
  ])
  if (account.error || positions.error || fills.error || notifications.error) return Response.json({ error: 'Workspace unavailable. Check the database migration and account setup.' }, { status: 503 })
  return Response.json({ cash: Number(account.data.cash), positions: positions.data, fills: fills.data, notifications: notifications.data }, { headers: { 'Cache-Control': 'no-store' } })
}
