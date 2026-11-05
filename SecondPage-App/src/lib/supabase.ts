import 'react-native-url-polyfill/auto'
import { Platform } from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import * as SecureStore from 'expo-secure-store'
import { randomUUID } from 'expo-crypto'
import { createClient, processLock } from '@supabase/supabase-js'
import { config, configurationError, demoMode } from './config'
import { sessionStorage } from './session-storage'

export const supabase = !demoMode && !configurationError ? createClient(config.supabaseUrl, config.supabaseKey, {
  auth: {
    storage: Platform.OS === 'web' ? AsyncStorage : sessionStorage(SecureStore, randomUUID),
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
    lock: processLock,
  },
}) : null
