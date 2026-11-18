import { useState } from 'react'
import { Activity, ArrowRight, ArrowUpRight, ChartNoAxesCombined, GitFork, LockKeyhole, Mail, ShieldCheck, Smartphone, Sparkles } from 'lucide-react'
import { version } from '../../package.json'
import { native, publicAuthUrl, supabase } from '../lib/client.js'
import { callbackUrl, continueWithGitHub, rememberWorkspacePath } from '../lib/authClient.js'
import { authMessage, workspaceReturnPath } from '../lib/authFlow.js'
import DownloadAPKModal from './DownloadAPKModal.jsx'

export default function WorkspaceEntry({ ready, issue }) {
  const [create, setCreate] = useState(() => new URLSearchParams(location.search).get('account') === 'signup')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')
  const [sent, setSent] = useState(false)
  const [apk, setApk] = useState(false)
  const revision = document.querySelector('meta[name="aura-revision"]')?.content
  const blocked = !ready || !supabase || Boolean(busy)
  const otherWebOrigin = !native && publicAuthUrl && publicAuthUrl !== location.origin
  const canonical = otherWebOrigin ? `${publicAuthUrl}${workspaceReturnPath(location.pathname + location.search + location.hash)}` : ''
  const openCanonical = (signup) => {
    const url = new URL(canonical)
    if (signup) url.searchParams.set('account', 'signup')
    location.assign(url.href)
  }
  async function github() {
    if (blocked) return
    if (!navigator.onLine) { setError('Connect to the internet to continue with GitHub.'); return }
    if (canonical) { openCanonical(false); return }
    setBusy('github'); setError('')
    try { await continueWithGitHub() } catch (err) { setError(authMessage(err)) }
    finally { setBusy('') }
  }
  async function emailAction(event) {
    event.preventDefault()
    if (blocked) return
    setBusy('email'); setError(''); setSent(false)
    try {
      if (!navigator.onLine) throw new Error('Offline')
      if (create) rememberWorkspacePath()
      const result = create ? await supabase.auth.signUp({ email: email.trim(), password, options: { emailRedirectTo: await callbackUrl() } }) : await supabase.auth.signInWithPassword({ email: email.trim(), password })
      if (result.error) throw result.error
      setPassword('')
      setSent(create && !result.data.session)
    } catch (err) { setError(!navigator.onLine ? 'Connect to the internet to sign in or create an account.' : authMessage(err)) }
    finally { setBusy('') }
  }
  const changeMode = (next) => {
    if (next && canonical) { openCanonical(true); return }
    setCreate(next); setPassword(''); setError(''); setSent(false)
  }
  return <main className={`workspace-entry${native ? ' workspace-entry-native' : ''}`}>
    <header className="entry-header"><a className="brand" href="/"><span className="brand-mark"><Activity size={23}/></span><span><strong>AuraTrade<span className="brand-period">.</span></strong><small>EAST AFRICA</small></span></a><span className="entry-secure"><LockKeyhole size={13}/> PRIVATE WORKSPACE</span></header>
    <div className="entry-grid">
      <div className="entry-brief"><div className="entry-art" aria-hidden="true"/><span className="hero-eyebrow"><i className="signal-dot"/> NAIROBI INTELLIGENCE DESK</span><h1>Sign in to AuraTrade</h1><p>One workspace for East African markets, sourced research and risk-free paper trading.</p><ul><li><ChartNoAxesCombined size={18}/> Follow market moves and set price alerts</li><li><Sparkles size={18}/> Ask Aura about the evidence behind a move</li><li><ShieldCheck size={18}/> Keep simulated trades and notes on this device</li></ul></div>
      <section className="glass entry-card" aria-label="Workspace sign-in"><h2>Access your workspace</h2><p className="helper-text">Use GitHub or your email. New accounts start as Research Members.</p>
        {canonical && <p className="helper-text">GitHub and email signup open the <a className="text-link" href={canonical}>main AuraTrade site <ArrowUpRight size={12}/></a>.</p>}
        {!ready && <p className="helper-text" role="status">Checking your session…</p>}
        {!supabase && <p className="form-error" role="alert">The identity provider is not configured for this build.</p>}
        {(error || issue) && <p className="form-error" role="alert">{error || issue}</p>}
        <button type="button" className="button secondary entry-github" disabled={blocked} onClick={github}><GitFork size={19}/>{busy === 'github' ? 'Opening GitHub…' : 'Continue with GitHub'}<ArrowUpRight size={14}/></button>
        <div className="entry-divider">or use email</div>
        <div className="tabs entry-tabs" role="group" aria-label="Email account action"><button type="button" className={!create ? 'selected' : ''} aria-pressed={!create} disabled={!!busy} onClick={() => changeMode(false)}>Existing account</button><button type="button" className={create ? 'selected' : ''} aria-pressed={create} disabled={!!busy} onClick={() => changeMode(true)}>Create account</button></div>
        {sent ? <div className="entry-confirm" role="status"><Mail size={19}/><div><strong>Check your email</strong><p>If a confirmation was sent, open it in this browser or return here after confirming and sign in. If no message arrives, continue with GitHub.</p><button type="button" className="text-link" onClick={() => changeMode(false)}>Return to sign-in <ArrowRight size={13}/></button></div></div> : <form className="stack-form" onSubmit={emailAction}>
          <label>Email<input type="email" required autoComplete="email" autoCapitalize="none" spellCheck={false} value={email} maxLength={254} onChange={(event) => setEmail(event.target.value)} /></label>
          <label>Password<input type="password" required autoComplete={create ? 'new-password' : 'current-password'} minLength={create ? 8 : undefined} maxLength={128} value={password} onChange={(event) => setPassword(event.target.value)} /></label>
          <button type="submit" className="button primary entry-submit" disabled={blocked}>{busy === 'email' ? 'Please wait…' : create ? 'Create email account' : 'Sign in'}<ArrowRight size={16}/></button>
          {create && <p className="helper-text">Use at least 8 characters. Email accounts need a confirmation link; GitHub does not require a separate email from AuraTrade.</p>}
        </form>}
      </section>
    </div>
    <footer className="entry-footer"><span>AuraTrade East Africa · Research and simulation only</span><span>{native ? `Android ${version}` : `Web build ${revision?.slice(0, 8) || 'development'}`}</span>{!native && <button type="button" className="text-link" onClick={() => setApk(true)}><Smartphone size={14}/> Download Android APK</button>}</footer>
    {apk && <DownloadAPKModal close={() => setApk(false)}/>}
  </main>
}
