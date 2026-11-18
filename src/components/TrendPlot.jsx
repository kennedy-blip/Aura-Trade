import { useEffect, useId, useRef, useState } from 'react'
import { dateLabel, num } from '../lib/format.js'
import { observationTime } from '../lib/pulseResearch.js'

export default function TrendPlot({ points, label, intraday }) {
  const id = useId(), ref = useRef(null)
  const [width, setWidth] = useState(740), [selected, setSelected] = useState(null)
  useEffect(() => {
    const observer = new ResizeObserver(([item]) => setWidth(Math.max(270, Math.round(item.contentRect.width))))
    if (ref.current) observer.observe(ref.current)
    return () => observer.disconnect()
  }, [])
  const height = 227, left = 5, right = width - (width <= 450 ? 64 : 77), top = 13, bottom = height - 33
  const x0 = Date.parse(points[0][0]), x1 = Date.parse(points.at(-1)[0])
  const prices = points.map((point) => point[1])
  const min = Math.min(...prices), max = Math.max(...prices), margin = Math.max((max - min) * .12, max / 10_000)
  const low = min - margin, high = max + margin
  const y = (value) => top + (bottom - top) * (high - value) / (high - low)
  const scaleX = (ratio) => left + ratio * (right - left)
  const axisDate = intraday ? { hour: '2-digit', minute: '2-digit' } : { day: 'numeric', month: 'short' }
  const plot = points.map(([time, value]) => ({ time, value, x: scaleX((Date.parse(time) - x0) / Math.max(1, x1 - x0)), y: y(value) }))
  function gap(i) { return i > 0 && intraday && Math.floor(Date.parse(plot[i].time) / 60_000) - Math.floor(Date.parse(plot[i-1].time) / 60_000) > 1 }
  const segments = []
  for (let i = 0; i < plot.length; i++) {
    if (i === 0 || gap(i)) segments.push([])
    segments.at(-1).push(plot[i])
  }
  const line = (items) => items.map((row, i) => `${i === 0 ? 'M' : 'L'} ${row.x.toFixed(2)} ${row.y.toFixed(2)}`).join(' ')
  const selectedPoint = plot[selected] || plot.at(-1)
  const dividerCount = width < 475 ? 3 : 5
  const keyFormat = intraday ? observationTime : dateLabel
  const digits = max - min < 1 ? 3 : max - min < 10 ? 2 : 1
  return <div className="pulse-plot" ref={ref} tabIndex={0} role="group" aria-label={`${label} price history. Use left and right arrow keys to inspect observations.`} onBlur={() => setSelected(null)} onKeyDown={(event) => {
    if (!['ArrowLeft','ArrowRight','Home','End','Escape'].includes(event.key)) return
    event.preventDefault()
    setSelected((i) => event.key === 'Escape' ? null : event.key === 'Home' ? 0 : event.key === 'End' ? plot.length - 1 : Math.max(0, Math.min(plot.length - 1, (i ?? plot.length - 1) + (event.key === 'ArrowLeft' ? -1 : 1))))
  }}>
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden="true" onPointerLeave={() => setSelected(null)} onPointerMove={(event) => {
      const r = event.currentTarget.getBoundingClientRect(), px = (event.clientX - r.left) * width / r.width
      setSelected(plot.reduce((best, row, i) => Math.abs(row.x - px) < Math.abs(plot[best].x - px) ? i : best, 0))
    }}><defs><linearGradient id={id} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="currentColor" stopOpacity=".23"/><stop offset="1" stopColor="currentColor" stopOpacity="0"/></linearGradient></defs>
      {Array.from({ length: 5 }, (_, i) => high - i * (high - low) / 4).map((value) => <g key={value}><line x1={left} x2={right} y1={y(value)} y2={y(value)} className="gridline"/><text x={width-3} y={y(value)+4} textAnchor="end" className="axis-text">{num(value, digits)}</text></g>)}
      {Array.from({ length: dividerCount + 1 }, (_, i) => i / dividerCount).map((ratio, i) => <g key={ratio}><line x1={scaleX(ratio)} x2={scaleX(ratio)} y1={top} y2={bottom} className="gridline vertical"/><text x={scaleX(ratio)} y={height-10} className="axis-text" textAnchor={i === 0 ? 'start' : i === dividerCount ? 'end' : 'middle'}>{dateLabel(x0 + ratio * (x1 - x0), axisDate)}</text></g>)}
      {segments.map((items) => <g key={items[0].time}>{items.length > 1 ? <><path d={`${line(items)} L ${items.at(-1).x} ${bottom} L ${items[0].x} ${bottom} Z`} fill={`url(#${id})`}/><path d={line(items)} fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round"/></> : <circle cx={items[0].x} cy={items[0].y} r="2" fill="currentColor"/>}</g>)}
      <line className="crosshair" x1={selectedPoint.x} x2={selectedPoint.x} y1={top} y2={bottom}/><circle cx={selectedPoint.x} cy={selectedPoint.y} r="4.5" fill="currentColor" stroke="var(--panel)" strokeWidth="2"/>
    </svg><div className="pulse-plot-caption"><span>{keyFormat(selectedPoint.time)}</span><strong>{num(selectedPoint.value, digits)}</strong><span className="sr-only" aria-live="polite">{selected === null ? '' : `${keyFormat(selectedPoint.time)}: ${num(selectedPoint.value, digits)}`}</span></div>
  </div>
}
