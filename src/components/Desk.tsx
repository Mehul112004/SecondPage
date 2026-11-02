'use client'
import { useEffect, useRef, useState } from 'react'
import { demoOrder, demoMonitor, validBrackets, getQuotes, INITIAL_CASH, realized, unrealized, type Quote, type Workspace } from '@/lib/market'
import BracketFields from './BracketFields'
import { logout } from '@/app/login/actions'
const money = (value: number) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(value)
const name = (id: string) => id.replace('DEMO-', '').replace('-', ' ')
const empty: Workspace = { cash: INITIAL_CASH, positions: [], fills: [] }
async function api(path: string, options?: RequestInit) {
  const response = await fetch(path, { cache: 'no-store', ...options })
  if (response.status === 401) { window.location.assign('/login'); throw Error('Session ended. Please sign in again.') }
  const data = await response.json()
  if (!response.ok) throw Error(data.error || 'Request failed. Try again.')
  return data
}
export default function Desk({ demo, email }: { demo: boolean; email: string }) {
  const [quotes, setQuotes] = useState<Quote[]>([])
  const [workspace, setWorkspace] = useState<Workspace>(empty)
  const [selected, setSelected] = useState('DEMO-23500-CE')
  const [lots, setLots] = useState(1)
  const [tp, setTP] = useState('')
  const [sl, setSL] = useState('')
  const [editing, setEditing] = useState<string | null>(null)
  const [editTP, setEditTP] = useState('')
  const [editSL, setEditSL] = useState('')
  const [desktopNotifications, setDesktopNotifications] = useState(false)
  const seenNotifications = useRef(new Set<string>())
  const notificationsLoaded = useRef(false)
  const [tab, setTab] = useState<'open' | 'closed' | 'fills'>('open')
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [loading, setLoading] = useState(!demo)
  const [feedHealthy, setFeedHealthy] = useState(false)
  const [clock, setClock] = useState(0)
  const [showTicket, setShowTicket] = useState(false)
  const workspaceRef = useRef(workspace)
  const locked = useRef(false)
  useEffect(() => { workspaceRef.current = workspace }, [workspace])
  useEffect(() => {
    const notices = workspace.notifications || []
    if (notificationsLoaded.current) {
      for (const notice of notices) {
        if (!seenNotifications.current.has(notice.id)) {
          setMessage(notice.message)
          if (desktopNotifications && 'Notification' in window && Notification.permission === 'granted') new Notification('SecondPage · Position closed', { body: notice.message, tag: notice.id })
        }
      }
    }
    notices.forEach(notice => seenNotifications.current.add(notice.id))
    notificationsLoaded.current = true
  }, [workspace.notifications, desktopNotifications])
  async function refreshWorkspace() { const data = await api('/api/workspace'); workspaceRef.current = data; setWorkspace(data) }
  useEffect(() => {
    let cancelled = false
    let running = false
    async function update() {
      if (running) return
      running = true
      try {
        const data = demo ? getQuotes() : (await api('/api/quotes')).quotes
        if (!cancelled) {
          setQuotes(data); setFeedHealthy(true)
          if (demo && !locked.current) {
            const next = demoMonitor(workspaceRef.current, data)
            workspaceRef.current = next; setWorkspace(next)
          } else if (!demo && !locked.current) {
            const state = await api('/api/workspace')
            if (!cancelled && !locked.current) { workspaceRef.current = state; setWorkspace(state); setLoading(false) }
          }
        }
      } catch (e) { if (!cancelled) { setFeedHealthy(false); if (!demo) { setLoading(true); setError(e instanceof Error ? e.message : 'Workspace sync failed. Orders are disabled until it recovers.') } } }
      finally { running = false }
    }
    void update()
    const interval = setInterval(() => { setClock(Date.now()); void update() }, 5000)
    return () => { cancelled = true; clearInterval(interval) }
  }, [demo])
  const quote = quotes.find(q => q.id === selected)
  const stale = !feedHealthy || !quote || (clock || Date.now()) - quote.timestamp > 15000
  const open = workspace.positions.filter(p => p.status === 'open')
  const closed = workspace.positions.filter(p => p.status === 'closed')
  const missingQuote = open.some(p => !quotes.some(q => q.id === p.contract))
  const pnl = open.reduce((sum, p) => sum + (unrealized(p, quotes.find(q => q.id === p.contract)) || 0), 0)
  const booked = closed.reduce((sum, p) => sum + realized(p), 0)
  const marketValue = open.reduce((sum, p) => sum + (quotes.find(q => q.id === p.contract)?.bid || 0) * p.lots * p.lot_size, 0)
  async function saveBrackets() {
    const takeProfit = editTP === '' ? null : Number(editTP)
    const stopLoss = editSL === '' ? null : Number(editSL)
    const position = open.find(p => p.id === editing)
    if (!position || locked.current) return
    if (!validBrackets(takeProfit, stopLoss) || (takeProfit !== null && takeProfit <= position.entry_price) || (stopLoss !== null && stopLoss >= position.entry_price)) { setError('TP must be above entry; SL must be positive and below entry.'); return }
    locked.current = true; setBusy(true); setError('')
    try {
      if (demo) {
        const next = { ...workspaceRef.current, positions: workspaceRef.current.positions.map(p => p.id === editing ? { ...p, take_profit: takeProfit, stop_loss: stopLoss } : p) }
        workspaceRef.current = next; setWorkspace(next)
      } else {
        await api('/api/brackets', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ positionId: editing, takeProfit, stopLoss }) })
        await refreshWorkspace()
      }
      setEditing(null); setMessage('TP/SL saved. Triggered levels close at the next observed bid.')
    } catch (e) { setError(e instanceof Error ? e.message : 'Unable to save TP/SL') }
    finally { locked.current = false; setBusy(false) }
  }
  async function place(positionId?: string) {
    if (locked.current || stale || loading) return
    const position = positionId ? open.find(p => p.id === positionId) : undefined
    if (positionId && !position) return
    const contract = position?.contract || selected
    const quantity = position?.lots || lots
    if (!window.confirm(`${position ? 'Close' : 'Buy'} ${quantity} lot(s) of ${name(contract)} using virtual funds? The fill uses the latest ${position ? 'bid' : 'ask'} price.`)) return
    locked.current = true; setBusy(true); setError(''); setMessage('')
    try {
      if (demo) {
        const next = demoOrder(workspaceRef.current, contract, quantity, positionId, tp === '' ? null : Number(tp), sl === '' ? null : Number(sl))
        workspaceRef.current = next; setWorkspace(next)
      } else {
        try {
          await api('/api/orders', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ contract, lots: quantity, positionId, takeProfit: tp === '' ? null : Number(tp), stopLoss: sl === '' ? null : Number(sl), requestId: crypto.randomUUID() }) })
        } catch (e) {
          if (e instanceof TypeError) {
            setLoading(true)
            throw Error('Connection lost. The order may have filled. Reload to check trade history before trying again.')
          }
          throw e
        }
        // Refresh is separate: if this fails, do not imply the order itself was rejected.
        try { await refreshWorkspace() } catch { setError('Order filled, but balances could not refresh. Reload before placing another order.'); setLoading(true) }
      }
      setMessage(position ? 'Position closed.' : 'Practice order filled.'); setShowTicket(false)
    } catch (e) { setError(e instanceof Error ? e.message : 'Order failed') }
    finally { locked.current = false; setBusy(false) }
  }
  return <div className="app-shell">
    <aside className="sidebar"><a className="brand" href="/">SecondPage<span>↗</span></a><div className="workspace-label">Personal workspace</div><nav aria-label="Workspace"><a className="nav-active" href="/">▦ <span>Practice desk</span></a><a href="#portfolio">▤ <span>Portfolio</span></a><a href="#activity" onClick={() => setTab('fills')}>◷ <span>Trade history</span></a></nav><div className="side-bottom"><div className="avatar">{demo ? 'D' : email[0].toUpperCase()}</div><span>{demo ? 'Demo account' : email}<small>{demo ? 'Clears on refresh' : 'Private access'}</small></span></div></aside>
    <div className="main-area"><header className="topbar"><span>Workspace <span className="slash">/</span> <strong>Practice desk</strong></span>{demo ? <a href="/login">Sign in</a> : <form action={logout}><button className="text-button">Sign out</button></form>}</header>
    <main className="desk"><div className="heading"><div><h1>Practice desk</h1><p className="muted">A little practice. A clearer perspective.</p></div><span className="private-pill">◇ Private paper trading</span></div>
    <div className="demo-banner"><span className="demo-icon">i</span><div><strong>{demo ? 'Demo workspace · synthetic prices' : 'Synthetic practice feed'}</strong><p>{demo ? 'No account connected. Trades stay in this tab and clear on refresh.' : 'Trades are saved to your private account. Prices are simulated, not live or historical.'} No real orders are placed.</p></div></div>
    <div className="metrics"><div><span>Available funds</span><strong>{loading ? '—' : money(workspace.cash)}</strong><small>Virtual buying power</small></div><div><span>Open P&L {stale && open.length > 0 ? '(stale)' : ''}</span><strong className={pnl >= 0 ? 'positive' : 'negative'}>{loading || missingQuote ? '—' : money(pnl)}</strong><small>{open.length} open position{open.length === 1 ? '' : 's'}</small></div><div><span>Realized P&L</span><strong className={booked >= 0 ? 'positive' : 'negative'}>{loading ? '—' : money(booked)}</strong><small>From closed positions</small></div><div><span>Account equity</span><strong>{loading || missingQuote ? '—' : money(workspace.cash + marketValue)}</strong><small>Cash + bid value of holdings</small></div></div>
    <div className="trading-grid"><section className="panel chain"><div className="panel-heading"><div><h2>Option chain</h2><p className="muted">NIFTY-style practice contracts</p></div><span className={stale ? 'feed offline' : 'feed'}><i />{stale ? 'Feed unavailable' : 'Updating every 5s'}</span></div><div className="chain-meta"><strong>NIFTY demo</strong><span>Illustrative contracts · no expiry</span></div><div className="table-wrap"><table><thead><tr><th className="right">Call bid / ask</th><th className="strike">Strike</th><th>Put bid / ask</th></tr></thead><tbody>{[23300,23400,23500,23600,23700].map(strike => <tr key={strike}>{(['CE','PE'] as const).map((type, index) => {
      const q = quotes.find(q => q.strike === strike && q.type === type)
      const button = <button aria-label={`Select ${strike} ${type}`} aria-pressed={selected === q?.id} className={`quote-button ${selected === q?.id ? 'selected' : ''}`} onClick={() => { if (q) { setSelected(q.id); setShowTicket(true); setMessage('') } }}>{q ? <>{q.bid.toFixed(2)} <span>/ {q.ask.toFixed(2)}</span></> : '—'}</button>
      return index === 0 ? <td key={type} className="right">{button}</td> : <td key={type}>{button}</td>
    }).flatMap((cell, index) => index === 0 ? [cell, <td className={`strike ${strike === 23500 ? 'atm' : ''}`} key="strike">{strike.toLocaleString('en-IN')}{strike === 23500 && <small>ATM demo</small>}</td>] : [cell])}</tr>)}</tbody></table></div><div className="panel-footer">Prices in ₹ per unit. Practice lot size: 25.<span>{quotes[0] ? new Date(quotes[0].timestamp).toLocaleTimeString('en-IN', { hour12: false }) : 'Connecting…'}</span></div></section>
    <section className={`panel ticket ${showTicket ? 'ticket-mobile-open' : ''}`}><div className="panel-heading"><h2>Order ticket</h2><span className="buy-tag">Buy to open</span></div><div className="ticket-content"><p className="muted">NIFTY demo · {quote?.type === 'CE' ? 'Call option' : 'Put option'}</p><h3>{quote ? `${quote.strike.toLocaleString('en-IN')} ${quote.type}` : 'Loading contract…'}</h3><div className="ticket-price">{quote ? money(quote.ask) : '—'}<small>Ask price / unit</small></div><label className="quantity-label">Number of lots<div className="stepper"><button aria-label="Decrease lots" onClick={() => setLots(n => Math.max(1,n-1))} disabled={busy || lots <= 1}>−</button><input aria-label="Number of lots" type="number" min="1" max="100" value={lots} onChange={e => setLots(Math.max(1, Math.min(100, Math.floor(Number(e.target.value) || 1))))} disabled={busy} /><button aria-label="Increase lots" onClick={() => setLots(n => Math.min(100,n+1))} disabled={busy || lots >= 100}>+</button></div></label><BracketFields tp={tp} sl={sl} onTP={setTP} onSL={setSL} disabled={busy} /><p className="ticket-note">Optional price levels per unit. TP above entry, SL below entry.</p><dl><div><dt>Quantity</dt><dd>{lots * (quote?.lotSize || 25)} units</dd></div><div><dt>Estimated premium</dt><dd>{quote ? money(quote.ask * lots * quote.lotSize) : '—'}</dd></div><div><dt>Available funds</dt><dd>{money(workspace.cash)}</dd></div></dl><button className="primary" onClick={() => void place()} disabled={busy || stale || loading || !quote || quote.ask * lots * quote.lotSize > workspace.cash}>{busy ? 'Processing…' : 'Buy with virtual funds'}</button><p className="ticket-note">Market simulation. Buys fill at the latest ask; closes at the latest bid. Fees and slippage are not included.</p></div></section></div>
    <div aria-live="polite" className="feedback">{error && <p role="alert" className="error-box">{error}</p>}{message && <p className="success-box">{message}</p>}</div>
    <section className="panel portfolio" id="portfolio"><div className="portfolio-heading" id="activity"><div className="tabs" role="tablist" aria-label="Portfolio view">{(['open','closed','fills'] as const).map(value => <button role="tab" aria-selected={tab === value} key={value} className={tab === value ? 'active-tab' : ''} onClick={() => setTab(value)}>{value === 'open' ? `Open positions (${open.length})` : value === 'closed' ? 'Closed positions' : 'Trade history'}</button>)}</div><span className="muted">{tab === 'open' ? 'Marked to bid' : 'Saved fills'}</span></div>
    {loading ? <div className="empty-state"><h3>Loading your workspace…</h3><p>Retrieving your private positions and funds.</p></div> : tab === 'fills' ? workspace.fills.length === 0 ? <Empty title="Your trading story starts here." text="Filled orders will appear here, with their execution prices." /> : <div className="table-wrap"><table><thead><tr><th>Contract</th><th>Side</th><th>Quantity</th><th>Fill price</th><th>Time</th></tr></thead><tbody>{workspace.fills.map(fill => <tr key={fill.id}><td className="contract-cell">{name(fill.contract)}<small>NIFTY demo</small></td><td><span className={fill.side === 'BUY' ? 'positive' : 'negative'}>{fill.side}</span></td><td>{fill.lots * fill.lot_size}</td><td>{money(fill.price)}</td><td>{new Date(fill.created_at).toLocaleString('en-IN')}</td></tr>)}</tbody></table></div> : (tab === 'open' ? open : closed).length === 0 ? <Empty title={tab === 'open' ? 'A clean slate. Your next move.' : 'No closed positions yet.'} text={tab === 'open' ? 'Select a contract from the option chain to place your first practice trade.' : 'Close an open position to see its realized result here.'} /> : <div className="table-wrap"><table><thead><tr><th>Contract</th><th>Quantity</th><th>Entry</th><th>{tab === 'open' ? 'Current bid' : 'Exit'}</th><th>TP / SL</th><th>P&L</th><th /></tr></thead><tbody>{(tab === 'open' ? open : closed).map(position => { const q = quotes.find(q => q.id === position.contract); const result = tab === 'open' ? unrealized(position,q) : realized(position); return <tr key={position.id}><td className="contract-cell">{name(position.contract)}<small>NIFTY demo · {position.lots} lot{position.lots > 1 ? 's' : ''}</small></td><td>{position.lots * position.lot_size}</td><td>{money(position.entry_price)}</td><td>{tab === 'open' ? q ? money(q.bid) : '—' : money(position.exit_price!)}</td><td>{position.take_profit == null ? '—' : money(position.take_profit)} / {position.stop_loss == null ? '—' : money(position.stop_loss)}{position.exit_reason && position.exit_reason !== 'manual' && <small>{position.exit_reason === 'take_profit' ? 'TP triggered' : 'SL triggered'}</small>}</td><td className={result === null ? '' : result >= 0 ? 'positive' : 'negative'}>{result === null ? '—' : money(result)}{tab === 'open' && stale && <small>Stale</small>}</td><td>{tab === 'open' && <><button className="close-button" disabled={busy} onClick={() => { setEditing(position.id); setEditTP(position.take_profit?.toString() || ''); setEditSL(position.stop_loss?.toString() || '') }}>Set TP/SL</button> <button className="close-button" disabled={busy || stale || loading || !q} onClick={() => void place(position.id)}>Close position</button></>}</td></tr> })}</tbody></table></div>}</section>
    {editing && <section className="panel bracket-editor" aria-label="Edit position TP/SL"><h2>Edit TP/SL · {name(open.find(p => p.id === editing)?.contract || '')}</h2><p className="muted">Leave a field blank to remove that level. Crossed levels close at the next observed bid.</p><BracketFields tp={editTP} sl={editSL} onTP={setEditTP} onSL={setEditSL} disabled={busy} /><div className="editor-actions"><button className="close-button" disabled={busy} onClick={() => setEditing(null)}>Cancel</button><button className="primary" disabled={busy} onClick={() => void saveBrackets()}>Save TP/SL</button></div></section>}
    <section className="panel notifications"><div className="panel-heading"><h2>Notifications</h2><button className="close-button" disabled={desktopNotifications} onClick={async () => {
      if (!('Notification' in window)) { setError('Desktop notifications are not supported by this browser. In-app notifications remain available.'); return }
      const permission = await Notification.requestPermission()
      setDesktopNotifications(permission === 'granted')
      if (permission !== 'granted') setError('Desktop notifications were not enabled. In-app notifications remain available.')
    }}>{desktopNotifications ? 'Desktop alerts enabled' : 'Enable desktop alerts'}</button></div><p className="monitor-note">{demo ? 'Demo TP/SL checks run only while this tab is active.' : 'Background TP/SL requires the Supabase Cron job. Checks pause if the database is unavailable.'} {demo ? 'Demo alerts clear on refresh.' : 'In-app alerts are saved for your next visit.'} Desktop alerts require this app to be open.</p>{(workspace.notifications || []).length ? <ul>{workspace.notifications!.map(notice => <li key={notice.id}><p>{notice.message}</p><time>{new Date(notice.created_at).toLocaleString('en-IN')}</time></li>)}</ul> : <p className="no-notifications">TP/SL execution alerts will appear here.</p>}</section>
    <footer className="desk-footer"><span>Practice with intention.</span><span>Synthetic data · Long options only · No tick data stored</span></footer></main></div></div>
}
function Empty({ title, text }: { title: string; text: string }) { return <div className="empty-state"><div className="empty-symbol">▥</div><h3>{title}</h3><p>{text}</p></div> }
