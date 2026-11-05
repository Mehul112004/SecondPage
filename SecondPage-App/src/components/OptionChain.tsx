import { useState } from 'react'
import { Pressable, StyleSheet, View } from 'react-native'
import { useTrading } from '../providers/TradingProvider'
import { Button, Card, Empty, Sheet, T, colors, styles } from './ui'
import { OrderTicket } from './OrderTicket'
import type { Quote } from '../lib/market'
export function OptionChain() {
  const desk = useTrading()
  const [selected, setSelected] = useState<string | null>(null)
  const [showExpiry, setShowExpiry] = useState(false)
  const strikes = desk.demo ? [23300, 23400, 23500, 23600, 23700] : desk.market.strikes
  const atm = [...strikes].sort((a, b) => Math.abs(a - (desk.demo ? 23500 : desk.market.spot)) - Math.abs(b - (desk.demo ? 23500 : desk.market.spot)))[0]
  function quoteAt(strike: number, type: 'CE' | 'PE') { return desk.quotes.find(q => q.strike === strike && q.type === type && (desk.demo || q.expiry === desk.market.expiry)) }
  function cell(quote: Quote | undefined) {
    return <Pressable accessibilityRole="button" accessibilityLabel={quote ? `Select ${quote.strike} ${quote.type}, bid ${quote.bid}, ask ${quote.ask}` : 'Quote unavailable'} accessibilityState={{ selected: selected === quote?.id, disabled: desk.busy || !quote }} disabled={desk.busy || !quote} onPress={() => { if (quote) { desk.clearFeedback(); setSelected(quote.id) } }} style={({ pressed }) => [local.quote, selected === quote?.id && local.selected, pressed && { backgroundColor: '#eaf1ff' }]}>
      <T adjustsFontSizeToFit numberOfLines={1} style={[styles.number, local.quoteText, selected === quote?.id && { color: colors.blue }]}>{quote ? <>{quote.bid.toFixed(2)}<T style={[local.ask, styles.number]}> / {quote.ask.toFixed(2)}</T></> : '—'}</T>
    </Pressable>
  }
  return <><Card>
    <View style={styles.panelHeading}><View style={{ gap: 5 }}><T style={styles.sectionTitle}>Option chain</T><T style={styles.small}>{desk.demo ? 'NIFTY-style practice contracts' : 'NIFTY options'}</T></View><T style={{ fontSize: 10, color: desk.stale ? colors.red : colors.green }}>● {desk.stale ? 'Feed unavailable / stale' : !desk.demo && desk.market.status !== 'NORMAL_OPEN' ? 'Market closed' : 'Updating every 5s'}</T></View>
    <View style={local.meta}><T style={{ fontWeight: '600', fontSize: 12 }}>{desk.demo ? 'NIFTY demo' : `NIFTY ${desk.market.spot ? desk.market.spot.toLocaleString('en-IN') : '—'}`}</T>{desk.demo ? <T style={styles.small}>No expiry</T> : <Button title={`Expiry ${desk.expiry || desk.market.expiry || '…'} ▾`} disabled={desk.busy || !desk.market.expiries.length} onPress={() => setShowExpiry(true)} />}</View>
    <View style={[local.chainRow, local.headerRow]}><T style={local.columnLabel}>Call bid / ask</T><T style={[local.columnLabel, local.strikeHeader]}>Strike</T><T style={local.columnLabel}>Put bid / ask</T></View>
    {strikes.length ? strikes.map(strike => <View key={strike} style={local.chainRow}><View style={local.side}>{cell(quoteAt(strike, 'CE'))}</View><View style={[local.strike, strike === atm && { backgroundColor: '#eaf0fb' }]}><T style={[styles.number, { fontWeight: '600', fontSize: 13, color: '#55677c' }]}>{strike.toLocaleString('en-IN')}</T>{strike === atm && <T style={{ fontSize: 8, color: colors.blue, marginTop: 4 }}>{desk.demo ? 'ATM demo' : 'ATM'}</T>}</View><View style={local.side}>{cell(quoteAt(strike, 'PE'))}</View></View>) : <Empty title="Connecting to your market…" text="The option chain appears when a current snapshot is available. Pull down to retry." />}
    <View style={[styles.row, { padding: 14 }]}><T style={[styles.small, { flex: 1 }]}>Prices in ₹ / unit · {desk.demo ? '25 units / lot' : 'Lot sizes from Upstox'}</T><T style={styles.small}>{desk.quotes[0] ? new Date(desk.quotes[0].timestamp).toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour12: false }) + ' IST' : 'Connecting…'}</T></View>
  </Card>
    <OrderTicket key={selected || 'no-contract'} contract={selected} onClose={() => setSelected(null)} />
    <Sheet visible={showExpiry} title="Choose expiry" busy={desk.busy} onClose={() => setShowExpiry(false)}>{desk.market.expiries.map(date => <Button key={date} title={`${date}${date === (desk.expiry || desk.market.expiry) ? '  ✓' : ''}`} onPress={() => { desk.setExpiry(date); setSelected(null); setShowExpiry(false) }} style={{ marginBottom: 10 }} />)}</Sheet>
  </>
}
const local = StyleSheet.create({ meta: { padding: 14, backgroundColor: '#fafbfd', borderBottomWidth: 1, borderBottomColor: colors.line, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }, chainRow: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#edf1f5', alignItems: 'stretch' }, headerRow: { backgroundColor: '#fcfdfe' }, columnLabel: { flex: 1, fontSize: 10, color: colors.muted, textAlign: 'center', paddingVertical: 13 }, strikeHeader: { flex: 0, width: 76, backgroundColor: '#f7f9fc' }, side: { flex: 1, justifyContent: 'center', paddingVertical: 6, paddingHorizontal: 4 }, strike: { width: 76, alignItems: 'center', justifyContent: 'center', paddingVertical: 12, backgroundColor: '#f7f9fc' }, quote: { minHeight: 44, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 3, borderRadius: 5, borderWidth: 1, borderColor: 'transparent' }, quoteText: { fontSize: 12 }, ask: { fontSize: 12, color: colors.muted }, selected: { borderColor: '#c5d6f3', backgroundColor: '#eaf1ff' } })
