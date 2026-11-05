import { createContext, useCallback, useContext, useEffect, useRef, useState, type PropsWithChildren } from 'react'
import { AppState } from 'react-native'
import { randomUUID } from 'expo-crypto'
import { useAuth } from './AuthProvider'
import { api, ConnectionError } from '../lib/api'
import { enableAlerts, notifyExit } from '../lib/alerts'
import { demoMonitor, demoOrder, getQuotes, INITIAL_CASH, validBrackets, validLots, type Quote, type Workspace } from '../lib/market'
import { executableQuote } from '../lib/trading/quote-rules'

type Snapshot = { quotes: Quote[]; status: string; expiry: string; expiries: string[]; strikes: number[]; spot: number; unavailablePositions: string[] }
type Order = { contract: string; lots: number; positionId?: string; takeProfit: number | null; stopLoss: number | null }
const initial: Workspace = { cash: INITIAL_CASH, positions: [], fills: [], notifications: [] }
const initialMarket: Snapshot = { quotes: [], status: '', expiry: '', expiries: [], strikes: [], spot: 0, unavailablePositions: [] }
function useTradingState() {
  const { demo } = useAuth()
  const [workspace, setWorkspace] = useState(initial)
  const workspaceRef = useRef(workspace)
  const [quotes, setQuotes] = useState<Quote[]>([])
  const [market, setMarket] = useState(initialMarket)
  const [expiry, setExpiryValue] = useState('')
  const [busy, setBusy] = useState(false)
  const locked = useRef(false)
  const version = useRef(0)
  const mounted = useRef(true)
  const [loading, setLoading] = useState(!demo)
  const [refreshing, setRefreshing] = useState(false)
  const [feedHealthy, setFeedHealthy] = useState(false)
  const [syncError, setSyncError] = useState('')
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [uncertain, setUncertain] = useState(false)
  const [clock, setClock] = useState(() => Date.now())
  const [active, setActive] = useState(AppState.currentState === 'active')
  const [alertsEnabled, setAlertsEnabled] = useState(false)
  const alerts = useRef(false)
  const seen = useRef(new Set<string>())
  const noticesLoaded = useRef(false)
  const refreshRef = useRef<() => Promise<boolean>>(async () => false)
  const apply = useCallback((next: Workspace) => {
    if (!mounted.current) return
    workspaceRef.current = next
    setWorkspace(next)
    const notices = next.notifications || []
    for (const notice of [...notices].reverse()) {
      if (noticesLoaded.current && !seen.current.has(notice.id)) {
        setMessage(notice.message)
        if (alerts.current) void notifyExit(notice.id, notice.message).catch(() => setError('Device alert could not be shown. Your execution alert is saved below.'))
      }
      seen.current.add(notice.id)
    }
    noticesLoaded.current = true
  }, [])
  useEffect(() => {
    mounted.current = true
    const listener = AppState.addEventListener('change', state => {
      setActive(state === 'active')
      if (state !== 'active') setFeedHealthy(false)
    })
    const clockTimer = setInterval(() => setClock(Date.now()), 1000)
    return () => { mounted.current = false; listener.remove(); clearInterval(clockTimer) }
  }, [])
  useEffect(() => {
    let cancelled = false
    let running: Promise<boolean> | null = null
    const run = async () => {
      if (locked.current || !active) return false
      const startVersion = version.current
      try {
        const snapshot = demo ? null : await api<Snapshot>(`/api/quotes${expiry ? `?expiry=${encodeURIComponent(expiry)}` : ''}`)
        const nextQuotes = snapshot?.quotes || getQuotes()
        const state = demo ? null : await api<Workspace>('/api/workspace')
        if (cancelled || locked.current || startVersion !== version.current) return false
        setQuotes(nextQuotes)
        if (snapshot) setMarket(snapshot)
        apply(state || demoMonitor(workspaceRef.current, nextQuotes))
        setFeedHealthy(true); setLoading(false); setSyncError(''); setClock(Date.now())
        return true
      } catch (issue) {
        if (!cancelled) {
          setFeedHealthy(false)
          if (!demo) setLoading(true)
          setSyncError(issue instanceof Error ? issue.message : 'Workspace sync failed. Pull down to try again.')
        }
        return false
      }
    }
    const update = () => {
      if (!running) running = run().finally(() => { running = null })
      return running
    }
    refreshRef.current = update
    if (active) void update()
    const interval = active ? setInterval(() => void update(), 5000) : null
    return () => { cancelled = true; if (interval) clearInterval(interval) }
  }, [demo, expiry, active, apply])
  async function refresh() {
    if (locked.current) return
    setRefreshing(true)
    try { if (await refreshRef.current()) { setUncertain(false); setError('') } }
    finally { if (mounted.current) setRefreshing(false) }
  }
  function setExpiry(value: string) {
    if (locked.current) return
    setFeedHealthy(false); setLoading(!demo); setExpiryValue(value)
  }
  function quoteProblem(quote: Quote | undefined, side: 'BUY' | 'SELL') {
    if (loading || !active || !feedHealthy || !quote || Date.now() - quote.timestamp > 15000) return 'Feed unavailable or stale. Wait for a fresh quote.'
    if (uncertain) return 'Check trade history and pull down to refresh before placing another order.'
    return demo ? null : executableQuote(quote, market.status, side)
  }
  async function place(order: Order) {
    if (locked.current) return false
    const position = order.positionId ? workspaceRef.current.positions.find(p => p.id === order.positionId && p.status === 'open') : undefined
    if (order.positionId && (!position || position.contract !== order.contract || position.lots !== order.lots)) { setError('Position is no longer available. Refresh your portfolio.'); return false }
    const quote = quotes.find(q => q.id === order.contract)
    const problem = quoteProblem(quote, position ? 'SELL' : 'BUY')
    if (problem || !quote) { setError(problem || 'Quote unavailable.'); return false }
    if (!validLots(order.lots) || (!position && (!validBrackets(order.takeProfit, order.stopLoss) || (order.takeProfit !== null && order.takeProfit <= quote.ask) || (order.stopLoss !== null && order.stopLoss >= quote.ask)))) {
      setError('Use 1–100 whole lots. TP must be above entry; SL must be positive and below entry.'); return false
    }
    locked.current = true; version.current++; setBusy(true); setError(''); setMessage('')
    try {
      if (demo) apply(demoOrder(workspaceRef.current, order.contract, order.lots, order.positionId, order.takeProfit, order.stopLoss, getQuotes().find(q => q.id === order.contract)))
      else {
        try { await api('/api/orders', { ...order, requestId: randomUUID() }) }
        catch (issue) {
          if (issue instanceof ConnectionError) { setUncertain(true); throw Error('Connection lost. The order may have filled. Check trade history and pull down to refresh before trying again.') }
          throw issue
        }
        try { const state = await api<Workspace>('/api/workspace'); apply(state) }
        catch { setLoading(true); setUncertain(true); setError('Order filled, but balances could not refresh. Check trade history and pull down to refresh before placing another order.') }
      }
      if (mounted.current) setMessage(position ? 'Position closed.' : 'Practice order filled.')
      return true
    } catch (issue) { if (mounted.current) setError(issue instanceof Error ? issue.message : 'Order failed.'); return false }
    finally { version.current++; locked.current = false; if (mounted.current) setBusy(false) }
  }
  async function saveBrackets(positionId: string, takeProfit: number | null, stopLoss: number | null) {
    const position = workspaceRef.current.positions.find(p => p.id === positionId && p.status === 'open')
    if (!position || locked.current) return false
    if (!validBrackets(takeProfit, stopLoss) || (takeProfit !== null && takeProfit <= position.entry_price) || (stopLoss !== null && stopLoss >= position.entry_price)) { setError('TP must be above entry; SL must be positive and below entry.'); return false }
    locked.current = true; version.current++; setBusy(true); setError('')
    try {
      if (!demo) await api('/api/brackets', { positionId, takeProfit, stopLoss })
      apply({ ...workspaceRef.current, positions: workspaceRef.current.positions.map(p => p.id === positionId ? { ...p, take_profit: takeProfit, stop_loss: stopLoss } : p) })
      if (mounted.current) setMessage('TP/SL saved. Triggered levels close at the next observed bid.')
      return true
    } catch (issue) { if (mounted.current) setError(issue instanceof Error ? issue.message : 'Could not save TP/SL.'); return false }
    finally { version.current++; locked.current = false; if (mounted.current) setBusy(false) }
  }
  async function requestAlerts() {
    try { await enableAlerts(); alerts.current = true; setAlertsEnabled(true); setMessage('Device alerts enabled while SecondPage is open.') }
    catch (issue) { setError(issue instanceof Error ? issue.message : 'Could not enable alerts.') }
  }
  function name(contract: string) { return quotes.find(q => q.id === contract)?.symbol || workspace.positions.find(p => p.contract === contract)?.display_symbol || contract.replace('DEMO-', '').replace('-', ' ') }
  return { demo, workspace, quotes, market, expiry, setExpiry, loading, busy, refreshing, refresh, clock, feedHealthy, stale: !active || !feedHealthy || !quotes.length || clock - quotes[0].timestamp > 15000, error: error || syncError, message, setError, clearFeedback: () => { setError(''); setMessage('') }, quoteProblem, place, saveBrackets, alertsEnabled, requestAlerts, name }
}
const TradingContext = createContext<ReturnType<typeof useTradingState> | null>(null)
export function TradingProvider({ children }: PropsWithChildren) { const value = useTradingState(); return <TradingContext.Provider value={value}>{children}</TradingContext.Provider> }
export function useTrading() { const value = useContext(TradingContext); if (!value) throw Error('TradingProvider missing'); return value }
