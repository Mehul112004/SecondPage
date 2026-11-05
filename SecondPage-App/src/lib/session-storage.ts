type Store = {
  getItemAsync: (key: string) => Promise<string | null>
  setItemAsync: (key: string, value: string) => Promise<void>
  deleteItemAsync: (key: string) => Promise<void>
}
type Manifest = { version: string; count: number }
// Supabase sessions can exceed SecureStore's per-item limit. Commit the
// manifest last so readers never observe a partially written session.
export function sessionStorage(store: Store, uuid: () => string) {
  const manifest = async (key: string): Promise<Manifest | null> => {
    const raw = await store.getItemAsync(key)
    if (!raw) return null
    const value = JSON.parse(raw) as Manifest
    if (!/^[\w-]+$/.test(value.version) || !Number.isInteger(value.count) || value.count < 1 || value.count > 1000) throw Error('Invalid stored session. Please sign in again.')
    return value
  }
  const clear = async (key: string, value: Manifest | null) => {
    if (value) await Promise.all(Array.from({ length: value.count }, (_, i) => store.deleteItemAsync(`${key}.${value.version}.${i}`)))
  }
  return {
    async getItem(key: string) {
      const value = await manifest(key)
      if (!value) return null
      const parts = await Promise.all(Array.from({ length: value.count }, (_, i) => store.getItemAsync(`${key}.${value.version}.${i}`)))
      return parts.some(part => part === null) ? null : parts.join('')
    },
    async setItem(key: string, text: string) {
      const previous = await manifest(key)
      const version = uuid()
      // Split on code points so a native UTF-8 write cannot replace a split
      // surrogate pair. 400 code points use at most 1,600 UTF-8 bytes.
      const points = Array.from(text)
      const chunks = Array.from({ length: Math.max(1, Math.ceil(points.length / 400)) }, (_, i) => points.slice(i * 400, (i + 1) * 400).join(''))
      const next = { version, count: chunks.length }
      try {
        for (let i = 0; i < chunks.length; i++) await store.setItemAsync(`${key}.${version}.${i}`, chunks[i])
        await store.setItemAsync(key, JSON.stringify(next))
      } catch (error) {
        await clear(key, next).catch(() => {})
        throw error
      }
      // The new session is committed even if old-chunk cleanup fails.
      await clear(key, previous).catch(() => {})
    },
    async removeItem(key: string) {
      const previous = await manifest(key)
      await store.deleteItemAsync(key)
      await clear(key, previous).catch(() => {})
    },
  }
}
