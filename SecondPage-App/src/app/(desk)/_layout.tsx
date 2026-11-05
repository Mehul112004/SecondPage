import { Redirect, Tabs } from 'expo-router'
import Ionicons from '@expo/vector-icons/Ionicons'
import { TradingProvider } from '../../providers/TradingProvider'
import { useAuth } from '../../providers/AuthProvider'
import { Loading, colors } from '../../components/ui'
export default function DeskLayout() {
  const { ready, session, demo } = useAuth()
  if (!ready) return <Loading />
  if (!demo && !session) return <Redirect href="/login" />
  return <TradingProvider key={session?.user.id || 'demo'}><Tabs screenOptions={{ headerShown: false, tabBarActiveTintColor: colors.blue, tabBarInactiveTintColor: colors.muted, tabBarStyle: { backgroundColor: colors.white, borderTopColor: colors.line }, tabBarLabelStyle: { fontSize: 10, fontWeight: '600' } }}>
    <Tabs.Screen name="index" options={{ title: 'Practice desk', tabBarIcon: ({ focused, size }) => <Ionicons name="grid-outline" color={focused ? colors.blue : colors.muted} size={size} /> }} />
    <Tabs.Screen name="portfolio" options={{ title: 'Portfolio', tabBarIcon: ({ focused, size }) => <Ionicons name="layers-outline" color={focused ? colors.blue : colors.muted} size={size} /> }} />
    <Tabs.Screen name="history" options={{ title: 'Trade history', tabBarIcon: ({ focused, size }) => <Ionicons name="time-outline" color={focused ? colors.blue : colors.muted} size={size} /> }} />
    <Tabs.Screen name="alerts" options={{ title: 'Alerts', tabBarIcon: ({ focused, size }) => <Ionicons name="notifications-outline" color={focused ? colors.blue : colors.muted} size={size} /> }} />
  </Tabs></TradingProvider>
}
