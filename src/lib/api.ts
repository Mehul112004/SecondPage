import { configured } from './supabase/config'
import { authorized } from './supabase/server'
export async function access() { return configured() ? authorized() : null }
export const noAccess = () => Response.json({ error: 'Sign in to continue. Supabase must be configured.' }, { status: 401 })
export function sameOrigin(request: Request) {
  return request.headers.get('origin') === new URL(request.url).origin
}
