import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { networkInterfaces } from 'node:os'

const source = new URL('../../SecondPage-Web/.env.local', import.meta.url)
if (!existsSync(source)) throw Error('Create SecondPage-Web/.env.local first, or copy .env.example to .env.local for demo mode.')
const text = readFileSync(source, 'utf8')
function publicValue(name) {
  const raw = text.match(new RegExp(`^${name}\\s*=\\s*(.*)$`, 'm'))?.[1]?.trim() || ''
  return raw.replace(/^(["'])(.*)\1$/, '$2')
}
const supabaseUrl = publicValue('NEXT_PUBLIC_SUPABASE_URL')
const supabaseKey = publicValue('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY')
if (!supabaseUrl || !supabaseKey) throw Error('The web project needs both public Supabase values before copying account configuration.')
const interfaces = Object.entries(networkInterfaces()).sort(([a], [b]) => Number(b === 'en0') - Number(a === 'en0'))
const address = interfaces.flatMap(([, entries]) => entries || []).find(entry => entry.family === 'IPv4' && !entry.internal)?.address || 'localhost'
const origin = process.env.EXPO_PUBLIC_API_URL || `http://${address}:3000`
if (!/^https?:\/\/[^/]+$/.test(origin)) throw Error('EXPO_PUBLIC_API_URL must be an HTTP(S) origin without a trailing slash or /api path.')
const values = {
  EXPO_PUBLIC_API_URL: origin,
  EXPO_PUBLIC_SUPABASE_URL: supabaseUrl,
  EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY: supabaseKey,
}
writeFileSync(new URL('../.env.local', import.meta.url), Object.entries(values).map(([key, value]) => `${key}=${JSON.stringify(value)}`).join('\n') + '\n', { mode: 0o600 })
console.log('Created ignored .env.local with the API origin and the two public Supabase values. Server secrets were not copied.')
