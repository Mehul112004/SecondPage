import { View } from 'react-native'
import { useTrading } from '../providers/TradingProvider'
import { dateTime } from '../lib/format'
import { Button, Card, T, styles, colors } from './ui'
export function Notifications() {
  const desk = useTrading()
  return <Card><View style={styles.panelHeading}><T style={styles.sectionTitle}>Notifications</T><Button title={desk.alertsEnabled ? 'Device alerts enabled' : 'Enable device alerts'} icon="notifications-outline" disabled={desk.alertsEnabled} onPress={() => void desk.requestAlerts()} /></View>
    <View style={{ padding: 18, gap: 12 }}><T style={styles.small}>{desk.demo ? 'Demo TP/SL checks run only while this app is active. Demo alerts clear on reload.' : 'Background TP/SL uses the existing Upstox Cron schedule on the server. Checks stop when the market is closed or quotes are stale. In-app alerts are saved for your next visit.'}</T><T style={styles.small}>Device alerts are delivered for new exits observed while the app is open. No offline push delivery is configured.</T></View>
    {(desk.workspace.notifications || []).length ? desk.workspace.notifications!.map(notice => <View key={notice.id} style={{ padding: 18, borderTopWidth: 1, borderTopColor: colors.line, gap: 8 }}><T style={{ lineHeight: 22 }}>{notice.message}</T><T style={styles.small}>{dateTime(notice.created_at)}</T></View>) : <T style={[styles.small, { padding: 18, paddingTop: 0 }]}>TP/SL execution alerts will appear here.</T>}
  </Card>
}
