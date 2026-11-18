import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Activity, ArrowDownToLine, ArrowRight, ArrowUpRight, Bell, ChartNoAxesCombined, Check, ChevronRight, ChevronsUpDown, Clock3, Command, Database, Globe2, LayoutDashboard, Menu, Search, Settings2, ShieldCheck, Smartphone, Sparkles, Wallet, WifiOff, X } from 'lucide-react'
import { App as CapacitorApp } from '@capacitor/app'
import { useDesk } from './context/workspace.js'
import { hasInstrument, instruments } from './data/pulse.js'
import { markSignalsRead } from './db/pulse.js'
import { observationTime } from './lib/pulseResearch.js'
import { native } from './lib/client.js'
import { dateLabel, displayValue } from './lib/format.js'
import { Delta, GlyphBox, Modal, spring } from './components/common.jsx'
import Dashboard from './components/Dashboard.jsx'
import DownloadAPKModal from './components/DownloadAPKModal.jsx'

const MarketPulse = lazy(() => import('./components/MarketPulse.jsx'))
const MacroEngine = lazy(() => import('./components/MacroEngine.jsx'))
const ResearchTerminal = lazy(() => import('./components/ResearchTerminal.jsx'))
const ComplianceHub = lazy(() => import('./components/ComplianceHub.jsx'))
const PaperTradingSimulator = lazy(() => import('./components/PaperTradingSimulator.jsx'))
const Settings = lazy(() => import('./components/Settings.jsx'))
const links = [
  { id: 'terminal', name: 'Terminal', icon: LayoutDashboard, description: 'Snapshot, markets and daily brief' },
  { id: 'markets', name: 'Market Pulse', icon: Activity, description: '15-second checks, trends and alerts' },
  { id: 'macro', name: 'Macro Engine', icon: Globe2, description: 'Official sources and shock scenarios' },
  { id: 'research', name: 'AI Research', icon: Sparkles, description: 'Chat with the Aura research desk' },
  { id: 'paper', name: 'Paper Trading', icon: Wallet, description: 'Simulated orders and M-Pesa funding' },
  { id: 'compliance', name: 'Compliance Hub', icon: ShieldCheck, description: 'Kenyan regulatory directory and tax' },
  { id: 'settings', name: 'Settings', icon: Settings2, description: 'Themes, access and Android app' },
]
const mobileLinks = ['terminal', 'markets', 'research', 'paper', 'settings'].map((id) => { const item = links.find((link) => link.id === id); return { ...item, name: id === 'paper' ? 'Paper Sim' : id === 'markets' ? 'Pulse' : id === 'research' ? 'Research' : item.name } })
const routePath = (id) => id === 'terminal' ? '/' : `/${id}`
const revision = document.querySelector('meta[name="aura-revision"]')?.content
function locationRoute() {
  const id = location.pathname.split('/')[1]
  const market = id === 'markets' && new URLSearchParams(location.search).get('symbol')
  return { id: links.some((link) => link.id === id) ? id : 'terminal', focus: history.state?.focus || (hasInstrument(market) ? { market } : null) }
}
function Brand({ navigate }) {
  return <a className="brand" href="/" onClick={(e) => { e.preventDefault(); navigate('terminal') }} aria-label="AuraTrade East Africa home">
    <span className="brand-mark"><Activity size={23} strokeWidth={2.35}/></span><span><strong>AuraTrade<span className="brand-period">.</span></strong><small>EAST AFRICA</small></span>
  </a>
}
function NavItem({ item, active, navigate }) {
  const Icon = item.icon
  return <a className={`nav-item ${active ? 'active' : ''}`} href={routePath(item.id)} aria-current={active ? 'page' : undefined} onClick={(e) => { if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return; e.preventDefault(); navigate(item.id) }}><Icon size={17} strokeWidth={1.75}/><span>{item.name}</span>{item.id === 'research' && <span className="sidebar-ai" aria-hidden="true">AI</span>}</a>
}
function Profile({ navigate }) {
  const { role, identity, session, authEnabled } = useDesk()
  const display = (identity?.email || session?.user?.email)?.split('@')[0] || (authEnabled ? 'Workspace account' : 'Amina Mwangi')
  const initials = display.slice(0, 2).toUpperCase()
  return <button className="profile" type="button" onClick={() => navigate('settings')} aria-label="Workspace settings"><span className="avatar">{initials}</span><span className="profile-meta"><strong>{display}</strong><small>{role === 'admin' ? 'Lead Quant Analyst' : 'Research Member'}</small></span><ChevronsUpDown size={14} className="profile-chevron"/></button>
}
function Sidebar({ page, navigate, openApk }) {
  return <aside className="sidebar"><Brand navigate={navigate}/><div className="side-main"><span className="nav-caption">WORKSPACE</span><nav aria-label="Workspace">{links.filter((item) => item.id !== 'settings').map((item) => <NavItem key={item.id} item={item} active={page === item.id} navigate={navigate}/>)}</nav><span className="nav-caption system-caption">SYSTEM</span><nav aria-label="System"><NavItem item={links.at(-1)} active={page === 'settings'} navigate={navigate}/></nav></div>
    <div className="sidebar-bottom"><button type="button" className="apk-card" onClick={openApk}><span className="apk-icon"><Smartphone size={17}/></span><span><strong>Android App</strong><small>Download APK</small></span><ArrowDownToLine size={14} className="apk-arrow"/></button><Profile navigate={navigate}/></div>
  </aside>
}
function MarketTicker({ navigate }) {
  const { rows, online, pulse } = useDesk()
  const tickers = ['usd-kes', 'nse20', 'cbr', 'tbill', 'sp500', 'nasi'].map((id) => rows.find((row) => row.id === id))
  return <div className="ticker-bar"><button type="button" className="ticker-status" onClick={() => navigate('markets')}><i className={online ? 'signal-dot' : 'signal-dot off'}/>{online ? '15S MARKET PULSE' : 'OFFLINE CACHE'}</button><div className="ticker-scroll" aria-label="Market indicators">{pulse.quotes.filter((row) => pulse.watched.includes(row.id)).map((q) => <button key={q.id} title={`${pulse.stateOf(q)} · ${observationTime(q.at)} · ${q.source}`} type="button" onClick={() => navigate('markets', { market: q.id })} className="ticker-quote"><span>{instruments[q.id].code}</span><strong>{displayValue({ value: q.price, unit: instruments[q.id].unit })}</strong><span className="ticker-freshness">{pulse.stateOf(q)}</span></button>)}{tickers.filter(Boolean).map((row) => <button key={row.id} title={`${row.name} · ${dateLabel(row.asOf)} · dated reference`} type="button" onClick={() => navigate(['usd-kes', 'nse20', 'nasi', 'tbill'].includes(row.id) ? 'terminal' : 'macro', { market: row.id })} className="ticker-quote"><span>{row.name}</span><strong>{row.unit === 'USD' ? `$${displayValue({ ...row, unit: 'pts' })}` : displayValue(row)}</strong><Delta value={row.delta} unit={row.changeUnit}/></button>)}</div></div>
}

