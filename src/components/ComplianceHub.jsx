import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { motion } from 'framer-motion'
import { ArrowDownToLine, Calculator, ExternalLink, ShieldCheck } from 'lucide-react'
import { useDesk } from '../context/workspace.js'
import { db } from '../db/index.js'
import { directory, kra, taxModes } from '../data/compliance.js'
import { api } from '../lib/client.js'
import { dateLabel, download, money } from '../lib/format.js'
import { taxEstimate } from '../lib/models.js'
import { CheckBox, GlyphBox, PanelTitle, SectionHeading, Select, SourceLink, Tabs } from './common.jsx'

const taxes = Object.entries(taxModes).map(([value, item]) => ({ value, label: item.label }))
function TaxEstimator() {
  const [mode, setMode] = useState('capital')
  const [form, setForm] = useState({ proceeds: '150000', cost: '100000', expenses: '5000', value: '5000' })
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')
  const tax = taxModes[mode]
  function calculate(e) {
    e.preventDefault(); setError('')
    try { setResult(taxEstimate(mode, form)) } catch (err) { setResult(null); setError(err.message) }
  }
  return <div className="module-grid"><section className="glass module-card"><PanelTitle icon="money" color="amber" title="KRA tax estimator" subtitle="Educational calculation, not a filing or assessment"/><form className="stack-form" onSubmit={calculate}><label>Tax calculation<Select label="Tax calculation" value={mode} options={taxes} onChange={(value) => { setMode(value); setResult(null); setError('') }}/></label>{tax.fields.map(([field, label]) => <label key={field}>{label} (KES)<input type="number" value={form[field]} min="0" max="1000000000000" step=".01" required onChange={(e) => { setForm({ ...form, [field]: e.target.value }); setResult(null) }}/></label>)}{error && <p className="form-error" role="alert">{error}</p>}<button type="submit" className="button primary"><Calculator size={16}/> Calculate estimate</button></form></section><section className="glass module-card"><PanelTitle icon="shield" title="Calculation basis" subtitle={tax.rate} color="violet"/><p className="helper-text">{tax.note}</p>{result ? <div className="tax-result" role="status"><span className="eyebrow">ESTIMATED AMOUNT</span><strong>{money(result.tax)}</strong><p>{mode === 'capital' ? 'Eligible net gain' : 'Applicable base'}: <b>{money(result.base)}</b> · {result.rate * 100}%</p>{result.base < 0 && <small>No positive gain in this example. Loss offsets and reliefs are not modeled.</small>}</div> : <div className="tax-result"><span className="eyebrow">ESTIMATED AMOUNT</span><strong>—</strong><p>Enter KES amounts and calculate to see the estimate.</p></div>}<div className="chip-links"><SourceLink url={kra[mode]} label="Read KRA guidance"/><SourceLink url="https://itax.kra.go.ke/" label="KRA iTax"/></div></section></div>
}
function RegulatoryDirectory() {
  const [filter, setFilter] = useState('All')
  const { scope, toast } = useDesk()
  const checks = useLiveQuery(() => db.compliance.where('scope').equals(scope).toArray(), [scope], [])
  const filters = ['All', ...directory.map((item) => item.area)]
  return <><div className="toolbar"><Tabs label="Regulator topic" options={filters} value={filter} onChange={setFilter}/></div><div className="module-grid">{directory.filter((item) => filter === 'All' || item.area === filter).map((item) => {
    const checked = checks.find((record) => record.id === item.id)?.checked || []
    return <section className="glass module-card regulator-card" key={item.id}><PanelTitle icon="shield" color={item.color} title={item.title} subtitle={item.name}><span className={`source-tag ink-${item.color}`}>{item.code}</span></PanelTitle><p>{item.summary}</p><div className="regulator-status"><span className="subtle-badge">{item.status}</span><small>Reference checked {dateLabel(item.checked)}</small></div><div className="checklist"><div className="eyebrow">REVIEW CHECKLIST <span>{checked.length}/{item.checks.length}</span></div>{item.checks.map((label, index) => <CheckBox key={label} checked={checked.includes(index)} onChange={async (value) => {
      try { await db.transaction('rw', db.compliance, async () => { const current = (await db.compliance.get([scope, item.id]))?.checked || []; await db.compliance.put({ scope, id: item.id, checked: value ? [...new Set([...current, index])] : current.filter((n) => n !== index), reviewedAt: new Date().toISOString() }) }) } catch { toast('Checklist change could not be saved.', 'info') }
    }}>{label}</CheckBox>)}</div><div className="chip-links"><a className="text-link" href={item.url} target="_blank" rel="noreferrer">Open official reference <ExternalLink size={13}/></a>{item.notice && <SourceLink {...item.notice}/>}</div></section>
  })}</div></>
}
export default function ComplianceHub() {
  const { scope, role, previewRoles, session, toast } = useDesk()
  const [tab, setTab] = useState('Directory')
  const [busy, setBusy] = useState(false)
  async function exportAudit() {
    if (role !== 'admin' || busy) return
    setBusy(true)
    try {
      const authoritative = previewRoles ? { generatedAt: new Date().toISOString(), directory, mode: 'Local preview' } : await api('audit', { token: session?.access_token, timeout: 12500 })
      const checklist = (await db.compliance.where('scope').equals(scope).toArray()).map(({ id, checked, reviewedAt }) => ({ id, checked, reviewedAt }))
      download('auratrade-compliance-review.json', JSON.stringify({ ...authoritative, checklist }, null, 2))
      toast('Compliance review exported.')
    } catch (err) { toast(err.message, 'info') } finally { setBusy(false) }
  }
  return <div className="module-page"><SectionHeading title="Compliance Hub" description="Verify Kenyan regulatory requirements and document your review." eyebrow="GOVERNANCE &amp; TAX" icon="shield">{role === 'admin' && <button type="button" className="button secondary" disabled={busy} onClick={exportAudit}><ArrowDownToLine size={16}/>{busy ? 'Preparing…' : 'Export audit'}</button>}</SectionHeading><div className="page-tabs"><Tabs label="Compliance mode" options={['Directory','Tax estimator']} value={tab} onChange={setTab}/><span className="subtle-badge"><ShieldCheck size={14}/> Kenyan jurisdiction</span></div><motion.div className="module-tab" key={tab} initial={{ opacity: .6, y: 6 }} animate={{ opacity: 1, y: 0 }}>{tab === 'Directory' ? <RegulatoryDirectory/> : <TaxEstimator/>}</motion.div><p className="helper-text module-disclaimer">Review checklists are not a licence, legal opinion, or evidence of compliance on their own. Verify current requirements with the relevant authority.</p></div>
}
