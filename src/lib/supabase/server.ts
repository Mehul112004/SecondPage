import 'server-only'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
export async function createClient() {
  const store = await cookies()
  return createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, {
    cookies: { getAll: () => store.getAll(), setAll: items => { try { items.forEach(({ name, value, options }) => store.set(name, value, options)) } catch { /* Refreshed by proxy for Server Components. */ } } },
  })
}
export async function authorized() {
  const client = await createClient()
  const { data: { user }, error } = await client.auth.getUser()
  if (error || !user) return null
  const { data: profile } = await client.from('profiles').select('active').eq('id', user.id).single()
  return profile?.active ? { client, user } : null
}