function Header({ page, openSearch, openMenu, openNews, unread }) {
  const [time, setTime] = useState(() => new Date())
  useEffect(() => { const interval = setInterval(() => setTime(new Date()), 15000); return () => clearInterval(interval) }, [])
  const eat = new Intl.DateTimeFormat('en-GB', { timeZone: 'Africa/Nairobi', hour: '2-digit', minute: '2-digit', hour12: false }).format(time)
  return <header className="topbar"><div className="top-left"><button className="icon-button menu-trigger" aria-label="Open navigation" onClick={openMenu}><Menu size={20}/></button><span className="crumb-root">Workspace</span><ChevronRight size={13} className="crumb-divider"/><strong>{links.find((item) => item.id === page)?.name}</strong></div><div className="header-actions"><button type="button" className="search-trigger" onClick={openSearch} aria-label="Search workspace"><Search size={16}/><span>Search workspace...</span><kbd><Command size={11}/> K</kbd></button><div className="header-clock" title="East Africa Time · UTC+3"><Clock3 size={15}/><strong>{eat}</strong><span>EAT</span></div><span className="header-rule"/><button type="button" className="icon-button bell-button" aria-label={unread ? 'Notifications, unread updates' : 'Notifications'} onClick={openNews}><Bell size={18}/>{unread && <i/>}</button></div></header>
}
function CommandMenu({ close, navigate, openApk }) {
  const { rows } = useDesk()
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)
  const items = useMemo(() => [...links, { id: 'apk', name: 'Download Android APK', icon: Smartphone, description: 'Open the Android app center' }, ...rows.map((row) => ({ id: row.id, name: row.name, icon: ChartNoAxesCombined, description: `${displayValue(row)} · ${dateLabel(row.asOf)}`, market: row.id })), ...Object.entries(instruments).filter(([id]) => !rows.some((row) => row.id === id)).map(([id, item]) => ({ id, name: `${item.code} · ${item.label}`, icon: ChartNoAxesCombined, description: 'Open Market Pulse', pulse: id }))], [rows])
  const filtered = items.filter((item) => `${item.name} ${item.description}`.toLowerCase().includes(query.trim().toLowerCase()))
  function run(item) {
    if (!item) return
    close()
    if (item.id === 'apk') openApk()
    else if (item.pulse) navigate('markets', { market: item.pulse })
    else if (item.market) navigate(['usd-kes','nse20','nasi','tbill'].includes(item.id) ? 'terminal' : 'macro', { market: item.market })
    else navigate(item.id)
  }
  return <Modal title="Search workspace" description="Jump to a module or find a market indicator." close={close} className="command-modal"><label className="command-input"><Search size={19}/><input autoFocus placeholder="Search markets, tools, or settings…" value={query} onChange={(e) => { setQuery(e.target.value); setActive(0) }} onKeyDown={(e) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); const n = Math.max(1, filtered.length); const next = (active + (e.key === 'ArrowDown' ? 1 : n - 1)) % n; setActive(next); document.getElementById(`command-${next}`)?.scrollIntoView({ block: 'nearest' }) }
    if (e.key === 'Enter') { e.preventDefault(); run(filtered[active]) }
  }} aria-label="Search commands"/><kbd>ESC</kbd></label><div className="command-list"><div className="nav-caption">{query ? 'SEARCH RESULTS' : 'QUICK NAVIGATION'}</div>{filtered.length ? filtered.map((item, i) => { const Icon = item.icon; return <button id={`command-${i}`} className={active === i ? 'chosen' : ''} key={item.id} onMouseEnter={() => setActive(i)} onClick={() => run(item)} type="button"><Icon size={17}/><span><strong>{item.name}</strong><small>{item.description}</small></span><ArrowRight size={14}/></button> }) : <p className="muted">No matches. Try “inflation” or “research”.</p>}</div></Modal>
}

