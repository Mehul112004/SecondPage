import { config } from './config'
import { supabase } from './supabase'

export class AccessError extends Error {}
export class ConnectionError extends Error {}
export async function api<T>(path: string, body?: object): Promise<T> {
  if (!supabase) throw new AccessError('Sign in to continue.')
  const { data: { session }, error } = await supabase.auth.getSession()
  if (error || !session) throw new AccessError('Your session ended. Please sign in again.')
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 35000)
  try {
    const response = await fetch(`${config.apiUrl}${path}`, {
      method: body ? 'POST' : 'GET',
      headers: { Authorization: `Bearer ${session.access_token}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
      ...(body ? { body: JSON.stringify(body) } : {}),
      signal: controller.signal,
    })
    if (response.status === 401) throw new AccessError('Access unavailable. Sign in again or contact the account owner to activate your account.')
    let data: T & { error?: string }
    try { data = await response.json() } catch { throw new ConnectionError('The server returned an unreadable response. Check your connection and API URL.') }
    if (!response.ok) throw Error(data.error || 'Request failed. Try again.')
    return data
  } catch (error) {
    if (error instanceof TypeError || (error instanceof Error && error.name === 'AbortError')) throw new ConnectionError('Could not reach SecondPage. Check your connection and server address.')
    throw error
  } finally { clearTimeout(timeout) }
}
