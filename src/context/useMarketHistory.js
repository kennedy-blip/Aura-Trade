import { useEffect, useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/index.js'
import { series } from '../data/markets.js'
import { safeHttps } from '../data/pulse.js'
import { closeSeries } from '../lib/marketSignals.js'
import { api } from '../lib/client.js'
import { useDesk } from './workspace.js'

export function useMarketHistory(id, interval) {
  const { pulse, online } = useDesk()
  const key = `${id}:${interval}`
  const [status, setStatus] = useState(null)
  const cached = useLiveQuery(() => db.pulseHistory.get(key), [key], null)
  const ticks = useLiveQuery(() => interval === '1m' ? db.pulseTicks.where('id').equals(id).toArray() : [], [id, interval], [])
  const enabled = pulse.available && online && pulse.foreground
  useEffect(() => {
    if (!enabled) return
    let active = true, busy = false
    async function load() {
      if (!active || busy) return
      busy = true; setStatus({ key, value: 'loading' })
      try {
        const result = await api(`pulse?history=${encodeURIComponent(id)}&interval=${interval}`, { timeout: 7500 })
        if (!active) return
        const data = result.history
        if (data?.id === id && safeHttps(data.url) && Array.isArray(data.points) && typeof data.name === 'string' && typeof data.cadence === 'string') {
          const points = closeSeries(data.points.slice(-400))
          if (points.length >= 2) await db.pulseHistory.put({ ...data, points, key, savedAt: new Date().toISOString() })
        }
        if (active) setStatus({ key, value: data ? 'loaded' : 'empty' })
      } catch { if (active) setStatus({ key, value: 'unavailable' }) }
      finally { busy = false }
    }
    void load()
    const timer = setInterval(load, interval === '1m' ? 60_000 : 15 * 60_000)
    return () => { active = false; clearInterval(timer) }
  }, [enabled, id, interval, key])
  const data = useMemo(() => {
    const stored = cached?.key === key ? cached : null
    if (interval === '1m') {
      const last = ticks.filter((item) => item.id === id).sort((a,b) => a.at.localeCompare(b.at)).at(-1)
      const src = last ? { id, name: last.source, url: last.url, cadence: 'Sampled observations', archived: false } : stored
      if (!src) return null
      const times = new Map()
      for (const point of stored?.url === src.url && stored.name === src.name ? stored.points : []) times.set(Math.floor(Date.parse(point[0]) / 60_000), point)
      for (const row of ticks) {
        if (row.id === id && row.source === src.name && row.url === src.url) times.set(row.minute, [row.at, row.price])
      }
      return { ...src, cadence: stored?.url === src.url && stored.name === src.name ? stored.cadence : src.cadence, points: closeSeries([...times.values()]).slice(-180) }
    }
    if (stored) return stored
    const archive = Object.hasOwn(series, id) ? series[id] : null
    return archive && { id, points: archive.columns.map((row) => [row[0], row[archive.index]]), name: 'CBK bulletin archive', url: archive.url, cadence: 'Daily observations', archived: true }
  }, [cached, id, interval, key, ticks])
  return { data, status: enabled ? (status?.key === key ? status.value : 'loading') : 'offline' }
}
