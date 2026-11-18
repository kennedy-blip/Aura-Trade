import { useMemo, useState } from 'react'
import { ArrowDownToLine, ArrowRight, Bell, Check, Clock3, RefreshCw, Star, Trash2 } from 'lucide-react'
import { useDesk } from '../context/workspace.js'
import { useMarketHistory } from '../context/useMarketHistory.js'
import { CM_LICENSE, CM_SOURCE, hasInstrument, instruments, NSE_VENDOR_URL } from '../data/pulse.js'
import { addMarketRule, markSignalsRead, setRuleEnabled, toggleWatch } from '../db/pulse.js'
import { db } from '../db/index.js'
import { changeLabel, csv, dateLabel, download, num } from '../lib/format.js'
import { marketReview } from '../lib/marketSignals.js'
import { observationTime } from '../lib/pulseResearch.js'
import { EmptyState, PanelTitle, SectionHeading, Select, SourceLink, Tabs } from './common.jsx'
import TrendPlot from './TrendPlot.jsx'

const horizons = { '2H': 7200_000, '1M': 31 * 86400_000, '3M': 93 * 86400_000, '1Y': 365 * 86400_000 }
const timeOnly = (time) => dateLabel(time, { hour: '2-digit', minute: '2-digit', second: '2-digit' }) + ' EAT'
const value = (price, unit) => unit === '%' ? `${num(price)}%` : `${num(price)} ${unit}`
const classOf = (state) => ['Live','Indicative'].includes(state) ? 'is-fresh' : ['Unavailable','Stale','Cached'].includes(state) ? 'is-warn' : ''
function Watchlist({ selected, select }) {
  const { pulse, rows } = useDesk()
  const [group, setGroup] = useState('Watchlist')
  const visible = group === 'Watchlist' ? pulse.watched : Object.keys(instruments).filter((key) => instruments[key].group === group)
  return <section className="glass module-card pulse-watch"><PanelTitle icon="globe" color="cyan" title="Watchlist" subtitle="Choose an instrument to inspect its source and trend."/><Tabs options={['Watchlist', 'Kenya', 'Global', 'Crypto']} value={group} onChange={setGroup} label="Watchlist group"/>
    <ul className="pulse-watch-list" aria-label="Market instruments">{visible.map((id) => {
      const item = instruments[id], q = pulse.quotes.find((row) => row.id === id), ref = rows.find((row) => row.id === id)
      const status = q ? pulse.stateOf(q) : ref ? 'Dated reference' : 'Unavailable'
      const move = q?.change
      return <li key={id}><button type="button" aria-pressed={selected === id} className="pulse-watch-row" onClick={() => select(id)}><span><strong>{item.code}</strong><small>{item.group}</small></span><span className="pulse-watch-price"><strong>{q || ref ? num(q?.price ?? ref.value) : '—'}{item.unit === '%' && (q || ref) ? '%' : ''}</strong><small className={classOf(status)}>{status}{Number.isFinite(move) ? ` · ${changeLabel(move)}` : ''}</small></span></button></li>
    })}</ul>{!visible.length && <p className="helper-text">Choose a market tab, open an instrument and star it to pin it here.</p>}
    <div className="pulse-source-note"><small><strong>Kenya:</strong> CBK and NSE references are dated. <a href={NSE_VENDOR_URL} target="_blank" rel="noreferrer">Licensed NSE feed required for live coverage</a>.</small><small><strong>Crypto:</strong> minute marks, not executable quotes. Coin Metrics Community · <a href={CM_LICENSE} target="_blank" rel="noreferrer">CC BY-NC 4.0</a>.</small></div>
  </section>
}
function Outlook({ data, intraday, item, id, navigate }) {
  const review = useMemo(() => {
    if (!data?.points) return null
    if (!intraday) return marketReview(data.points)
    // Use only the trailing run of distinct contiguous minutes for a technical read.
    const points = data.points
    let start = points.length - 1
    while (start > 0 && Math.floor(Date.parse(points[start][0]) / 60_000) - Math.floor(Date.parse(points[start - 1][0]) / 60_000) === 1) start--
    return marketReview(points.slice(Math.max(0, start)))
  }, [data, intraday])
  return <section className="glass module-card pulse-outlook"><PanelTitle icon="trend" color="violet" title="Conditional outlook" subtitle="A rules-based read of the selected source, not a price prediction."/>
    {!review ? <EmptyState icon="chart" title="Not enough comparable observations">At least 11 {intraday ? 'consecutive minute samples' : 'dated observations'} from one source are needed. No setup is inferred from a few data points.</EmptyState> : <>
      <div className="pulse-setup"><div><small>{data.archived ? 'ARCHIVE ONLY' : 'OBSERVED PATTERN'} · {intraday ? observationTime(review.asOf) : dateLabel(review.asOf)}</small><h3>{review.label}</h3></div><span className="subtle-badge">{review.count} observations</span></div>
      <p className="helper-text">The 5-observation average was {value(review.fast, item.unit)} versus {value(review.slow, item.unit)} over 10 observations. The range excludes the latest reading. A single break does not confirm a trend.</p>
      <div className="outlook-grid">
        <article><small>UPSIDE</small><strong>{value(review.upper, item.unit)}</strong><p>Holding above the prior high could support strength. A return below it weakens that scenario.</p></article>
        <article><small>RANGE</small><strong>{num(review.lower)}–{num(review.upper)}</strong><p>A move back inside this band suggests consolidation or a failed break.</p></article>
        <article><small>DOWNSIDE</small><strong>{value(review.lower, item.unit)}</strong><p>Holding below the prior low could support weakness. A recovery above it weakens that scenario.</p></article>
      </div>
      <div className="pulse-risk"><p><strong>Observed one-period variability:</strong> {num(review.width)}% return standard deviation. Around the last reading this is {num(review.low)}–{num(review.high)} {item.unit}. It is a scale for scenarios, not a confidence interval.</p><p>{review.median === null ? `Only ${review.comparisons} comparable prior setups in this sample. No directional statistic is shown below 8 matches.` : `In this sample, ${review.up} of ${review.comparisons} earlier matches rose on the next observation; median move ${changeLabel(review.median)}. Overlapping examples are not independent. This is not a forecast probability.`}</p></div>
      <div className="actions"><SourceLink url={data.url} label={data.name}/><button className="button secondary" type="button" onClick={() => navigate('research', { question: `Explain the latest available ${item.code} pattern and what would invalidate it. Distinguish the quote from the historical reference.`, agent: 'quant', market: id })}>Discuss with Aura <ArrowRight size={14}/></button></div>
    </>}
  </section>
}
function AlertRules({ id, q }) {
  const { pulse, scope, toast } = useDesk()
  const [type, setType] = useState('price'), [side, setSide] = useState('above'), [target, setTarget] = useState(''), [error, setError] = useState(''), [busy, setBusy] = useState(false)
  const rows = pulse.rules.filter((rule) => rule.instrument === id)
  const fresh = ['Live', 'Indicative'].includes(pulse.stateOf(q))
  async function update(action, success) {
    setError(''); setBusy(true)
    try { await action(); if (success) toast(success) } catch (err) { setError(err.message || 'Alert settings could not be saved.') }
    finally { setBusy(false) }
  }
  return <section className="glass module-card pulse-alert-rules" id="market-alert-rules"><PanelTitle icon="activity" color="amber" title="Market alerts" subtitle="Alerts fire in the foreground, never on an archived or delayed quote."/>
    {!fresh && <p className="pulse-warning">No fresh quote for this instrument. Rules can be saved but will wait for a source.</p>}
    <form className="pulse-rule-form" onSubmit={(e) => { e.preventDefault(); void update(async () => { await addMarketRule(scope, id, type, side, type === 'price' ? Number(target) : null); setTarget('') }, 'Market alert armed.') }}>
      <label>Alert type<Select label="Alert type" options={[{ value: 'price', label: 'Price crossing' }, { value: 'range', label: '10-minute range break' }]} value={type} onChange={setType}/></label>
      {type === 'price' && <><label>Crosses<Select label="Price crossing direction" options={[{value: 'above', label:'Above'}, {value:'below', label:'Below'}]} value={side} onChange={setSide}/></label><label>Target ({instruments[id].unit})<input type="number" required min="0.000001" max="1000000000" step="any" aria-label="Price target" value={target} onChange={(e) => setTarget(e.target.value)} placeholder="Enter level"/></label></>}
      <button className="button primary" type="submit" disabled={busy}><Bell size={15}/> Add alert</button>
    </form>
    <p className="helper-text">{type === 'price' ? 'Price rules notify once when consecutive fresh samples cross your level. The first observation sets the baseline.' : 'Range rules watch for new breaks beyond the preceding 10 sampled minutes. They need contiguous observations from the same source.'} No background push or trade execution.</p>
    {error && <p className="form-error" role="alert">{error}</p>}
    {rows.map((rule) => <div className="pulse-rule" key={rule.id}><div><strong>{rule.type === 'price' ? `${rule.side === 'above' ? 'Cross above' : 'Cross below'} ${value(rule.target, instruments[id].unit)}` : '10-minute range break'}</strong><small>{rule.enabled ? 'Armed' : 'Fired or paused'}</small></div><button type="button" className="button secondary" disabled={busy} onClick={() => update(() => setRuleEnabled(scope, rule.id, !rule.enabled))}>{rule.enabled ? 'Pause' : 'Re-arm'}</button><button type="button" aria-label={`Remove ${rule.type === 'price' ? 'price' : 'range'} alert`} className="icon-button bordered" disabled={busy} onClick={() => update(() => db.marketRules.delete([scope, rule.id]), 'Market alert removed.')}><Trash2 size={15}/></button></div>)}
  </section>
}
function MarketDetail({ id, navigate }) {
  const { pulse, rows, online, scope, toast } = useDesk()
  const item = instruments[id], q = pulse.quotes.find((row) => row.id === id), ref = rows.find((row) => row.id === id)
  const status = q ? pulse.stateOf(q) : ref ? 'Dated reference' : 'Unavailable'
  const watched = pulse.watched.includes(id)
  const [horizon, setHorizon] = useState(item.coin ? '2H' : '1M')
  const intraday = horizon === '2H'
  const { data, status: historyStatus } = useMarketHistory(id, intraday ? '1m' : '1d')
  const end = data?.points?.at(-1)?.[0]
  const points = end ? data.points.filter(([at]) => Date.parse(at) >= Date.parse(end) - horizons[horizon]) : []
  function exportSeries() {
    download(`auratrade-${id}-${horizon.toLowerCase()}.csv`, csv([['observed_at', 'value', 'unit', 'source', 'source_url', 'license'], ...points.map(([at, price]) => [at, price, item.unit, data.name, data.url, data.url === CM_SOURCE ? 'CC BY-NC 4.0' : 'See source terms'])]), 'text/csv;charset=utf-8')
  }
  return <div className="pulse-detail">
    <section className="glass module-card pulse-chart-card"><PanelTitle icon="chart" color="mint" title={item.label} subtitle={`${item.code} · ${item.group}`}><button type="button" className="icon-button bordered pulse-star" aria-label={watched ? 'Remove from watchlist' : 'Add to watchlist'} aria-pressed={watched} onClick={() => toggleWatch(scope, id).catch(() => toast('Watchlist could not be saved.', 'info'))}><Star size={17} fill={watched ? 'currentColor' : 'none'}/></button></PanelTitle>
      <div className="pulse-observation"><div><div className="pulse-quote"><strong>{q || ref ? value(q?.price ?? ref.value, item.unit) : '—'}</strong><span className={`pulse-chip ${classOf(status)}`}>{status}</span></div><div className="pulse-observation-source">{q ? <><Clock3 size={13}/> Observed {observationTime(q.at)} · <SourceLink url={q.url} label={q.source}/></> : ref ? <><Clock3 size={13}/> Observed {dateLabel(ref.asOf)} · <SourceLink id={ref.source} url={ref.url}/></> : <span>No verified observation for this instrument yet.</span>}</div></div>
      <Tabs options={['2H','1M','3M','1Y']} value={horizon} onChange={setHorizon} label="Trend timeframe"/></div>
      {points.length > 1 ? <><TrendPlot key={`${id}:${horizon}`} points={points} label={item.code} intraday={intraday}/><div className="pulse-chart-foot"><span>{data.cadence} · {points.length} points · {data.archived ? 'Archived' : !online || historyStatus === 'unavailable' ? 'Saved series' : 'Dated series'}</span><div><SourceLink url={data.url} label={data.name}/><button type="button" className="text-link" onClick={exportSeries}><ArrowDownToLine size={14}/> CSV</button></div></div></> : <EmptyState icon="chart" title={historyStatus === 'loading' ? 'Loading the sourced series…' : 'No chart for this window yet'}>{intraday ? 'Intraday charts need timestamped observations. Try a daily window, or keep the desk open while a quote source is available.' : 'Daily source history is not available here. Connect a licensed series or choose a different instrument.'}</EmptyState>}
    </section>
    <Outlook data={data} intraday={intraday} item={item} id={id} navigate={navigate}/>
    <AlertRules id={id} q={q}/>
  </div>
}
export default function MarketPulse({ focus, navigate }) {
  const { pulse, online, scope, toast } = useDesk()
  const [selection, setSelection] = useState(null)
  const selected = selection && selection.focus === focus ? selection.id : hasInstrument(focus?.market) ? focus.market : 'btc-usd'
  const unread = pulse.alerts.filter((item) => !item.read).length
  const check = !online ? 'Offline · saved data' : !pulse.available ? 'APK API not configured' : !pulse.foreground ? 'Paused' : pulse.meta.error ? 'Check failed · saved data' : pulse.meta.checked ? `Checked ${timeOnly(pulse.meta.checked)}` : 'Waiting for first check'
  return <div className="module-page pulse-page"><SectionHeading title="Market Pulse" eyebrow="DAILY MARKET COMPANION" description="Track prices, review sourced patterns and watch the levels that matter." icon="activity"><button type="button" className="button secondary" disabled={!online || !pulse.available || pulse.checking} onClick={() => pulse.run(true)}><RefreshCw size={15}/>{pulse.checking ? 'Checking…' : 'Check quotes'}</button></SectionHeading>
    <div className="pulse-status glass"><div><i className={`signal-dot ${!online || pulse.meta.error ? 'off' : ''}`}/><strong>{check}</strong><span>15-second foreground checks; publishers update on their own schedule.</span></div><div className="pulse-status-sources">{pulse.meta.sources.map((source) => <span className="subtle-badge" key={source.id}>{source.id === 'community' ? 'Crypto references' : 'Licensed feed'} · {source.state === 'ok' ? 'Connected' : source.state === 'off' ? 'Not configured' : 'Unavailable'}</span>)}</div></div>
    <div className="pulse-grid"><aside className="pulse-rail"><Watchlist selected={selected} select={(id) => setSelection({ focus, id })}/><section className="glass module-card pulse-inbox" id="market-alerts"><PanelTitle icon="history" color="amber" title="Alert inbox" subtitle={unread ? `${unread} unread · this workspace` : 'Saved on this device'}/>
      {pulse.alerts.length ? <>{pulse.alerts.slice(0, 12).map((alert) => <article key={alert.id} className={`pulse-alert ${alert.read ? '' : 'unread'}`}><strong>{alert.title}</strong><p>{alert.detail}</p><div><small>{observationTime(alert.sourceAt)}</small><SourceLink url={alert.url} label={alert.source}/></div></article>)}{unread > 0 && <button type="button" className="button secondary" onClick={() => markSignalsRead(scope).catch(() => toast('Alerts could not be marked read.', 'info'))}><Check size={14}/> Mark alerts read</button>}</> : <p className="helper-text">Market alerts will land here when a saved rule fires while the app is open.</p>}
    </section></aside><MarketDetail key={selected} id={selected} navigate={navigate}/></div>
  </div>
}
