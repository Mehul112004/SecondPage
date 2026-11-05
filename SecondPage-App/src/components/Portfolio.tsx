import { useState } from 'react'
import { Alert, Pressable, StyleSheet, View } from 'react-native'
import { useTrading } from '../providers/TradingProvider'
import { money, dateTime } from '../lib/format'
import { realized, unrealized, type Position } from '../lib/market'
import { BracketFields } from './BracketFields'
import { Button, Card, Empty, Sheet, T, colors, styles } from './ui'
import { Detail } from './OrderTicket'

export function Portfolio({ history = false }: { history?: boolean }) {
  const desk = useTrading()
  const [tab, setTab] = useState<'open' | 'closed'>('open')
  const [editing, setEditing] = useState<string | null>(null)
  const [tp, setTP] = useState('')
  const [sl, setSL] = useState('')
  const position = desk.workspace.positions.find(p => p.id === editing && p.status === 'open')
  const positions = desk.workspace.positions.filter(p => p.status === tab)
  function edit(value: Position) { desk.clearFeedback(); setEditing(value.id); setTP(value.take_profit?.toString() || ''); setSL(value.stop_loss?.toString() || '') }
  function close(value: Position) {
    desk.clearFeedback()
    Alert.alert('Close position?', `Close ${value.lots} lot(s) of ${desk.name(value.contract)} using virtual funds? The fill uses the latest bid price.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Close position', onPress: () => { void desk.place({ contract: value.contract, lots: value.lots, positionId: value.id, takeProfit: null, stopLoss: null }) } },
    ])
  }
  return <><Card>
    {history ? <View style={styles.panelHeading}><T style={styles.sectionTitle}>Trade history</T><T style={styles.small}>Saved fills</T></View> : <View style={local.tabs}>{(['open', 'closed'] as const).map(value => <Pressable key={value} accessibilityRole="tab" accessibilityState={{ selected: value === tab }} onPress={() => setTab(value)} style={[local.tab, tab === value && { borderBottomColor: colors.blue }]}><T style={{ color: tab === value ? colors.blue : colors.muted, fontSize: 12, fontWeight: tab === value ? '600' : '400' }}>{value === 'open' ? `Open positions (${desk.workspace.positions.filter(p => p.status === 'open').length})` : 'Closed positions'}</T></Pressable>)}</View>}
    {desk.loading ? <Empty title="Loading your workspace…" text="Retrieving your private positions and funds." /> : history ? desk.workspace.fills.length ? desk.workspace.fills.map(fill => <View key={fill.id} style={local.record}>
      <View style={styles.row}><T style={[local.contract, { flex: 1 }]}>{fill.display_symbol || desk.name(fill.contract)}</T><T style={{ color: fill.side === 'BUY' ? colors.green : colors.red, fontWeight: '600' }}>{fill.side}</T></View>
      <T style={styles.small}>{fill.contract.startsWith('DEMO-') ? 'Synthetic' : 'NIFTY · Upstox'}</T>
      <View style={local.grid}><Field label="Quantity" value={`${fill.lots * fill.lot_size} units · ${fill.lots} lot(s)`} /><Field label="Fill price" value={money(fill.price)} /><Field label="Filled (IST)" value={dateTime(fill.created_at)} wide /></View>
    </View>) : <Empty title="Your trading story starts here." text="Filled orders will appear here, with their execution prices." /> : positions.length ? positions.map(value => {
      const quote = desk.quotes.find(q => q.id === value.contract)
      const pnl = tab === 'open' ? unrealized(value, quote) : realized(value)
      return <View key={value.id} style={local.record}>
        <T style={local.contract}>{desk.name(value.contract)}</T><T style={styles.small}>{value.quote_source === 'upstox' ? `Expiry ${value.expiry}` : 'Synthetic'} · {value.lots} lot{value.lots > 1 ? 's' : ''}</T>
        <View style={local.grid}>
          <Field label="Quantity" value={`${value.lots * value.lot_size} units`} /><Field label="Capital used" value={money(value.entry_price * value.lots * value.lot_size)} />
          <Field label="Entry" value={money(value.entry_price)} /><Field label={tab === 'open' ? 'Current bid' : 'Exit'} value={money(tab === 'open' ? quote?.bid : value.exit_price)} />
          <Field label="TP / SL" value={`${money(value.take_profit)} / ${money(value.stop_loss)}`} /><Field label={`P&L${tab === 'open' && desk.stale ? ' (stale)' : ''}`} value={money(pnl)} color={pnl === null ? colors.muted : pnl >= 0 ? colors.green : colors.red} />
          <Field label="Opened (IST)" value={dateTime(value.opened_at)} /><Field label="Closed (IST)" value={value.closed_at ? dateTime(value.closed_at) : 'Still open'} />
        </View>
        {value.exit_reason && value.exit_reason !== 'manual' && <T style={[styles.small, { marginTop: 14 }]}>{value.exit_reason === 'take_profit' ? 'Take profit triggered' : 'Stop loss triggered'}</T>}
        {tab === 'open' && <View style={[styles.row, { marginTop: 18 }]}><Button title="Set TP/SL" disabled={desk.busy} onPress={() => edit(value)} style={{ flex: 1 }} /><Button title="Close position" disabled={desk.busy || !!desk.quoteProblem(quote, 'SELL')} onPress={() => close(value)} style={{ flex: 1 }} /></View>}
      </View>
    }) : <Empty title={tab === 'open' ? 'A clean slate. Your next move.' : 'No closed positions yet.'} text={tab === 'open' ? 'Select a contract from the option chain to place your first practice trade.' : 'Close an open position to see its realized result here.'} />}
  </Card>
    <Sheet visible={editing !== null} title="Edit TP/SL" busy={desk.busy} onClose={() => setEditing(null)} footer={<>
      {desk.error ? <T accessibilityRole="alert" style={{ color: colors.red, lineHeight: 20 }}>{desk.error}</T> : null}
      <Button title={desk.busy ? 'Saving…' : 'Save TP/SL'} primary disabled={desk.busy || !position} onPress={() => { if (position) void desk.saveBrackets(position.id, tp.trim() === '' ? null : Number(tp), sl.trim() === '' ? null : Number(sl)).then(ok => { if (ok) setEditing(null) }) }} />
    </>}>
      {position ? <><T style={local.contract}>{desk.name(position.contract)}</T><View style={{ marginTop: 12 }}><Detail label="Entry per unit" value={money(position.entry_price)} /></View><BracketFields tp={tp} sl={sl} onTP={setTP} onSL={setSL} disabled={desk.busy} entryPrice={position.entry_price} /><T style={[styles.small, { marginTop: 18 }]}>TP above entry; SL below entry. Clear a field to remove that level. Crossed levels close at the next observed bid.</T></> : <T>This position has closed. Its execution is available in your trade history.</T>}
    </Sheet>
  </>
}
function Field({ label, value, color, wide }: { label: string; value: string; color?: string; wide?: boolean }) { return <View style={{ width: wide ? '100%' : '47%', gap: 6 }}><T style={styles.small}>{label}</T><T style={[styles.number, { color: color || colors.ink, lineHeight: 20 }]}>{value}</T></View> }
const local = StyleSheet.create({ tabs: { flexDirection: 'row', paddingHorizontal: 16, gap: 20, borderBottomWidth: 1, borderBottomColor: colors.line }, tab: { minHeight: 52, justifyContent: 'center', borderBottomWidth: 2, borderBottomColor: 'transparent' }, record: { padding: 18, borderBottomWidth: 1, borderBottomColor: colors.line }, contract: { fontSize: 16, fontWeight: '600', marginBottom: 4 }, grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 16, marginTop: 18 } })