export function App() {
  const [route, setRoute] = useState(locationRoute)
  const [dialog, setDialog] = useState(null)
  const { online, notice, setNotice, storageError, events, pulse, scope, toast } = useDesk()
  const [readId, setReadId] = useState(() => { try { return localStorage.getItem('aura-notices') } catch { return null } })
  const newest = events[0]?.id
  const read = readId === newest
  const unreadSignals = pulse.alerts.filter((alert) => !alert.read)
  const navigate = useCallback((id, focus = null) => {
    const nextId = links.some((item) => item.id === id) ? id : 'terminal'
    const url = routePath(nextId) + (nextId === 'markets' && hasInstrument(focus?.market) ? `?symbol=${encodeURIComponent(focus.market)}` : '')
    if (`${location.pathname}${location.search}` !== url) history.pushState({ focus }, '', url)
    else history.replaceState({ focus }, '', url)
    setRoute({ id: nextId, focus })
    setDialog(null)
    if (!focus?.market || nextId !== 'terminal') window.scrollTo({ top: 0, behavior: 'instant' })
  }, [])
  useEffect(() => {
    const pop = () => { setRoute(locationRoute()); setDialog(null); window.scrollTo(0, 0) }
    const shortcut = (e) => { if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setDialog((prev) => prev === 'search' ? null : 'search') } }
    window.addEventListener('popstate', pop); window.addEventListener('keydown', shortcut)
    const nativeBack = native ? CapacitorApp.addListener('backButton', ({ canGoBack }) => { if (document.querySelector('dialog[open]')) document.querySelector('dialog[open]')?.dispatchEvent(new Event('cancel', { cancelable: true })); else if (canGoBack) history.back(); else if (location.pathname !== '/') navigate('terminal'); else CapacitorApp.minimizeApp() }) : null
    return () => { window.removeEventListener('popstate', pop); window.removeEventListener('keydown', shortcut); nativeBack?.then((listener) => listener.remove()) }
  }, [navigate])
  useEffect(() => { document.title = `${links.find((item) => item.id === route.id)?.name} — AuraTrade East Africa` }, [route.id])
  const close = () => setDialog(null)
  const openApk = () => setDialog('apk')
  function markRead() { setReadId(newest); try { localStorage.setItem('aura-notices', newest) } catch { /* notices remain readable for this session */ } }
  return <div className={`desk-shell ${native ? 'native-shell' : ''}`}><a className="skip-link" href="#main">Skip to content</a><Sidebar page={route.id} navigate={navigate} openApk={openApk}/><div className="desk-main"><Header page={route.id} openSearch={() => setDialog('search')} openMenu={() => setDialog('menu')} openNews={() => setDialog('news')} unread={!read || unreadSignals.length > 0}/><MarketTicker navigate={navigate}/>
    <main className="workspace" id="main" tabIndex={-1}>
      {(!online || storageError) && <div className="offline-banner" role="status"><WifiOff size={15}/>{storageError ? 'Device storage is unavailable. Enable IndexedDB to save work on this device.' : 'Offline mode. Charts, event studies and your paper wallet are available on this device.'}</div>}
      <AnimatePresence mode="wait" initial={false}><motion.div key={route.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 4, transition: { duration: 0.1 } }} transition={spring}>
        <Suspense fallback={<div className="module-loading" role="status"><i className="signal-dot"/> Opening workspace…</div>}>
        {route.id === 'terminal' && <Dashboard navigate={navigate} focus={route.focus}/>}
        {route.id === 'markets' && <MarketPulse focus={route.focus} navigate={navigate}/>}
        {route.id === 'macro' && <MacroEngine focus={route.focus}/>}
        {route.id === 'research' && <ResearchTerminal focus={route.focus} navigate={navigate}/>}
        {route.id === 'paper' && <PaperTradingSimulator/>}
        {route.id === 'compliance' && <ComplianceHub/>}
        {route.id === 'settings' && <Settings openApk={openApk}/>}
        </Suspense>
      </motion.div></AnimatePresence>
      <footer className="workspace-footer"><span><Activity size={14}/> AuraTrade East Africa <i/> Research &amp; simulation only</span><span><Database size={13}/> {online ? 'Offline cache enabled' : 'Using local cache'}{revision && <><i/><small title={revision}>{native ? 'App build' : 'Web build'} {revision.slice(0, 8)}</small></>}</span></footer>
    </main></div>
    <nav className="bottom-nav" aria-label="Mobile workspace">{mobileLinks.map((item) => { const Icon = item.icon; return <a key={item.id} href={routePath(item.id)} aria-current={route.id === item.id ? 'page' : undefined} onClick={(e) => { e.preventDefault(); navigate(item.id) }}><Icon size={19}/><span>{item.name}</span></a> })}</nav>
    {dialog === 'search' && <CommandMenu close={close} navigate={navigate} openApk={openApk}/>}
    {dialog === 'apk' && <DownloadAPKModal close={close}/>}
    {dialog === 'menu' && <Modal title="Workspace" description="AuraTrade East Africa" close={close}><nav className="modal-nav" aria-label="All modules">{links.map((item) => <NavItem item={item} key={item.id} active={route.id === item.id} navigate={navigate}/>)}</nav><button type="button" className="button secondary full" onClick={openApk}><Smartphone size={17}/> Download Android APK</button></Modal>}
    {dialog === 'news' && <Modal title="Desk updates" description="Market alerts and dated briefing releases." close={close}><div className="notice-list">{unreadSignals.slice(0, 4).map((item) => <button type="button" onClick={() => navigate('markets', { market: item.instrument })} key={item.id}><GlyphBox name="activity" color="amber"/><span><strong>{item.title}</strong><small>{observationTime(item.sourceAt)} · {item.source}</small></span><ChevronRight size={15}/></button>)}{events.slice(0, 4).map((item) => <button type="button" onClick={() => { markRead(); navigate('macro', { event: item.id }) }} key={item.id}><GlyphBox name={item.icon} color={item.color}/><span><strong>{item.title}</strong><small>{dateLabel(item.date)} · {item.area}</small></span><ChevronRight size={15}/></button>)}</div><button type="button" className="button secondary full" onClick={() => { markRead(); void markSignalsRead(scope).catch(() => toast('Market alerts could not be marked read.', 'info')) }}><Check size={16}/>{read && !unreadSignals.length ? 'All updates read' : 'Mark all as read'}</button></Modal>}
    <AnimatePresence>{notice && <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }} className={`toast ${notice.kind}`} role="status"><span>{notice.kind === 'success' ? <Check size={16}/> : <ArrowUpRight size={16}/>}</span><p>{notice.message}</p><button type="button" aria-label="Dismiss notification" onClick={() => setNotice(null)}><X size={15}/></button></motion.div>}</AnimatePresence>
  </div>
}
