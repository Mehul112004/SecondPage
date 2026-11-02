'use client'
import { useActionState } from 'react'
import { login } from '@/app/login/actions'
export default function LoginForm({ configured }: { configured: boolean }) {
  const [state, action, pending] = useActionState(login, { error: '' })
  return <form action={action} className="login-form"><label>Email<input name="email" type="email" autoComplete="username" required disabled={!configured} /></label><label>Password<input name="password" type="password" autoComplete="current-password" required disabled={!configured} /></label>{state.error && <p role="alert" className="negative">{state.error}</p>}<button className="primary" disabled={pending || !configured}>{pending ? 'Signing in…' : 'Sign in'}</button>{!configured && <p className="notice">Supabase isn’t connected yet. <a href="/">Explore the demo workspace</a>.</p>}</form>
}
