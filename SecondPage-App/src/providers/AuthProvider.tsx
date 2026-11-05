import { createContext, useContext, useEffect, useState, type PropsWithChildren } from 'react'
import { AppState } from 'react-native'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { configurationError, demoMode } from '../lib/config'

function useAuthState() {
  const [session, setSession] = useState<Session | null>(null)
  const [ready, setReady] = useState(!supabase)
  const [error, setError] = useState(configurationError)
  useEffect(() => {
    if (!supabase) return
    const client = supabase
    let active = true
    let authChanged = false
    client.auth.getSession().then(({ data, error: issue }) => {
      if (active && !authChanged) { setSession(data.session); setError(issue?.message || ''); setReady(true) }
    }).catch(() => { if (active) { setError('Could not restore your session. Please sign in again.'); setReady(true) } })
    const { data: { subscription } } = client.auth.onAuthStateChange((_event, next) => {
      authChanged = true
      if (active) { setSession(next); setReady(true) }
    })
    const update = (state: string | null | undefined) => { if (state === 'active') client.auth.startAutoRefresh(); else client.auth.stopAutoRefresh() }
    update(AppState.currentState)
    const listener = AppState.addEventListener('change', update)
    return () => { active = false; subscription.unsubscribe(); listener.remove(); client.auth.stopAutoRefresh() }
  }, [])
  async function signIn(email: string, password: string) {
    if (!supabase) throw Error(configurationError || 'Connect Supabase to sign in. The demo is available without an account.')
    if (!email.trim() || !password || password.length > 256) throw Error('Enter your email and password.')
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
    if (error) throw Error('Unable to sign in. Check your credentials or contact the account owner.')
    setError('')
  }
  async function signOut() {
    if (!supabase) return
    const { error } = await supabase.auth.signOut({ scope: 'local' })
    if (error) throw Error('Could not sign out. Please try again.')
    setSession(null)
  }
  return { session, ready, error, demo: demoMode, signIn, signOut }
}
const AuthContext = createContext<ReturnType<typeof useAuthState> | null>(null)
export function AuthProvider({ children }: PropsWithChildren) {
  const auth = useAuthState()
  return <AuthContext.Provider value={auth}>{children}</AuthContext.Provider>
}
export function useAuth() { const value = useContext(AuthContext); if (!value) throw Error('AuthProvider missing'); return value }
