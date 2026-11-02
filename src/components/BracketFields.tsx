'use client'
export default function BracketFields({ tp, sl, onTP, onSL, disabled = false }: { tp: string; sl: string; onTP: (value: string) => void; onSL: (value: string) => void; disabled?: boolean }) {
  return <div className="bracket-fields"><label>Take profit (₹)<input type="number" min="0.01" max="100000" step="0.05" placeholder="Optional" value={tp} onChange={e => onTP(e.target.value)} disabled={disabled} /></label><label>Stop loss (₹)<input type="number" min="0.01" max="100000" step="0.05" placeholder="Optional" value={sl} onChange={e => onSL(e.target.value)} disabled={disabled} /></label></div>
}
