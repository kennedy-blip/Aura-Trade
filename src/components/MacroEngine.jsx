import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { ArrowDownToLine, ArrowUpRight, ChevronDown, Database, ExternalLink, FlaskConical, RotateCcw, RefreshCw, Search } from 'lucide-react'
import { useDesk } from '../context/workspace.js'
import { feedSources, sources } from '../data/markets.js'
import { shockImpact } from '../lib/models.js'
import { changeLabel, csv, dateLabel, displayValue, download } from '../lib/format.js'
import { Delta, EmptyState, GlyphBox, PanelTitle, SectionHeading, SourceLink, Tabs } from './common.jsx'

const scenarios = [
  { label: 'Fuel price spike', fuel: 10, rates: 0, usd: 0 },
  { label: 'CBK eases', fuel: 0, rates: -50, usd: 0 },
  { label: 'Stronger dollar', fuel: 0, rates: 0, usd: 3 },
  { label: 'Combined shock', fuel: 12, rates: 50, usd: 3 },
]
function ShockLab() {
  const { settings } = useDesk()
  const [shock, setShock] = useState({ fuel: 5, rates: 0, usd: 0 })
  const inputs = [
    { key: 'fuel', label: 'EPRA fuel price cap shock', unit: '%', min: -25, max: 30, step: 1, help: 'Percentage change in domestic pump caps.' },
    { key: 'rates', label: 'CBK policy rate change', unit: 'bps', min: -250, max: 250, step: 25, help: 'Change in the Central Bank Rate, in basis points.' },
    { key: 'usd', label: 'Broad US dollar move', unit: '%', min: -12, max: 12, step: .5, help: 'Change in the external dollar basket.' },
  ]
  const values = shockImpact(shock.fuel, shock.rates, shock.usd, settings.model)
  const outputs = [
    { label: 'Headline inflation', unit: 'pp', icon: 'chart', color: 'amber', note: 'Additional pressure from pump costs and FX.' },
    { label: 'USD / KES', unit: '%', icon: 'globe', color: 'cyan', note: 'Positive means a weaker Kenyan shilling.' },
    { label: 'NSE industrials', unit: '%', icon: 'activity', color: 'mint', note: 'Cost, discount-rate and currency channels.' },
  ]
  return <div className="module-grid"><section className="glass module-card"><PanelTitle title="Scenario inputs" subtitle="Change one driver or combine shocks" icon="activity"/><div className="preset-row">{scenarios.map((preset) => <button type="button" key={preset.label} className={`preset ${inputs.every(({ key }) => shock[key] === preset[key]) ? 'selected' : ''}`} onClick={() => setShock(preset)}>{preset.label}</button>)}</div><div className="sliders">{inputs.map((item) => <div key={item.key} className="slider-field"><label htmlFor={`shock-${item.key}`}>{item.label}<output>{changeLabel(shock[item.key], item.unit, item.step === .5 ? 1 : 0)}</output></label><input id={`shock-${item.key}`} type="range" min={item.min} max={item.max} step={item.step} value={shock[item.key]} onChange={(e) => setShock({ ...shock, [item.key]: Number(e.target.value) })}/><small>{item.help}</small></div>)}</div><button type="button" className="button secondary" onClick={() => setShock({ fuel: 0, rates: 0, usd: 0 })}><RotateCcw size={14}/> Reset shocks</button></section>
    <section className="glass module-card"><PanelTitle title="Transmission estimate" subtitle="Illustrative sensitivity vs. baseline" icon="globe" color="cyan"/><div className="shock-outputs">{outputs.map((row, i) => <div className="shock-output" key={row.label}><div><GlyphBox name={row.icon} color={row.color}/><span><strong>{row.label}</strong><small>{row.note}</small></span><b className={`ink-${row.color}`}>{changeLabel(values[i], row.unit, 2)}</b></div><div className="impact-track"><motion.span initial={false} animate={{ width: `${Math.min(49, Math.abs(values[i]) * 7)}%` }} className={`ink-${row.color} ${values[i] < 0 ? 'impact-left' : 'impact-right'}`}/></div></div>)}</div><p className="helper-text">First-order scenario, not a fitted forecast. It ignores feedback and timing. CBK rate changes are divided by 100 to convert basis points to percentage points.</p><div className="chip-links"><SourceLink id="mpc" label="CBK policy"/><SourceLink id="fuel" label="EPRA fuel review"/><SourceLink id="cpi" label="KNBS CPI"/></div></section></div>
}
function IndicatorTable({ focus }) {
  const { rows } = useDesk()
  const [region, setRegion] = useState('All')
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(focus?.market || null)
  const focusRef = useRef(null)
  useEffect(() => { if (focus?.market) { setActive(focus.market); focusRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }) } }, [focus])
  const filtered = rows.filter((row) => (region === 'All' || row.region === region) && `${row.name} ${sources[row.source]?.code} ${row.id}`.toLowerCase().includes(query.toLowerCase().trim()))
  const selected = filtered.find((row) => row.id === active)
  return <section className="glass module-card" ref={focusRef}><PanelTitle icon="chart" title="Indicator monitor" subtitle="Dated observations, with reporting periods and sources"/><div className="table-tools"><Tabs options={['All','Kenya','Global']} value={region} onChange={setRegion} label="Indicator region"/><label className="field-search"><Search size={16}/><input aria-label="Filter indicators" placeholder="Filter indicators…" value={query} onChange={(e) => setQuery(e.target.value)}/></label></div>{selected && <div className="indicator-focus" role="status"><div><span className="eyebrow">SELECTED INDICATOR</span><h3>{selected.name} <b>{displayValue(selected)}</b></h3><p>{selected.period || selected.unit} · {dateLabel(selected.asOf)}</p></div><SourceLink id={selected.source} url={selected.url} label="View source"/></div>}
    {filtered.length ? <div className="table-scroll"><table className="data-table"><thead><tr><th>Indicator</th><th>Observation</th><th>Change</th><th>As of</th><th>Source</th></tr></thead><tbody>{filtered.map((row) => <tr key={row.id} className={active === row.id ? 'row-selected' : ''}><td><button type="button" onClick={() => setActive((old) => old === row.id ? null : row.id)}><strong>{row.name}</strong><small>{row.period || row.region}</small></button></td><td className="mono">{displayValue(row)}{['KES','pts'].includes(row.unit) ? ` ${row.unit}` : ''}</td><td>{row.delta === undefined ? '—' : <Delta value={row.delta} unit={row.changeUnit}/>}</td><td className="mono">{dateLabel(row.asOf)}</td><td><a title={sources[row.source]?.name} href={row.url} className="source-tag" target="_blank" rel="noreferrer">{sources[row.source]?.code || row.source} <ExternalLink size={11}/></a></td></tr>)}</tbody></table></div> : <EmptyState icon="chart" title="No indicators match"><p>Try a different search or choose All regions.</p></EmptyState>}
  </section>
}
function EventArchive({ focus }) {
  const { events } = useDesk()
  const [opened, setOpened] = useState(focus?.event || null)
  const [region, setRegion] = useState('All')
  useEffect(() => { if (focus?.event) setOpened(focus.event) }, [focus])
  return <section className="glass module-card"><PanelTitle title="Events &amp; notices" subtitle="Cached summaries with links to the original releases" icon="history" color="cyan"><Tabs options={['All','Kenya','Global']} value={region} onChange={setRegion} label="Event region"/></PanelTitle><div className="accordion">{events.filter((e) => region === 'All' || region === e.region).map((event) => <article className="accordion-item" key={event.id}><button type="button" aria-expanded={opened === event.id} aria-controls={`event-${event.id}`} className="accordion-trigger" onClick={() => setOpened(opened === event.id ? null : event.id)}><GlyphBox name={event.icon} color={event.color}/><span><strong>{event.title}</strong><small>{event.area} · {dateLabel(event.date)} · {sources[event.source].code}</small></span><ChevronDown size={17} className={opened === event.id ? 'rotated' : ''}/></button><AnimatePresence initial={false}>{opened === event.id && <motion.div id={`event-${event.id}`} className="accordion-body" initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}><div><p>{event.detail}</p>{event.impact && <p><strong>Transmission:</strong> {event.impact}</p>}<SourceLink id={event.source} url={event.url} date={event.date}/></div></motion.div>}</AnimatePresence></article>)}</div></section>
}
function SourceDirectory() {
  const { feedMeta, rows, role, toast } = useDesk()
  function exportFeeds() {
    if (role !== 'admin') return
    download('auratrade-market-observations.csv', csv([['id','indicator','value','unit','observed_on','origin','publisher'], ...rows.map((row) => [row.id,row.name,row.value,row.unit,row.asOf,row.origin,row.url])]), 'text/csv;charset=utf-8')
    toast('Market observations exported.')
  }
  return <section className="glass module-card"><PanelTitle title="Publisher directory" subtitle="Select a publisher to verify observations directly" icon="globe" color="cyan">{role === 'admin' && <button type="button" className="button secondary" onClick={exportFeeds}><ArrowDownToLine size={15}/> Export raw rows</button>}</PanelTitle><div className="directory-grid">{feedSources.map((id) => {
    const publisher = sources[id], status = feedMeta?.statuses.find((record) => record.id === id)
    return <a key={id} href={publisher.url} target="_blank" rel="noreferrer" className="publisher"><span className="publisher-icon"><Database size={18}/></span><strong>{publisher.name}</strong><small>{publisher.group} · {status?.asOf ? dateLabel(status.asOf) : status?.state === 'Unavailable' ? 'Feed unavailable; archive retained' : 'Official publisher archive'}</small><ArrowUpRight size={15}/></a>
  })}</div><p className="helper-text">Market observations remain in your device cache if a feed is unavailable. The as-of date is the observation date, not the time you last refreshed.</p></section>
}
export default function MacroEngine({ focus }) {
  const [tab, setTab] = useState(focus?.event ? 'Events & Notices' : 'Indicators')
  const { refresh, refreshing, online } = useDesk()
  useEffect(() => { if (focus?.event) setTab('Events & Notices'); if (focus?.market) setTab('Indicators') }, [focus])
  return <div className="module-page"><SectionHeading eyebrow="ECONOMIC INTELLIGENCE" title="Macro Engine" description="Trace the path from global shocks to the shilling and Kenyan markets." icon="globe"><button type="button" className="button secondary" onClick={() => refresh(true)} disabled={refreshing}><RefreshCw size={16} className={refreshing ? 'spin' : ''}/>{refreshing ? 'Refreshing…' : online ? 'Refresh feeds' : 'Use cached feeds'}</button></SectionHeading><div className="page-tabs"><Tabs options={['Indicators','Shock Lab','Events & Notices','Source Directory']} value={tab} onChange={setTab} label="Macro module"/>{tab === 'Shock Lab' && <span className="subtle-badge"><FlaskConical size={13}/> Scenario mode</span>}</div><motion.div key={tab} className="module-tab" initial={{ opacity: .6, y: 7 }} animate={{ opacity: 1, y: 0 }}>{tab === 'Shock Lab' ? <ShockLab/> : tab === 'Events & Notices' ? <EventArchive focus={focus}/> : tab === 'Source Directory' ? <SourceDirectory/> : <IndicatorTable focus={focus}/>}</motion.div></div>
}
