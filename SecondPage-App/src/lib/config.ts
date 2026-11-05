const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || ''
const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY || ''
const apiUrl = (process.env.EXPO_PUBLIC_API_URL || '').replace(/\/+$/, '')
export const config = { supabaseUrl, supabaseKey, apiUrl }
export const demoMode = !supabaseUrl && !supabaseKey && !apiUrl
export const configurationError = demoMode ? '' :
  !supabaseUrl || !supabaseKey || !apiUrl ? 'Set all three EXPO_PUBLIC values in .env.local, or remove all three to use the synthetic demo.' :
  !/^https?:\/\/[^/]+$/i.test(apiUrl) || !/^https:\/\/[^/]+\/?$/i.test(supabaseUrl) ? 'Use an HTTPS Supabase URL and an HTTP(S) API origin without a path.' : ''
