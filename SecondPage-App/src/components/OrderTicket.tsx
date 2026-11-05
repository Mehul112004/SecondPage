import { useState } from 'react'
import { Alert, StyleSheet, TextInput, View } from 'react-native'
import { useTrading } from '../providers/TradingProvider'
import { money } from '../lib/format'
import { BracketFields } from './BracketFields'
import { Button, Sheet, T, colors, styles } from './ui'
export function OrderTicket({ contract, onClose }: { contract: string | null; onClose: () => void }) {
  const desk = useTrading()
  const quote = desk.quotes.find(q => q.id === contract)
  const [lots, setLots] = useState('1')
  const [tp, setTP] = useState('')
  const [sl, setSL] = useState('')
  const count = Number(lots)
  const validCount = Number.isInteger(count) && count >= 1 && count <= 100
  const problem = desk.quoteProblem(quote, 'BUY')
  function confirm() {
    if (!quote || !validCount) return
    Alert.alert('Buy with virtual funds?', `Buy ${count} lot(s) of ${desk.name(quote.id)}? The fill uses the latest ask price.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Buy', onPress: () => { void desk.place({ contract: quote.id, lots: count, takeProfit: tp.trim() === '' ? null : Number(tp), stopLoss: sl.trim() === '' ? null : Number(sl) }).then(ok => { if (ok) onClose() }) } },
    ])
  }
  return <Sheet visible={contract !== null} title="Order ticket" busy={desk.busy} onClose={onClose} footer={<>
    {desk.error ? <T accessibilityRole="alert" style={{ color: colors.red, lineHeight: 20 }}>{desk.error}</T> : null}
    <Button primary title={desk.busy ? 'Processing…' : 'Buy with virtual funds'} disabled={desk.busy || !!problem || !quote || !validCount || quote.ask * count * quote.lotSize > desk.workspace.cash} onPress={confirm} />
  </>}>
    <View style={styles.row}><T style={styles.small}>{desk.demo ? 'NIFTY demo' : `NIFTY · ${quote?.expiry || ''}`}</T><T style={local.buyTag}>Buy to open</T></View>
    <T style={local.contract}>{quote ? `${quote.strike.toLocaleString('en-IN')} ${quote.type}` : 'Loading contract…'}</T><T style={styles.small}>{quote?.type === 'CE' ? 'Call option' : 'Put option'}</T>
    <T style={[local.price, styles.number]}>{money(quote?.ask)}</T><T style={styles.small}>Ask price / unit</T>
    <T style={[styles.label, { marginTop: 22 }]}>Number of lots</T><View style={local.stepper}><Button title="−" disabled={desk.busy || count <= 1} onPress={() => setLots(String(Math.max(1, (count || 1) - 1)))} /><TextInput accessibilityLabel="Number of lots" style={[styles.input, local.quantity]} value={lots} onChangeText={setLots} keyboardType="number-pad" editable={!desk.busy} maxLength={3} selectTextOnFocus /><Button title="+" disabled={desk.busy || count >= 100} onPress={() => setLots(String(Math.min(100, (count || 1) + 1)))} /></View>
    {!validCount && <T style={{ color: colors.red, marginTop: 8 }}>Choose 1–100 whole lots.</T>}
    <BracketFields tp={tp} sl={sl} onTP={setTP} onSL={setSL} disabled={desk.busy} entryPrice={quote?.ask} />
    <T style={[styles.small, { marginTop: 12 }]}>Optional price levels per unit. TP above entry, SL below entry.</T>
    <View style={{ gap: 15, marginVertical: 22 }}><Detail label="Quantity" value={validCount && quote ? `${count * quote.lotSize} units` : '—'} /><Detail label="Estimated premium" value={quote && validCount ? money(quote.ask * count * quote.lotSize) : '—'} /><Detail label="Available funds" value={money(desk.workspace.cash)} /></View>
    {problem && <T style={{ color: colors.red, marginBottom: 12, lineHeight: 20 }}>{problem}</T>}
    <T style={styles.small}>Market simulation. Buys fill at the latest ask; closes at the latest bid. Fees and slippage are not included.</T>
  </Sheet>
}
export function Detail({ label, value }: { label: string; value: string }) { return <View style={styles.row}><T style={[styles.small, { flex: 1 }]}>{label}</T><T style={[styles.number, { flex: 1, textAlign: 'right' }]}>{value}</T></View> }
const local = StyleSheet.create({ contract: { fontSize: 28, letterSpacing: -0.6, fontWeight: '600', marginTop: 12 }, price: { fontSize: 27, marginTop: 22, marginBottom: 3 }, buyTag: { color: colors.green, backgroundColor: '#eaf6f0', padding: 7, borderRadius: 4, fontSize: 11 }, stepper: { flexDirection: 'row', gap: 8 }, quantity: { flex: 1, textAlign: 'center' } })
