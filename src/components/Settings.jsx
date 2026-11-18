import { useEffect, useState } from 'react'
import { ArrowDownToLine, Database, Download, LogIn, LogOut, ShieldCheck, Smartphone, Trash2 } from 'lucide-react'
import { useDesk } from '../context/workspace.js'
import { clearLocalWorkspace, db } from '../db/index.js'
import { supabase } from '../lib/client.js'
import { baseline, agentDefaults } from '../lib/models.js'
import { download } from '../lib/format.js'
import { GlyphBox, Modal, PanelTitle, SectionHeading, Select } from './common.jsx'
import RoleSwitcher from './RoleSwitcher.jsx'
import ThemeToggle from './ThemeToggle.jsx'
import ResearchConnection from './ResearchConnection.jsx'

const modelFields = { cpiFuel: 'CPI sensitivity to fuel', fxFuel: 'USD/KES sensitivity to fuel', fxRate: 'USD/KES sensitivity to CBR', equityRate: 'Industrials sensitivity to CBR', equityFuel: 'Industrials sensitivity to fuel' }
function DeskConfig() {
  const { settings, saveDesk, toast, previewRoles } = useDesk()
  const [form, setForm] = useState(settings)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  useEffect(() => setForm(settings), [settings])
  return <section className="glass module-card"><PanelTitle title="Lead Analyst controls" icon="activity" subtitle={previewRoles ? 'Local sandbox model settings' : 'Authenticated desk configuration'}/><form className="stack-form" onSubmit={async (e) => {
    e.preventDefault(); setBusy(true); setError('')
    try { await saveDesk({ model: Object.fromEntries(Object.entries(form.model).map(([key, value]) => [key, typeof value === 'string' && !value.trim() ? NaN : Number(value)])), agent: form.agent }); toast('Desk configuration saved.') } catch (err) { setError(err.message) } finally { setBusy(false) }
  }}><div className="settings-coefficients">{Object.entries(modelFields).map(([key, label]) => <label key={key}>{label}<input required type="number" min="-5" max="5" step=".001" value={form.model[key]} onChange={(e) => setForm({ ...form, model: { ...form.model, [key]: e.target.value } })}/></label>)}</div><label>Hosted research depth<Select label="Hosted research depth" options={['Concise','Standard','Detailed'].map((x) => ({ value: x, label: x }))} value={form.agent.detail} onChange={(detail) => setForm({ ...form, agent: { ...form.agent, detail } })}/></label><label>Optional hosted research guidance<textarea rows={3} maxLength={500} placeholder="Example: Clarify monetary vs. fiscal transmission." value={form.agent.scope} onChange={(e) => setForm({ ...form, agent: { ...form.agent, scope: e.target.value } })}/></label>{error && <p className="form-error" role="alert">{error}</p>}<div className="actions"><button type="submit" className="button primary" disabled={busy}>Save configuration</button><button type="button" className="button secondary" onClick={() => { setForm({ model: baseline, agent: agentDefaults }); setError('') }}>Restore defaults in form</button></div></form></section>
}
function Account() {
  const { session, identity, online, toast } = useDesk()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  async function action() {
    setBusy(true); setError('')
    try {
      const result = session ? await supabase.auth.signOut() : await supabase.auth.signInWithPassword({ email: email.trim(), password })
      if (result.error) throw result.error
      setPassword(''); toast(session ? 'Signed out.' : 'Signed in. Checking desk privileges…')
    } catch (err) { setError(err.message) }
    finally { setBusy(false) }
  }
  return <section className="glass module-card"><PanelTitle title="Workspace account" subtitle="Credentials are sent directly to the identity provider." icon="shield" color="cyan"/>{session ? <div className="actions"><p className="helper-text">{identity?.email || session.user.email} · {identity ? 'Verified session' : 'Verification pending'}</p><button type="button" className="button secondary" disabled={busy} onClick={action}><LogOut size={16}/> Sign out</button></div> : <form className="stack-form" onSubmit={(e) => { e.preventDefault(); action() }}><label>Email<input type="email" value={email} autoComplete="username" required onChange={(e) => setEmail(e.target.value)}/></label><label>Password<input type="password" value={password} autoComplete="current-password" required onChange={(e) => setPassword(e.target.value)}/></label><button type="submit" className="button primary" disabled={busy || !online}><LogIn size={16}/> Sign in</button></form>}{error && <p className="form-error" role="alert">{error}</p>}</section>
}
export default function Settings({ openApk }) {
  const { role, authEnabled, scope, toast, researchConnection } = useDesk()
  const [confirm, setConfirm] = useState(false)
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    if (location.hash === '#research-connection') document.getElementById('research-connection')?.focus()
  }, [])
  async function exportLocal() {
    try {
      const [wallet, trades, deposits, research, reviews, alerts, alertRules] = await Promise.all([db.wallets.get(scope), db.trades.where('scope').equals(scope).toArray(), db.deposits.where('scope').equals(scope).toArray(), db.messages.where('scope').equals(scope).toArray(), db.compliance.where('scope').equals(scope).toArray(), db.marketAlerts.where('scope').equals(scope).toArray(), db.marketRules.where('scope').equals(scope).toArray()])
      download('auratrade-device-data.json', JSON.stringify({ exportedAt: new Date().toISOString(), wallet, trades, deposits, research, reviews, alerts, alertRules }, null, 2))
      toast('Device data exported.')
    } catch { toast('Device data could not be exported.', 'info') }
  }
  return <div className="module-page settings-page"><SectionHeading title="Settings" description="Make the terminal yours and manage access to research tools." eyebrow="WORKSPACE PREFERENCES" icon="shield"><span className="subtle-badge"><ShieldCheck size={15}/> {role === 'admin' ? 'Lead Analyst view' : 'Research Member view'}</span></SectionHeading><ResearchConnection/><section className="glass module-card"><PanelTitle title="Workspace role" subtitle="Choose the privileges available to this session." icon="shield"/><RoleSwitcher/></section>{authEnabled && <Account/>}<section className="glass module-card"><PanelTitle title="Appearance" subtitle="Three palettes, optimized for different working environments." icon="sparkle" color="violet"/><ThemeToggle/></section><div className="module-grid"><section className="glass module-card settings-android"><PanelTitle title="Android app" subtitle="Take the terminal with you. No connection needed to start." icon="wallet"/><p><Smartphone size={19}/> Historical charts, local research and the paper simulator are bundled into the app.</p><button type="button" className="button primary" onClick={openApk}><Download size={16}/> Download Android APK</button></section><section className="glass module-card"><PanelTitle title="Device storage" subtitle="Your cached research and paper ledger stay on this device." icon="history" color="cyan"/><p className="helper-text"><Database size={14}/> Charts and reports remain available when you lose network access.</p><div className="actions"><button className="button secondary" type="button" onClick={exportLocal}><ArrowDownToLine size={15}/> Export my data</button><button className="button secondary" type="button" onClick={() => setConfirm(true)}><Trash2 size={15}/> Erase device data</button></div></section></div>{role === 'admin' && <DeskConfig/>}
  {confirm && <Modal title="Erase your local workspace data?" description="Removes your local chats, saved key, watchlist, alerts, checklist progress, paper wallet and receipts. Published market archives and hosted settings are kept." close={() => setConfirm(false)}><div className="modal-actions"><button type="button" className="button secondary" onClick={() => setConfirm(false)}>Cancel</button><button type="button" className="button danger" disabled={busy} onClick={async () => { setBusy(true); try { await clearLocalWorkspace(scope); researchConnection.forget(); toast('Local workspace data erased.'); setConfirm(false) } catch { toast('Device data could not be erased.', 'info') } finally { setBusy(false) } }}>Erase device data</button></div></Modal>}
</div>
}
