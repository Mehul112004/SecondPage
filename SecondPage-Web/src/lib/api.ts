import { configured } from './supabase/config'
import { authorized } from './supabase/server'
import { bearerToken, mutationOriginAllowed } from './request-auth'
export async function access(request?: Request) {
  if (!configured()) return null
  const authorization = request?.headers.get('authorization')
  if (authorization !== null && authorization !== undefined) {
    const token = bearerToken(authorization)
    return token ? authorized(token) : null
  }
  return authorized()
}
export const noAccess = () => Response.json({ error: 'Sign in to continue. Supabase must be configured.' }, { status: 401 })
export function sameOrigin(request: Request) {
  return mutationOriginAllowed(request)
}
