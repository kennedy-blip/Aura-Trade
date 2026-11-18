import { useCallback, useEffect, useRef, useState } from 'react'
import { App as CapacitorApp } from '@capacitor/app'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/index.js'
import { savePulse, watchlist } from '../db/pulse.js'
import { initialWatch, PULSE_MS, quoteState } from '../data/pulse.js'
import { api, hasHostedApi, native } from '../lib/client.js'

export function useForeground() {
  const [visible, setVisible] = useState(() => document.visibilityState !== 'hidden')
  const [active, setActive] = useState(true)
  useEffect(() => {
    const visibility = () => setVisible(document.visibilityState !== 'hidden')
    document.addEventListener('visibilitychange', visibility)
    const sub = native ? CapacitorApp.addListener('appStateChange', ({ isActive }) => setActive(isActive)) : null
    return () => { document.removeEventListener('visibilitychange', visibility); sub?.then((item) => item.remove()).catch(() => {}) }
  }, [])
  return active && visible
}

export function useMarketPulse(scope, online, foreground, toast) {
  const [meta, setMeta] = useState({ sources: [], checked: null, error: false })
  const [checking, setChecking] = useState(false)
  const [now, setNow] = useState(Date.now)
  const activeScope = useRef(null)
  const foregroundRef = useRef(foreground)
  useEffect(() => { foregroundRef.current = foreground }, [foreground])
  const busy = useRef(false)
  useEffect(() => {
    activeScope.current = scope
    return () => { activeScope.current = null }
  }, [scope])
  const quotes = useLiveQuery(() => db.pulseQuotes.toArray(), [], [])
  const watched = useLiveQuery(() => watchlist(scope), [scope], initialWatch)
  const alerts = useLiveQuery(() => db.marketAlerts.where('scope').equals(scope).sortBy('at').then((rows) => rows.reverse()), [scope], [])
  const rules = useLiveQuery(() => db.marketRules.where('scope').equals(scope).toArray(), [scope], [])
  const run = useCallback(async (manual = false) => {
    if (busy.current || !navigator.onLine || !hasHostedApi || !foreground) return
    const captured = activeScope.current
    busy.current = true
    setChecking(true)
    try {
      const result = await api('pulse', { timeout: 7800 })
      const time = Date.now()
      const fresh = await savePulse(result, activeScope.current === captured && foregroundRef.current && navigator.onLine && document.visibilityState !== 'hidden' ? captured : null, time)
      setMeta({ sources: fresh.sources, checked: time, error: false })
      if (activeScope.current === captured && fresh.generated.length) toast(fresh.generated.length === 1 ? fresh.generated[0].title : `${fresh.generated.length} new market alerts.`, 'info')
      else if (manual) toast(fresh.sources.some((item) => item.state === 'ok') ? 'Market sources checked.' : 'No current quote sources responded. Dated references are still available.', 'info')
    } catch {
      setMeta((previous) => ({ ...previous, error: true }))
      if (manual) toast('Market check failed. Showing saved observations.', 'info')
    } finally {
      busy.current = false
      setChecking(false)
      setNow(Date.now())
    }
  }, [foreground, toast])
  useEffect(() => {
    if (!online || !foreground || !hasHostedApi) return
    setNow(Date.now())
    // A short first-tick defer avoids duplicate work during React's strict-effect remount.
    const start = setTimeout(() => run(), 250)
    const timer = setInterval(() => run(), PULSE_MS)
    return () => { clearTimeout(start); clearInterval(timer) }
  }, [online, foreground, run])
  function stateOf(q) {
    const state = quoteState(q, now)
    if (q && (!online || meta.error || q.health !== 'ok' || !meta.checked || !meta.sources.some((item) => item.id === q.provider && item.state === 'ok'))) return 'Cached'
    return state
  }
  return { quotes, watched, rules, alerts, meta, checking, run, now, stateOf, foreground, available: hasHostedApi }
}
