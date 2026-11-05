import { View } from 'react-native'
import { Screen, T, colors, styles, Feedback } from '../../components/ui'
import { Metrics } from '../../components/Metrics'
import { OptionChain } from '../../components/OptionChain'
import { Portfolio } from '../../components/Portfolio'
import { useTrading } from '../../providers/TradingProvider'
export default function PracticeDesk() {
  const { demo, market } = useTrading()
  return <Screen title="Practice desk" subtitle="A little practice. A clearer perspective.">
    <View style={{ backgroundColor: colors.paleBlue, borderWidth: 1, borderColor: '#dce6f8', borderRadius: 7, padding: 16, marginBottom: 20, gap: 6 }}><T style={{ color: '#44628b', fontWeight: '600', fontSize: 12 }}>{demo ? 'ⓘ  Demo workspace · synthetic prices' : 'ⓘ  Upstox market data · paper orders'}</T><T style={[styles.small, { color: '#44628b', lineHeight: 20 }]}>{demo ? 'No account connected. Trades stay in this session and clear on reload.' : 'Real option premiums polled every five seconds. Your orders and funds remain virtual.'} No real orders are placed.</T></View>
    <Metrics /><Feedback />
    {!demo && market.unavailablePositions.length > 0 && <View accessibilityRole="alert" style={[styles.feedback, { backgroundColor: '#fff0f0' }]}><T style={{ color: colors.red, lineHeight: 20 }}>Some open positions have no current Upstox quote (legacy demo or expired contracts). P&L is unavailable and automated exits are disabled for those positions.</T></View>}
    <OptionChain /><Portfolio />
  </Screen>
}
