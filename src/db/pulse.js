import { db } from './index.js'
import { hasInstrument, initialWatch, instruments, validateQuote } from '../data/pulse.js'
import { alertFor } from '../lib/marketSignals.js'
import { num } from '../lib/format.js'

export const watchKey = (scope) => `watch:${scope}`
export async function watchlist(scope) {
  const setting = await db.preferences.get(watchKey(scope))
  return Array.isArray(setting?.value) ? setting.value.filter(hasInstrument) : initialWatch
}
export async function toggleWatch(scope, id) {
  if (!hasInstrument(id)) return
  await db.transaction('rw', db.preferences, async () => {
    const watched = await watchlist(scope)
    await db.preferences.put({ key: watchKey(scope), value: watched.includes(id) ? watched.filter((item) => item !== id) : [...watched, id] })
  })
}
export async function addMarketRule(scope, id, type, side, target) {
  if (!hasInstrument(id) || !['price', 'range'].includes(type) || (type === 'price' && (!['above', 'below'].includes(side) || !Number.isFinite(target) || target <= 0 || target > 1e9))) throw new Error('Enter a valid positive target and direction.')
  await db.transaction('rw', db.marketRules, async () => {
    const rules = await db.marketRules.where('scope').equals(scope).toArray()
    if (rules.length >= 20) throw new Error('Remove a stored rule before adding another (20 per workspace).')
    if (rules.some((rule) => rule.instrument === id && rule.type === type && (type === 'range' || (rule.target === target && rule.side === side)))) throw new Error('This alert rule already exists.')
    await db.marketRules.add({ scope, id: crypto.randomUUID(), instrument: id, type, side, target, enabled: true, latest: null })
  })
}
export async function setRuleEnabled(scope, id, enabled) {
  await db.marketRules.update([scope, id], { enabled, latest: null })
}
export async function markSignalsRead(scope) {
  await db.marketAlerts.where('scope').equals(scope).modify({ read: true })
}

export async function savePulse(result, scope, now = Date.now()) {
  if (!Array.isArray(result?.quotes) || !Array.isArray(result?.sources)) throw new Error('Market pulse did not return observations.')
  const quotes = result.quotes.slice(0, 30).flatMap((raw) => {
    const q = validateQuote(raw, now)
    return q && ['community', 'licensed'].includes(raw.provider) ? [{ ...q, provider: raw.provider, health: raw.health === 'ok' ? 'ok' : 'unavailable' }] : []
  })
  const sources = result.sources.filter((row) => row && ['community','licensed'].includes(row.id) && ['ok','off','unavailable'].includes(row.state))
  const samples = (Array.isArray(result.samples) ? result.samples.slice(-64) : []).map((raw) => validateQuote(raw, now)).filter(Boolean)
  const active = quotes.filter((q) => q.health === 'ok')
  const generated = []
  await db.transaction('rw', db.pulseQuotes, db.pulseTicks, db.marketRules, db.marketAlerts, async () => {
    for (const q of quotes) {
      const prior = await db.pulseQuotes.get(q.id)
      if (!prior || prior.at <= q.at || (prior.provider !== q.provider && q.health === 'ok')) await db.pulseQuotes.put(q)
    }
    for (const q of [...samples, ...active]) {
      if (!['live', 'indicative'].includes(q.mode) || Date.parse(q.at) <= now - 3 * 3600_000) continue
      const minute = Math.floor(Date.parse(q.at) / 60_000)
      const before = await db.pulseTicks.get([q.id, minute])
      if (!before || before.at <= q.at) await db.pulseTicks.put({ ...q, minute })
    }
    await db.pulseTicks.where('minute').below(Math.floor((now - 3 * 3600_000) / 60_000)).delete()
    if (!scope || !active.length) return
    const rules = await db.marketRules.where('scope').equals(scope).toArray()
    const byId = new Map(active.map((q) => [q.id, q]))
    for (const rule of rules.filter((entry) => entry.enabled)) {
      const quote = byId.get(rule.instrument)
      if (!quote) continue
      const ticks = rule.type === 'range' ? (await db.pulseTicks.where('id').equals(quote.id).toArray()).filter((q) => q.source === quote.source && q.url === quote.url) : []
      const decision = alertFor(rule, quote, ticks, now)
      if (!decision) continue
      await db.marketRules.update([scope, rule.id], { latest: decision.latest, enabled: !decision.fired || rule.type === 'range' })
      if (!decision.fired) continue
      const code = instruments[quote.id].code
      const upper = decision.setup?.kind === 'upper'
      const signal = {
        scope, id: `${rule.id}:${decision.latest.at}`, instrument: quote.id, at: new Date(now).toISOString(), sourceAt: rule.type === 'range' ? ticks.findLast((row) => row.minute === Math.floor(Date.parse(decision.latest.at) / 60_000))?.at || decision.latest.at : quote.at,
        source: quote.source, url: quote.url, read: false,
        title: rule.type === 'price' ? `${code} crossed ${rule.side} ${num(rule.target)}` : `${code} broke its ${upper ? 'upper' : 'lower'} range`,
        detail: rule.type === 'price' ? `${num(quote.price)} ${instruments[quote.id].unit} at the last source observation. A threshold crossing is not a buy or sell recommendation.` : `${num(decision.level)} moved ${upper ? 'above' : 'below'} the previous 10 sampled minutes. A sustained move could signal ${upper ? 'continued strength' : 'continued weakness'}; a return into the range would weaken that reading.`,
      }
      await db.marketAlerts.put(signal)
      generated.push(signal)
    }
    if (generated.length) {
      const old = (await db.marketAlerts.where('scope').equals(scope).sortBy('at')).slice(0, -100)
      await db.marketAlerts.bulkDelete(old.map((item) => [scope, item.id]))
    }
  })
  return { sources, generated }
}
