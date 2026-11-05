import { redirect } from 'next/navigation'
import { configured } from '@/lib/supabase/config'
import { authorized } from '@/lib/supabase/server'
import Desk from '@/components/Desk'
export const dynamic = 'force-dynamic'
export default async function Page() {
  if (!configured()) return <Desk demo email="Demo workspace" />
  const auth = await authorized()
  if (!auth) redirect('/login')
  return <Desk demo={false} email={auth.user.email || 'Private account'} />
}
