import { StyleSheet, TextInput, View } from 'react-native'
import { Button, T, styles } from './ui'
export function BracketFields({ tp, sl, onTP, onSL, disabled, entryPrice }: { tp: string; sl: string; onTP: (value: string) => void; onSL: (value: string) => void; disabled: boolean; entryPrice?: number }) {
  return <View style={local.fields}>{(['tp', 'sl'] as const).map(level => {
    const profit = level === 'tp'
    const change = profit ? onTP : onSL
    const label = profit ? 'Take profit (₹)' : 'Stop loss (₹)'
    return <View key={level} style={{ flex: 1, minWidth: 0 }}><T style={styles.label}>{label}</T><TextInput accessibilityLabel={label} keyboardType="decimal-pad" placeholder="Optional" placeholderTextColor="#99a4af" value={profit ? tp : sl} onChangeText={change} editable={!disabled} style={styles.input} />
      {entryPrice != null && entryPrice > 0 && <View style={local.presets}>{[10, 20, 30].map(percent => {
        const price = Math.round(entryPrice * (1 + (profit ? percent : -percent) / 100) * 100) / 100
        return <Button key={percent} title={`${profit ? '+' : '−'}${percent}%`} disabled={disabled || price <= 0 || price > 100000 || (profit ? price <= entryPrice : price >= entryPrice)} onPress={() => change(price.toFixed(2))} style={local.preset} />
      })}<Button title="Clear" disabled={disabled} onPress={() => change('')} style={local.preset} /></View>}
    </View>
  })}</View>
}
const local = StyleSheet.create({ fields: { flexDirection: 'row', gap: 12, marginTop: 20 }, presets: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 8 }, preset: { paddingHorizontal: 5, flexGrow: 1, flexBasis: '40%', backgroundColor: '#f7f9fc' } })
