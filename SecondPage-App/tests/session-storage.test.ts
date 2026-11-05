import { test } from 'node:test'
import assert from 'node:assert/strict'
import { sessionStorage } from '../src/lib/session-storage.ts'
test('large sessions survive chunked storage, replacement, and logout', async () => {
  const values = new Map<string, string>()
  let id = 0
  const storage = sessionStorage({ getItemAsync: async key => values.get(key) ?? null, setItemAsync: async (key, value) => { assert.ok(Buffer.byteLength(value, 'utf8') <= 1600); values.set(key, Buffer.from(value, 'utf8').toString('utf8')) }, deleteItemAsync: async key => { values.delete(key) } }, () => String(++id))
  const session = 'a' + '🔒'.repeat(4000)
  await storage.setItem('auth', session)
  assert.equal(await storage.getItem('auth'), session)
  await storage.setItem('auth', 'next')
  assert.equal(await storage.getItem('auth'), 'next')
  assert.equal(values.size, 2)
  await storage.removeItem('auth')
  assert.equal(await storage.getItem('auth'), null)
  assert.equal(values.size, 0)
})
test('failed session writes retain the last complete session', async () => {
  const values = new Map<string, string>()
  let fail = false
  let id = 0
  const storage = sessionStorage({ getItemAsync: async key => values.get(key) ?? null, setItemAsync: async (key, value) => { if (fail && key.endsWith('.1')) throw Error('storage full'); values.set(key, value) }, deleteItemAsync: async key => { values.delete(key) } }, () => String(++id))
  await storage.setItem('auth', 'original')
  fail = true
  await assert.rejects(storage.setItem('auth', 'a'.repeat(900)), /storage full/)
  assert.equal(await storage.getItem('auth'), 'original')
  assert.equal(values.size, 2)
})
