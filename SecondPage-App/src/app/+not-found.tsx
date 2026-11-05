import { Link } from 'expo-router'
import { View } from 'react-native'
import { T, colors } from '../components/ui'
export default function NotFound() { return <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', gap: 20, backgroundColor: colors.paper }}><T>This page is unavailable.</T><Link href="/" style={{ color: colors.blue, padding: 16 }}>Return to your practice desk</Link></View> }
