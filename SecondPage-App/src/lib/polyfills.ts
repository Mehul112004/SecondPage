import 'react-native-url-polyfill/auto'
import { randomUUID } from 'expo-crypto'
// Supply the UUID API used by the identical web/native trading functions.
if (!globalThis.crypto) Object.defineProperty(globalThis, 'crypto', { value: { randomUUID }, configurable: true })
else if (!globalThis.crypto.randomUUID) Object.defineProperty(globalThis.crypto, 'randomUUID', { value: randomUUID, configurable: true })
