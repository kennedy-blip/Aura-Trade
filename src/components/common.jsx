import { useEffect, useRef } from 'react'
import { motion } from 'framer-motion'
import { Activity, ArrowDownRight, ArrowUpRight, Banknote, BarChart3, Check, ChevronDown, CircleHelp, ExternalLink, Fuel, Globe2, History, Landmark, Leaf, MessageSquare, Minus, ShieldCheck, Sparkles, Wallet, X } from 'lucide-react'
import { dateLabel, changeLabel, tone } from '../lib/format.js'
import { sources } from '../data/markets.js'

export const glyphs = { activity: Activity, bank: Landmark, chart: BarChart3, fuel: Fuel, globe: Globe2, history: History, message: MessageSquare, trend: ArrowUpRight, leaf: Leaf, money: Banknote, shield: ShieldCheck, sparkle: Sparkles, wallet: Wallet }
export const spring = { type: 'spring', stiffness: 300, damping: 25 }
export function Glyph({ name, size = 16, ...props }) {
  const Icon = glyphs[name] || CircleHelp
  return <Icon size={size} aria-hidden="true" {...props} />
}
export function GlyphBox({ name, color = 'mint', className = '' }) {
  return <span className={`glyph-box ink-${color} ${className}`}><Glyph name={name} /></span>
}
export function Delta({ value, unit = '%', className = '' }) {
  if (!Number.isFinite(value)) return null
  const Icon = value > 0 ? ArrowUpRight : value < 0 ? ArrowDownRight : Minus
  return <span className={`delta ${tone(value)} ${className}`}><Icon size={12} aria-hidden="true"/>{changeLabel(value, unit)}</span>
}
export function SourceLink({ id, url, label, date, className = '' }) {
  const s = sources[id]
  return <a className={`source-link ${className}`} href={url || s?.url} target="_blank" rel="noreferrer">{label || s?.name || 'Primary source'}{date && <span> · {dateLabel(date)}</span>}<ExternalLink size={12} aria-hidden="true"/></a>
}
export function SectionHeading({ eyebrow, title, description, children, icon }) {
  return <header className="page-heading"><div>{eyebrow && <div className="page-eyebrow">{icon && <Glyph name={icon} size={14}/>} {eyebrow}</div>}<h1>{title}</h1>{description && <p>{description}</p>}</div>{children && <div className="heading-actions">{children}</div>}</header>
}
export function PanelTitle({ icon, color, title, subtitle, children }) {
  return <div className="panel-heading"><div className="panel-heading-title">{icon && <GlyphBox name={icon} color={color}/>}<div><h2>{title}</h2>{subtitle && <p>{subtitle}</p>}</div></div>{children}</div>
}
export function Modal({ title, description, close, children, className = '' }) {
  const ref = useRef(null)
  useEffect(() => {
    const dialog = ref.current
    const previous = document.activeElement
    dialog.showModal()
    return () => { if (dialog.open) dialog.close(); if (previous instanceof HTMLElement && previous.isConnected) previous.focus() }
  }, [])
  return <dialog ref={ref} aria-label={title} className={`modal ${className}`} onCancel={(event) => { event.preventDefault(); close() }} onClick={(event) => { if (event.currentTarget === event.target) close() }}>
    <motion.div className="modal-inner" initial={{ opacity: 0, scale: 0.97, y: 8 }} animate={{ opacity: 1, scale: 1, y: 0 }} transition={spring}>
      <div className="modal-header"><div><h2>{title}</h2>{description && <p>{description}</p>}</div><button type="button" className="icon-button" onClick={close} aria-label="Close dialog"><X size={19}/></button></div>
      {children}
    </motion.div>
  </dialog>
}
export function Tabs({ options, value, onChange, label, className = '' }) {
  return <div className={`tabs ${className}`} role="group" aria-label={label}>{options.map((option) => {
    const key = typeof option === 'string' ? option : option.value
    return <button type="button" key={key} aria-pressed={value === key} className={value === key ? 'selected' : ''} onClick={() => onChange(key)}>{typeof option === 'string' ? option : option.label}</button>
  })}</div>
}
export function Select({ options, value, onChange, label, className = '' }) {
  return <span className={`select-wrap ${className}`}><select aria-label={label} value={value} onChange={(e) => onChange(e.target.value)}>{options.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select><ChevronDown size={13} aria-hidden="true"/></span>
}
export function EmptyState({ icon = 'history', title, children }) {
  return <div className="empty-state"><GlyphBox name={icon} color="cyan"/><strong>{title}</strong>{children && <div>{children}</div>}</div>
}
export function CheckBox({ checked, onChange, children }) {
  return <label className="checkline"><input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)}/><span className="check-box" aria-hidden="true"><Check size={12}/></span><span>{children}</span></label>
}
