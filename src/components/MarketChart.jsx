import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { BarChart3, Maximize2, TrendingDown, TrendingUp } from 'lucide-react'
import { motion } from 'framer-motion'
import { series } from '../data/markets.js'
import { changeLabel, dateLabel, num } from '../lib/format.js'
import { GlyphBox, Modal, Select, Tabs } from './common.jsx'

const spans = { '1W': 7, '2W': 14, '1M': 31, '3M': 93, 'All': Infinity }
const products = Object.entries(series).map(([value, item]) => ({ value, label: item.code }))
export function Sparkline({ values, color = 'mint' }) {
  const id = useId(), min = Math.min(...values), max = Math.max(...values), spread = max - min || 1
  const points = values.map((value, i) => `${(i / (values.length - 1) * 88 + 1).toFixed(2)} ${((max - value) / spread * 23 + 4).toFixed(2)}`).join(' ')
  return <svg className={`sparkline ink-${color}`} viewBox="0 0 90 34" aria-hidden="true"><defs><linearGradient id={id} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="currentColor" stopOpacity=".31"/><stop offset="1" stopColor="currentColor" stopOpacity="0"/></linearGradient></defs><polygon points={`1 34 ${points} 89 34`} fill={`url(#${id})`}/><polyline points={points} fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" strokeLinecap="round"/></svg>
}
function useWidth(ref) {
  const [width, setWidth] = useState(640)
  useEffect(() => {
    const ro = new ResizeObserver(([entry]) => setWidth(Math.max(240, Math.round(entry.contentRect.width))))
    if (ref.current) ro.observe(ref.current)
    return () => ro.disconnect()
  }, [ref])
  return width
}
function axisStep(raw) {
  const band = 10 ** Math.floor(Math.log10(raw))
  return ([1, 2, 2.5, 5, 10].find((n) => n >= raw / band) || 10) * band
}
const axisDate = { day: 'numeric', month: 'short' }
function PricePlot({ data, config, large }) {
  const id = useId(), ref = useRef(null), width = useWidth(ref)
  const [hover, setHover] = useState(null)
  const height = large ? 345 : 207
  const left = 3, right = width - (width < 400 ? 53 : 67), top = 10, bottom = height - 30
  const min = Math.min(...data.map((row) => row[config.index]))
  const max = Math.max(...data.map((row) => row[config.index]))
  const step = axisStep((max - min || 0.04) / 4), floor = Math.floor((min - step * 0.18) / step) * step, ceil = Math.ceil((max + step * 0.18) / step) * step
  const ticks = Array.from({ length: Math.min(8, Math.round((ceil - floor) / step) + 1) }, (_, i) => ceil - i * step)
  const points = data.map((row, i) => ({ x: left + (right - left) * i / (data.length - 1), y: top + (ceil - row[config.index]) / (ceil - floor) * (bottom - top), v: row[config.index], d: row[0], volume: row[4] }))
  const line = points.map((p, i) => `${i ? 'L' : 'M'}${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(' ')
  const last = points.at(-1), first = points[0]
  const selected = points[hover] || null
  const labelCount = Math.min(data.length, width < 430 ? 4 : 6)
  const xTicks = [...new Set(Array.from({ length: labelCount }, (_, i) => Math.round(i / (labelCount - 1) * (points.length - 1))))]
  const axisDigits = config.code === 'USD/KES' ? 2 : config.index === 1 && !config.volume ? 3 : step >= 1 ? 0 : 1
  function pointer(event) {
    const rect = event.currentTarget.getBoundingClientRect()
    setHover(Math.min(points.length - 1, Math.max(0, Math.round(((event.clientX - rect.left) / rect.width * width - left) / (right - left) * (points.length - 1)))))
  }
  return <div className={`price-plot ink-${config.color}`} ref={ref} tabIndex={0} aria-label={`${config.name} chart. Use the left and right arrow keys to review observations.`} onBlur={() => setHover(null)} onKeyDown={(e) => {
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') { e.preventDefault(); setHover((i) => Math.max(0, Math.min(points.length - 1, (i ?? points.length - 1) + (e.key === 'ArrowLeft' ? -1 : 1)))) }
    if (e.key === 'Escape') setHover(null)
  }}><svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden="true" onPointerMove={pointer} onPointerLeave={() => setHover(null)}><defs><linearGradient id={id} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="currentColor" stopOpacity=".24"/><stop offset="1" stopColor="currentColor" stopOpacity=".012"/></linearGradient></defs>
      {ticks.map((tick) => { const y = top + (ceil - tick) / (ceil - floor) * (bottom - top); return <g key={tick}><line className="gridline" x1={left} x2={right} y1={y} y2={y}/><text className="axis-text" x={width - 3} y={y + 4} textAnchor="end">{num(tick, axisDigits)}</text></g> })}
      {xTicks.map((i, j) => <g key={i}><line className="gridline vertical" x1={points[i].x} x2={points[i].x} y1={top} y2={bottom}/><text className="axis-text" x={points[i].x} y={height - 8} textAnchor={j === 0 ? 'start' : j === xTicks.length - 1 ? 'end' : 'middle'}>{dateLabel(points[i].d, axisDate)}</text></g>)}
      <path d={`${line} L${last.x},${bottom} L${first.x},${bottom} Z`} fill={`url(#${id})`}/>
      {config.volume && points.map((p, i) => { const size = Math.min(29, Math.log10(1 + p.volume) * 6.3); return <rect key={p.d} x={p.x - Math.min(6, (right - left) / points.length * .22)} y={bottom - size} width={Math.min(12, (right - left) / points.length * .44)} height={size} rx="1.5" fill={i === 0 || p.v >= points[i - 1].v ? 'currentColor' : 'var(--negative)'} opacity=".27"/> })}
      <path d={line} fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round"/>
      <circle cx={last.x} cy={last.y} r="7.5" fill="currentColor" opacity=".18"/><circle cx={last.x} cy={last.y} r="3.2" fill="currentColor"/>
      {selected && <g><line className="crosshair" x1={selected.x} x2={selected.x} y1={top} y2={bottom}/><circle cx={selected.x} cy={selected.y} r="5" fill="currentColor" stroke="var(--panel)" strokeWidth="2"/></g>}
    </svg>{selected && <div className="chart-tooltip" style={{ left: Math.min(width - 130, Math.max(2, selected.x - 57)), top: Math.max(0, selected.y - 66) }}><span>{dateLabel(selected.d)}</span><strong>{num(selected.v, config.digits)}{config.code === '91D T-Bill' ? '%' : ''}</strong></div>}<span className="sr-only" aria-live="polite">{selected ? `${dateLabel(selected.d)}: ${num(selected.v, config.digits)}` : ''}</span></div>
}
function ChartBody({ product, range, onRange, large }) {
  const config = series[product]
  const data = useMemo(() => {
    const min = Date.parse(config.columns.at(-1)[0]) - spans[range] * 86400000
    const rows = config.columns.filter((item) => Date.parse(item[0]) >= min)
    return rows.length < 2 ? config.columns.slice(-2) : rows
  }, [config, range])
  const end = data.at(-1)[config.index], previous = config.columns.at(-2)[config.index]
  const change = product === 'tbill' ? (end - previous) * 100 : (end / previous - 1) * 100
  const units = product === 'tbill' ? '%' : ''
  const ChangeIcon = change >= 0 ? TrendingUp : TrendingDown
  const options = product === 'tbill' ? ['1M', '3M', 'All'] : ['1W', '2W', '1M']
  return <><div className="chart-controls"><div className="chart-value"><strong>{num(end, config.digits)}{units}</strong><span className={`change-pill ${change >= 0 ? 'positive' : 'negative'}`} title="Change from the previous recorded observation"><ChangeIcon size={13}/>{changeLabel(change, product === 'tbill' ? 'bps' : '%')}</span><span className="chart-period">{product === 'tbill' ? 'vs. prior auction' : 'vs. prior close'}</span></div><Tabs options={options} value={range} onChange={onRange} label="Chart timeframe" className="range-tabs"/></div>
  <motion.div key={`${product}:${range}`} initial={{ opacity: 0.45 }} animate={{ opacity: 1 }} transition={{ duration: 0.26 }}><PricePlot data={data} config={config} large={large}/></motion.div><div className="chart-foot"><a href={config.url} target="_blank" rel="noreferrer"><i className="signal-dot"/> {product === 'tbill' ? 'CBK auction archive' : 'Historical market data'}</a><span>{product === 'tbill' ? 'Annual yield' : config.volume ? <><BarChart3 size={12}/> Volume</> : 'Official reference rate'}<i/> EAT (UTC+3)</span></div></>
}
export default function MarketChart({ focus }) {
  const init = Object.hasOwn(series, focus?.market) ? focus.market : 'nse20'
  const [product, setProduct] = useState(init)
  const [range, setRange] = useState('1M')
  const [expanded, setExpanded] = useState(false)
  const ref = useRef(null)
  useEffect(() => { if (focus?.market && Object.hasOwn(series, focus.market)) { setProduct(focus.market); setRange('1M'); ref.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }) } }, [focus])
  const config = series[product]
  return <section className="glass chart-card" ref={ref} aria-label="Market chart"><header className="chart-head"><div className="panel-heading-title"><GlyphBox name="activity" color={config.color}/><div><h2>{config.name}</h2><p>{config.subtitle}</p></div></div><div className="chart-head-tools"><Select options={products} value={product} onChange={(next) => { setProduct(next); setRange('1M') }} label="Chart instrument"/><button type="button" className="icon-button bordered" onClick={() => setExpanded(true)} aria-label="Expand chart"><Maximize2 size={15}/></button></div></header>
    <ChartBody product={product} range={range} onRange={setRange}/>
    {expanded && <Modal title={config.name} description={config.subtitle} className="chart-modal" close={() => setExpanded(false)}><ChartBody product={product} range={range} onRange={setRange} large/></Modal>}
  </section>
}
