'use client'
export default function BracketFields({ tp, sl, onTP, onSL, disabled = false, entryPrice }: { tp: string; sl: string; onTP: (value: string) => void; onSL: (value: string) => void; disabled?: boolean; entryPrice?: number }) {
  return <div className="bracket-fields">{(['tp', 'sl'] as const).map(level => {
    const profit = level === 'tp'
    const change = profit ? onTP : onSL
    return <div key={level}><label>{profit ? 'Take profit (₹)' : 'Stop loss (₹)'}<input type="number" inputMode="decimal" min="0.01" max="100000" step="0.01" placeholder="Optional" value={profit ? tp : sl} onChange={e => change(e.target.value)} disabled={disabled} /></label>
      {entryPrice != null && entryPrice > 0 && <div className="bracket-presets" aria-label={profit ? 'Take profit shortcuts' : 'Stop loss shortcuts'}>{[10, 20, 30].map(percent => {
        const price = Math.round(entryPrice * (1 + (profit ? percent : -percent) / 100) * 100) / 100
        return <button type="button" key={percent} disabled={disabled || price <= 0 || price > 100000 || (profit ? price <= entryPrice : price >= entryPrice)} onClick={() => change(price.toFixed(2))} aria-label={`${profit ? 'Take profit' : 'Stop loss'} ${profit ? 'plus' : 'minus'} ${percent}%`}>{profit ? '+' : '−'}{percent}%</button>
      })}<button type="button" disabled={disabled} onClick={() => change('')} aria-label={`Clear ${profit ? 'take profit' : 'stop loss'}`}>Clear</button></div>}
    </div>
  })}</div>
}
