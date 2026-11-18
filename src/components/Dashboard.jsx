import { useState } from 'react'
import { ArrowDownUp, ArrowRight, ArrowUpRight, ChevronRight, Clock3, CornerDownLeft, Gauge, Globe2, Layers3, MapPin, Radio, Send, Sparkles } from 'lucide-react'
import { useDesk } from '../context/workspace.js'
import { cpiSeries, prompts, series, sources } from '../data/markets.js'
import { dateLabel, displayValue } from '../lib/format.js'
import { Delta, Glyph, GlyphBox, PanelTitle, SourceLink, Tabs } from './common.jsx'
import MarketChart, { Sparkline } from './MarketChart.jsx'

const metricStyles = [
  { id: 'usd-kes', label: 'USD / KES', color: 'cyan', icon: ArrowDownUp, values: series['usd-kes'].columns.map((r) => r[1]), detail: 'CBK reference rate' },
  { id: 'nse20', label: 'NSE 20 Index', color: 'mint', icon: Layers3, values: series.nse20.columns.slice(-14).map((r) => r[1]), detail: 'Nairobi Securities Exchange' },
  { id: 'cbr', label: 'CBK Policy Rate', color: 'violet', icon: Gauge, values: [11.25,10.75,10,9.75,9.5,9.25,9,8.75,8.75,8.75,8.75], detail: 'Central Bank of Kenya' },
  { id: 'cpi', label: 'Kenya Inflation', color: 'amber', icon: Radio, values: cpiSeries, detail: 'Headline CPI · year on year' },
]
function Hero({ navigate }) {
  return <section className="hero"><div className="hero-art"/><div className="hero-grid"/><div className="hero-content"><div className="hero-eyebrow"><span className="signal-dot"/> EAST AFRICA INTELLIGENCE DESK</div><h1>Market Terminal</h1><p>Global signals. Kenyan context. One research terminal.</p><div className="hero-actions"><button type="button" className="button primary" onClick={() => navigate('markets')}>Open Market Pulse <ArrowUpRight size={15}/></button><button type="button" className="button hero-secondary" onClick={() => navigate('research')}><Sparkles size={15}/> Ask Aura AI</button></div></div><div className="hero-location"><MapPin size={12}/><span>NAIROBI, KENYA</span></div></section>
}
function Metrics({ navigate }) {
  const { rows } = useDesk()
  return <section className="metrics-section" aria-label="Market overview"><div className="section-line"><h2>Market Overview</h2><span className="snapshot-label"><i/> Dated market snapshot</span></div><div className="metric-grid">{metricStyles.map(({ id, label, color, icon: Icon, values, detail }) => {
    const row = rows.find((item) => item.id === id)
    return <button key={id} type="button" className="glass metric-card" onClick={() => navigate(id === 'nse20' || id === 'usd-kes' ? 'terminal' : 'macro', { market: id })} aria-label={`${label}: ${displayValue(row)}, ${dateLabel(row.asOf)}. View indicator.`}><span className="metric-top"><span className={`glyph-box ink-${color}`}><Icon size={16} strokeWidth={1.9}/></span><span className="metric-label">{label}</span><ArrowUpRight className="metric-arrow" size={14}/></span><span className="metric-main"><strong>{displayValue(row)}</strong><Delta value={row.delta} unit={row.changeUnit}/></span><span className="metric-detail">{detail}</span><Sparkline values={values} color={color}/></button>
  })}</div></section>
}
function ResearchDesk({ navigate }) {
  const [question, setQuestion] = useState('')
  return <section className="glass research-card" aria-label="Aura Research"><PanelTitle icon="sparkle" color="violet" title="Aura Research" subtitle="Multi-agent intelligence"><span className="ai-badge"><i/> AI DESK</span></PanelTitle><div className="research-feature"><div className="brief-kicker"><Sparkles size={12}/> DESK BRIEF <span>· 13 NOV</span></div><h3>Steady shilling, shifting signals</h3><p>Oil moved lower as the shilling held steady. Trace the impact on local rates and import costs.</p><button type="button" onClick={() => navigate('research', { question: 'What’s driving USD/KES?', agent: 'macro' })}>Read analysis <ArrowRight size={13}/></button></div><div className="suggestion-title">SUGGESTED QUESTIONS</div><div className="suggested-list">{prompts.map((item) => <button key={item.text} type="button" onClick={() => navigate('research', { question: item.text, agent: item.agent })}><Glyph name={item.icon} size={14}/><span>{item.text}</span><ChevronRight size={14}/></button>)}</div><form className="mini-prompt" onSubmit={(e) => { e.preventDefault(); if (question.trim()) navigate('research', { question: question.trim(), agent: 'auto' }) }}><label className="sr-only" htmlFor="terminal-question">Ask Aura AI</label><input id="terminal-question" value={question} onChange={(e) => setQuestion(e.target.value)} maxLength={1800} placeholder="Ask about Kenyan markets…"/><button type="submit" aria-label="Send to Aura Research" title="Send to Aura Research"><Send size={16}/></button></form></section>
}
function Briefing({ navigate }) {
  const { events } = useDesk()
  const [filter, setFilter] = useState('All')
  return <section className="glass briefing-card"><PanelTitle icon="history" color="cyan" title="Market Briefing" subtitle="Recent releases and events"><Tabs options={['All','Kenya','Global']} value={filter} onChange={setFilter} label="Briefing region"/></PanelTitle><div className="briefing-list">{events.filter((event) => filter === 'All' || event.region === filter).slice(0, 4).map((event) => <button type="button" className="event-row" key={event.id} onClick={() => navigate('macro', { event: event.id })}><GlyphBox name={event.icon} color={event.color}/><span className="event-row-text"><strong>{event.title}</strong><small>{sources[event.source].code} · {event.area}</small></span><time dateTime={event.date}>{dateLabel(event.date, { month: 'short', day: 'numeric' })}</time><ChevronRight size={15}/></button>)}</div></section>
}
function Benchmarks({ navigate }) {
  const { rows } = useDesk()
  const tbill = rows.find((row) => row.id === 'tbill')
  return <section className="glass benchmark-card"><PanelTitle title="Local Benchmarks" subtitle="Annualized comparison" icon="bank" color="mint"/><div className="benchmark-row"><span>91-day Treasury bill<small>{dateLabel(tbill.asOf)}</small></span><strong>{displayValue(tbill)}</strong></div><div className="benchmark-row"><span>MMF scenario<small>Illustrative · not a quote</small></span><strong>10.40%</strong></div><button type="button" className="text-link" onClick={() => navigate('paper')}>Open paper simulator <ArrowRight size={14}/></button></section>
}
function PulseShortcut({ navigate }) {
  const { pulse } = useDesk()
  const alert = pulse.alerts.find((row) => !row.read)
  const any = pulse.quotes.some((row) => ['Live', 'Indicative'].includes(pulse.stateOf(row)))
  return <button type="button" className="glass pulse-shortcut" onClick={() => navigate('markets', alert ? { market: alert.instrument } : null)}><GlyphBox name="activity" color="mint"/><span><strong>{alert?.title || 'Market Pulse'}</strong><small>{alert ? 'New market alert · view observation and source' : any ? 'Fresh reference data · trends, watchlist and price alerts' : '15-second checks · sourced history and price alerts'}</small></span><ArrowRight size={17}/></button>
}
export default function Dashboard({ navigate, focus }) {
  return <div className="dashboard"><Hero navigate={navigate}/><Metrics navigate={navigate}/><PulseShortcut navigate={navigate}/><div className="dashboard-grid"><div className="dashboard-column"><MarketChart focus={focus}/><Briefing navigate={navigate}/></div><div className="dashboard-column"><ResearchDesk navigate={navigate}/><Benchmarks navigate={navigate}/></div></div><div className="dash-source"><span><Clock3 size={13}/> Observations are dated, not a real-time price feed.</span><SourceLink id="cbk" label="CBK source archive"/><button type="button" className="text-link" onClick={() => navigate('macro')}><Globe2 size={13}/> Explore data sources <CornerDownLeft size={12}/></button></div></div>
}
