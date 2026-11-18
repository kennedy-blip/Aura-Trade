import { useState } from 'react'
import { ArrowUpRight, KeyRound, PlugZap, Trash2 } from 'lucide-react'
import { useDesk } from '../context/workspace.js'
import { api } from '../lib/client.js'
import { groqCompletion } from '../lib/groq.js'
import { CheckBox, PanelTitle, Select } from './common.jsx'

const options = [{ value: 'local', label: 'Local research' }, { value: 'device', label: 'Groq · My API key' }, { value: 'hosted', label: 'Groq · Vercel workspace' }]
export default function ResearchConnection({ compact = false, openSettings }) {
  const { scope } = useDesk()
  return <ConnectionPanel key={scope} compact={compact} openSettings={openSettings}/>
}
function ConnectionPanel({ compact, openSettings }) {
  const { researchConnection: connection, session, identity, online, accessError, toast } = useDesk()
  const [show, setShow] = useState(!compact)
  const [value, setValue] = useState('')
  const [remember, setRemember] = useState(connection.remembered)
  const [testState, setTestState] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const hosted = connection.mode === 'hosted'
  const allowed = identity?.id === session?.user?.id && identity?.canUseGroq === true
  const enabled = connection.mode === 'device' ? !!connection.key : hosted && allowed && connection.hosted === true
  const resetStatus = () => { setTestState(''); setError('') }
  const hostedStatus = connection.hosted === false ? 'This deployment has no hosted Groq key configured.' : !online ? 'Go online to use workspace Groq.' : !session ? 'Sign in with an authorized workspace account.' : accessError ? 'Could not verify your account. Check workspace access in Settings.' : !identity ? 'Waiting for account verification.' : !allowed ? 'This account does not have access to the shared key. Use your own Groq key or local research.' : connection.hosted === null ? 'Could not check hosted configuration.' : 'Ready to test the Vercel connection.'
  async function test() {
    setBusy(true); resetStatus()
    try {
      if (hosted) {
        const result = await api('research', { method: 'POST', token: session?.access_token, body: { test: true }, timeout: 23000 })
        if (result.connected !== true) throw new Error('The workspace could not verify Groq.')
      } else await groqCompletion(connection.key, [], { test: true })
      connection.verify(hosted ? 'hosted' : 'device')
      setTestState('Groq replied successfully.')
    } catch (err) { setError(err.message) } finally { setBusy(false) }
  }
  function chooseMode(mode) {
    if (busy) return
    resetStatus()
    connection.setMode(mode)
    if (mode === 'hosted' && online) void connection.check()
  }
  return <section className="glass module-card ai-connection" id="research-connection" aria-label="Groq connection" tabIndex={-1}><PanelTitle icon="sparkle" color="violet" title="Groq connection" subtitle="Use your own key or a configured workspace key."/><label className="ai-mode-label">Answer mode<Select label="Answer mode" options={options} value={connection.mode} onChange={chooseMode}/></label>
    {connection.mode === 'local' ? <>
      <p className="helper-text">Local answers are active. Groq isn’t used in this mode.</p>
      <div className="actions"><button type="button" className="button secondary ai-setup" onClick={() => chooseMode('device')}><KeyRound size={15}/> Use my Groq key</button>{allowed && connection.hosted === true && <button type="button" className="button primary ai-setup" onClick={() => chooseMode('hosted')}><PlugZap size={15}/> Use workspace Groq</button>}</div>
      {connection.hosted === false && <p className="helper-text">Hosted Groq is not configured on this deployment.</p>}
    </> : <>
      {hosted ? <><p className="helper-text">{hostedStatus} A workspace key is stored on Vercel, never in the app. Questions go to AuraTrade’s API and Groq.</p>{openSettings && !session && <button type="button" className="text-link" onClick={openSettings}>Open account settings <ArrowUpRight size={13}/></button>}</> : <>
        <p className="helper-text">{connection.key ? (connection.remembered ? 'Key saved in this browser or app.' : 'Key held for this session.') : 'No key saved yet.'} The key goes directly to Groq, not to AuraTrade’s server.</p>
        {compact && connection.key && <button type="button" className="text-link" aria-expanded={show} onClick={() => setShow(!show)}><KeyRound size={14}/> {show ? 'Hide key setup' : 'Manage Groq key'}</button>}
        {(show || !connection.key) && <form className="stack-form ai-key-form" autoComplete="off" onSubmit={(e) => { e.preventDefault(); resetStatus(); try { connection.saveKey(value, remember); setValue(''); toast('Groq key saved. Test the connection to verify it.') } catch (err) { setError(err.message) } }}>
          <label>Groq API key<input type="password" autoComplete="new-password" spellCheck={false} autoCapitalize="none" placeholder={connection.key ? 'Enter a replacement key' : 'gsk_…'} value={value} maxLength={200} onChange={(e) => setValue(e.target.value)} required/></label>
          <CheckBox checked={remember} onChange={setRemember}>Remember on this device</CheckBox><p className="helper-text">A remembered key is readable by this browser profile. Don’t save it on shared devices. <a href="https://console.groq.com/keys" target="_blank" rel="noreferrer">Get a Groq key <ArrowUpRight size={12}/></a></p>
          <div className="actions"><button type="submit" className="button secondary" disabled={busy}>Save key</button>{connection.key && <button type="button" className="button secondary" disabled={busy} onClick={() => { connection.forget(); setValue(''); setRemember(false); resetStatus() }}><Trash2 size={14}/> Remove key</button>}</div>
        </form>}
      </>}
      <button type="button" className="button secondary ai-test" disabled={!enabled || !online || busy} onClick={test}><PlugZap size={15}/>{busy ? 'Testing…' : 'Test Groq connection'}</button>
      <p className="helper-text">The selected mode applies to new questions; saved answers don’t change. Groq receives your question and relevant market notes. If the request fails, Aura labels the local fallback.</p>
    </>}
    {testState && <p className="helper-text ink-mint" role="status">{testState}</p>}{error && <p className="form-error" role="alert">{error}</p>}
  </section>
}
