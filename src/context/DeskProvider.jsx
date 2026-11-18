import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, readyDB, cacheFeeds } from '../db/index.js'
import { marketEvents, snapshot } from '../data/markets.js'
import { sentimentArchive } from '../data/sentiment.js'
import { baseline, agentDefaults, validateSettings } from '../lib/models.js'
import { api, hasHostedApi, previewRoles, supabase } from '../lib/client.js'
import { useResearchConnection } from './useResearchConnection.js'
import { useForeground, useMarketPulse } from './useMarketPulse.js'
import { DeskContext } from './workspace.js'

const defaultSettings = { model: baseline, agent: agentDefaults }
const themes = ['obsidian','savannah','amber']
const get = (key, fallback) => { try { return localStorage.getItem(key) || fallback } catch { return fallback } }
const set = (key, value) => { try { localStorage.setItem(key, value) } catch { /* storage may be disabled */ } }

export default function DeskProvider({ children, session }) {
  const [theme, setTheme] = useState(() => themes.includes(get('aura-theme', 'obsidian')) ? get('aura-theme', 'obsidian') : 'obsidian')
  const [requested, setRequested] = useState(() => !supabase && get('aura-role', 'member') === 'admin' ? 'admin' : 'member')
  const [online, setOnline] = useState(navigator.onLine)
  const [identity, setIdentity] = useState(null)
  const [accessError, setAccessError] = useState(false)
  const [accessCheck, setAccessCheck] = useState(0)
  const [storageError, setStorageError] = useState(false)
  const [notice, setNotice] = useState(null)
  const [refreshing, setRefreshing] = useState(false)
  const [hostedSettings, setHostedSettings] = useState(null)
  const timer = useRef(null)
  const busy = useRef(false)
  const role = requested === 'admin' && (previewRoles || (online && identity?.role === 'admin' && identity.id === session?.user?.id)) ? 'admin' : 'member'
  const scope = session?.user?.id ? `user:${session.user.id}` : 'local'
  const preferences = useLiveQuery(() => db.preferences.get('preview-settings'), [], null)
  const data = useLiveQuery(() => db.market.toArray(), [], null)
  const eventCache = useLiveQuery(() => db.events.orderBy('date').reverse().toArray(), [], null)
  const sentimentCache = useLiveQuery(() => db.sentiment.orderBy('date').reverse().toArray(), [], null)
  const events = eventCache?.length ? eventCache : marketEvents
  const sentiment = sentimentCache?.length ? sentimentCache : sentimentArchive
  const feedMeta = useLiveQuery(() => db.feedMeta.get('status'), [], null)
  const rows = useMemo(() => [...new Map([...snapshot, ...(data || [])].map((row) => [row.id, row])).values()], [data])
  const settings = role === 'admin' ? (previewRoles ? preferences?.value : hostedSettings) || defaultSettings : defaultSettings
  const toast = useCallback((message, kind = 'success') => {
    clearTimeout(timer.current)
    setNotice({ message, kind })
    timer.current = setTimeout(() => setNotice(null), 4400)
  }, [])

  const foreground = useForeground()
  const pulse = useMarketPulse(scope, online, foreground, toast)
  const researchConnection = useResearchConnection(scope, online)

  useEffect(() => { readyDB().catch(() => setStorageError(true)); return () => clearTimeout(timer.current) }, [])
  useEffect(() => {
    const update = () => setOnline(navigator.onLine)
    window.addEventListener('online', update); window.addEventListener('offline', update)
    return () => { window.removeEventListener('online', update); window.removeEventListener('offline', update) }
  }, [])
  useEffect(() => {
    document.documentElement.dataset.theme = theme
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'savannah' ? '#eef2ee' : theme === 'amber' ? '#0e0a07' : '#07090e')
    set('aura-theme', theme)
  }, [theme])
  useEffect(() => {
    if (!session?.access_token || !online) return
    let current = true
    setAccessError(false)
    api('workspace?settings=1', { token: session.access_token }).then((value) => {
      if (current) { setIdentity(value); setHostedSettings(value.settings) }
    }).catch(() => { if (current) { setIdentity(null); setHostedSettings(null); setAccessError(true) } })
    return () => { current = false }
  }, [session?.access_token, online, accessCheck])

  const refresh = useCallback(async (manual = false) => {
    if (busy.current) return
    if (!navigator.onLine || !hasHostedApi) { if (manual) toast('Showing the market snapshot saved on this device.', 'info'); return }
    busy.current = true
    if (manual) setRefreshing(true)
    try {
      const result = await api('market')
      if (!Array.isArray(result.rows) || !Array.isArray(result.statuses)) throw new Error('Invalid response.')
      await cacheFeeds(result)
      if (manual) toast(result.statuses.some((item) => item.state === 'Updated') ? 'Market sources refreshed.' : 'No updated feeds were available. Showing dated archives.', 'info')
    } catch { if (manual) toast('Refresh was unavailable. Cached data is still available.', 'info') }
    finally { busy.current = false; if (manual) setRefreshing(false) }
  }, [toast])
  useEffect(() => {
    if (!online || !foreground) return
    const start = setTimeout(() => refresh(), 1000)
    const interval = setInterval(() => refresh(), 15 * 60000)
    return () => { clearTimeout(start); clearInterval(interval) }
  }, [refresh, online, foreground])

  const switchRole = (next) => {
    if (next === 'admin' && !previewRoles && (identity?.role !== 'admin' || !online)) { toast('A verified Lead Analyst account is required.', 'info'); return }
    setRequested(next)
    if (previewRoles) set('aura-role', next)
    toast(next === 'admin' ? (previewRoles ? 'Lead Analyst sandbox enabled.' : 'Lead Analyst desk enabled.') : 'Retail Research Member view enabled.', 'info')
  }
  async function saveDesk(input) {
    if (role !== 'admin') throw new Error('Lead Analyst privileges are required.')
    const cleaned = validateSettings(input)
    if (previewRoles) await db.preferences.put({ key: 'preview-settings', value: cleaned })
    else {
      const result = await api('workspace', { method: 'PUT', body: cleaned, token: session?.access_token })
      setHostedSettings(result.settings)
    }
  }
  return <DeskContext.Provider value={{ theme, setTheme, online, role, switchRole, scope, session, identity, accessError, checkAccess: () => setAccessCheck((value) => value + 1), canSwitchAdmin: previewRoles || (online && identity?.role === 'admin'), previewRoles, authEnabled: !!supabase, settings, saveDesk, rows, events, sentiment, feedMeta, pulse, researchConnection, refresh, refreshing, toast, notice, setNotice, storageError }}>{children}</DeskContext.Provider>
}
