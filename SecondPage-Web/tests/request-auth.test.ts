import { test } from 'node:test'
import assert from 'node:assert/strict'
import { bearerToken, mutationOriginAllowed } from '../src/lib/request-auth.ts'

test('native origin policy requires a bearer; browser origins stay protected', () => {
  const request = (headers: Record<string, string>) => new Request('https://secondpage.example/api/orders', { method: 'POST', headers })
  assert.equal(mutationOriginAllowed(request({ origin: 'https://secondpage.example' })), true)
  assert.equal(mutationOriginAllowed(request({})), false)
  assert.equal(mutationOriginAllowed(request({ authorization: 'Bearer native-token' })), true)
  assert.equal(mutationOriginAllowed(request({ origin: 'https://other.example', authorization: 'Bearer native-token' })), false)
  assert.equal(mutationOriginAllowed(request({ origin: 'null', authorization: 'Bearer native-token' })), false)
  for (const header of ['Bearer ', 'Basic token', 'Bearer one two', 'Bearer\ttoken']) assert.equal(bearerToken(header), null)
  assert.equal(bearerToken('bearer native-token'), 'native-token')
})
