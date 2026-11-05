import { StyleSheet, View } from 'react-native'
import { realized, unrealized } from '../lib/market'
import { money } from '../lib/format'
import { useTrading } from '../providers/TradingProvider'
import { Card, colors, T, styles } from './ui'
export function Metrics() {
  const { workspace, quotes, loading, stale } = useTrading()
  const open = workspace.positions.filter(p => p.status === 'open')
  const missingQuote = open.some(p => !quotes.some(q => q.id === p.contract && q.bid > 0))
  const pnl = open.reduce((sum, p) => sum + (unrealized(p, quotes.find(q => q.id === p.contract)) || 0), 0)
  const booked = workspace.positions.filter(p => p.status === 'closed').reduce((sum, p) => sum + realized(p), 0)
  const marketValue = open.reduce((sum, p) => sum + (quotes.find(q => q.id === p.contract)?.bid || 0) * p.lots * p.lot_size, 0)
  const items = [
    { label: 'Available funds', value: loading ? '—' : money(workspace.cash), hint: 'Virtual buying power' },
    { label: `Open P&L${stale && open.length ? ' (stale)' : ''}`, value: loading || missingQuote ? '—' : money(pnl), hint: `${open.length} open position${open.length === 1 ? '' : 's'}`, color: pnl >= 0 ? colors.green : colors.red },
    { label: 'Realized P&L', value: loading ? '—' : money(booked), hint: 'From closed positions', color: booked >= 0 ? colors.green : colors.red },
    { label: 'Account equity', value: loading || missingQuote ? '—' : money(workspace.cash + marketValue), hint: 'Cash + bid value of holdings' },
  ]
  return <Card style={local.grid}>{items.map((item, index) => <View key={item.label} style={[local.cell, index % 2 === 0 && { borderRightWidth: 1 }, index < 2 && { borderBottomWidth: 1 }]}><T style={styles.small}>{item.label}</T><T adjustsFontSizeToFit numberOfLines={1} style={[local.value, styles.number, { color: item.color || colors.ink }]}>{item.value}</T><T style={local.hint}>{item.hint}</T></View>)}</Card>
}
const local = StyleSheet.create({ grid: { flexDirection: 'row', flexWrap: 'wrap' }, cell: { width: '50%', padding: 16, borderColor: colors.line }, value: { fontSize: 23, fontWeight: '600', letterSpacing: -0.6, marginTop: 9, marginBottom: 7 }, hint: { fontSize: 10, color: colors.muted } })
