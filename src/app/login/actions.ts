'use server'
import { redirect } from 'next/navigation'
import { configured } from '@/lib/supabase/config'
import { createClient } from '@/lib/supabase/server'
export async function login(_state: { error: string }, form: FormData) {
  if (!configured()) return { error: 'Supabase is not configured yet.' }
  const email = String(form.get('email') || '').trim()
  const password = String(form.get('password') || '')
  if (!email || password.length > 256 || !password) return { error: 'Enter your email and password.' }
  const client = await createClient()
  const { error } = await client.auth.signInWithPassword({ email, password })
  if (error) return { error: 'Unable to sign in. Check your credentials or contact the account owner.' }
  redirect('/')
}
export async function logout() {
  if (configured()) { const client = await createClient(); await client.auth.signOut() }
  redirect('/login')
}
