import { useCallback, useEffect, useState } from 'react'
import { api } from '../lib/client.js'
import { validGroqKey } from '../lib/groq.js'

const keyName = (scope) => `aura-groq-key:${scope}`
const modeName = (scope) => `aura-ai-mode:${scope}`
function saved(scope) {
  try {
    const key = localStorage.getItem(keyName(scope)) || ''
    const mode = localStorage.getItem(modeName(scope))
    return { scope, key: validGroqKey(key) ? key : '', mode: ['local', 'device', 'hosted'].includes(mode) ? mode : 'local', remembered: validGroqKey(key) }
  } catch { return { scope, key: '', mode: 'local', remembered: false } }
}
export function useResearchConnection(scope, online) {
  const [owned, setOwned] = useState(() => saved(scope))
  const [hosted, setHosted] = useState(null)
  const [checked, setChecked] = useState(null)
  const entry = owned.scope === scope ? owned : saved(scope)
  const check = useCallback(async () => {
    try {
      const status = await api('research', { timeout: 5500 })
      const configured = typeof status?.groqConfigured === 'boolean' ? status.groqConfigured : null
      setHosted(configured)
      return configured
    } catch { setHosted(null); return null }
  }, [])
  useEffect(() => { if (online) void check() }, [check, online])
  useEffect(() => {
    const storage = (event) => { if ([keyName(scope), modeName(scope), null].includes(event.key)) { setOwned(saved(scope)); setChecked(null) } }
    window.addEventListener('storage', storage)
    return () => window.removeEventListener('storage', storage)
  }, [scope])
  function setMode(mode) {
    if (!['local', 'device', 'hosted'].includes(mode)) return
    setOwned({ ...entry, mode })
    try { localStorage.setItem(modeName(scope), mode) } catch { /* current tab still works */ }
  }
  function saveKey(value, remember) {
    const key = value.trim()
    if (!validGroqKey(key)) throw new Error('Paste a valid Groq API key beginning with gsk_.')
    try {
      if (remember) localStorage.setItem(keyName(scope), key)
      else localStorage.removeItem(keyName(scope))
      localStorage.setItem(modeName(scope), 'device')
    } catch {
      if (remember) throw new Error('Browser storage is unavailable. Save without remembering to use the key in this session.')
    }
    setOwned({ scope, key, mode: 'device', remembered: remember })
    setChecked(null)
  }
  function forget() {
    try { localStorage.removeItem(keyName(scope)); if (entry.mode === 'device') localStorage.setItem(modeName(scope), 'local') } catch { /* drop the in-memory key */ }
    setOwned({ ...entry, key: '', remembered: false, mode: entry.mode === 'device' ? 'local' : entry.mode })
    setChecked(null)
  }
  function verify(mode) { setChecked({ scope, mode, key: mode === 'device' ? entry.key : null }) }
  const verified = checked?.scope === scope && checked.mode === entry.mode && (entry.mode !== 'device' || checked.key === entry.key)
  return { ...entry, hosted, check, setMode, saveKey, forget, verify, verified }
}
