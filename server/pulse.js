import { CM_SOURCE, hasInstrument, instruments, PULSE_MS, safeHttps, validateQuote } from '../src/data/pulse.js'
import { isDate } from '../src/lib/format.js'
import { series } from '../src/data/markets.js'
import { closeSeries } from '../src/lib/marketSignals.js'
import { providerText } from './http.js'

const metricsRoot = 'https://community-api.coinmetrics.io/v4/timeseries/asset-metrics'
const coinIds = new Map(Object.entries(instruments).filter(([, item]) => item.coin).map(([id, item]) => [item.coin, id]))
const metricsSource = 'Coin Metrics Community'
export function referenceRates(payload, now = Date.now()) {
  if (!Array.isArray(payload?.data)) return []
  return payload.data.flatMap((item) => {
    const point = item && validateQuote({ id: coinIds.get(item.asset), price: item.ReferenceRateUSD, at: item.time, mode: 'indicative', source: metricsSource, url: CM_SOURCE }, now)
    return point ? [point] : []
  })
}
function metricsUrl(assets, frequency, params) {
  const url = new URL(metricsRoot)
  url.search = new URLSearchParams({ assets, metrics: 'ReferenceRateUSD', frequency, ...params })
  return url
}
const publisher = (env) => ({
  name: (env.AURA_QUOTE_FEED_NAME || 'Licensed market feed').trim().slice(0, 80),
  url: safeHttps(env.AURA_QUOTE_FEED_SOURCE),
  headers: env.AURA_QUOTE_FEED_TOKEN ? { Authorization: `Bearer ${env.AURA_QUOTE_FEED_TOKEN}` } : {},
})
export function vendorQuotes(payload, source, now = Date.now()) {
  if (!Array.isArray(payload?.quotes) || !source?.url || !source?.name) return []
  const rows = new Map()
  for (const row of payload.quotes.slice(0, 100)) {
    const point = validateQuote({ ...row, source: source.name, url: source.url }, now)
    if (point && (!rows.has(point.id) || rows.get(point.id).at < point.at)) rows.set(point.id, point)
  }
  return [...rows.values()]
}
function configured(env, name) {
  const url = safeHttps(env[name])
  if (!url) throw new Error('Source endpoint is not configured as HTTPS.')
  return new URL(url)
}
const jobs = new Map()
async function refresh(key, interval, load) {
  const current = jobs.get(key)
  if (current?.pending) return current.pending
  if (current?.until > Date.now()) return current.value
  const pending = (async () => {
    let value
    try { value = { ok: true, data: await load() } } catch { value = { ok: false, data: current?.value?.data || null } }
    jobs.set(key, { value, until: Date.now() + (value.ok ? interval : Math.min(interval, 20_000)) })
    return value
  })()
  jobs.set(key, { pending })
  return pending
}

async function cryptoPulse(env) {
  if (env.AURA_COMMUNITY_CRYPTO !== 'true') return { id: 'community', state: 'off', quotes: [] }
  const result = await refresh('community', 12_000, async () => {
    // Bucket the upstream query so adjacent edge instances share identical provider URLs.
    const start = Math.floor(Date.now() / 60_000) * 60_000 - 18 * 60_000
    const url = metricsUrl('btc,eth', '1m', { start_time: new Date(start).toISOString(), page_size: '64' })
    const rates = referenceRates(JSON.parse(await providerText(url, 4200, 32_000)))
    if (!rates.length) throw new Error('No reference rates.')
    const quotes = [...new Map(rates.sort((a, b) => a.at.localeCompare(b.at)).map((item) => [item.id, item])).values()]
    return { quotes, samples: rates }
  })
  return { id: 'community', state: result.ok ? 'ok' : 'unavailable', quotes: result.data?.quotes || [], samples: result.ok ? result.data.samples : [] }
}
async function licensedPulse(env) {
  const source = publisher(env)
  if (!env.AURA_QUOTE_FEED_URL || !source.url) return { id: 'licensed', state: 'off', quotes: [] }
  const result = await refresh('licensed', 10_000, async () => {
    const url = configured(env, 'AURA_QUOTE_FEED_URL')
    const quotes = vendorQuotes(JSON.parse(await providerText(url, 4200, 160_000, source.headers)), source)
    if (!quotes.length) throw new Error('No publishable licensed quotes.')
    return quotes
  })
  return { id: 'licensed', state: result.ok ? 'ok' : 'unavailable', quotes: result.data || [] }
}
export async function pulse(env = process.env) {
  const results = await Promise.all([cryptoPulse(env), licensedPulse(env)])
  const quotes = new Map()
  for (const result of results) for (const q of result.quotes) {
    const prior = quotes.get(q.id)
    if (!prior || (result.state === 'ok' && prior.health !== 'ok') || (result.state === prior.health && q.at >= prior.at)) quotes.set(q.id, { ...q, provider: result.id, health: result.state })
  }
  return { quotes: [...quotes.values()], samples: results[0].samples || [], sources: results.map(({ id, state }) => ({ id, state })), checkedAt: new Date().toISOString(), interval: PULSE_MS }
}

export function archivedHistory(id) {
  if (!Object.hasOwn(series, id)) return null
  const input = series[id]
  return { id, points: input.columns.map((row) => [row[0], row[input.index]]), name: 'CBK bulletin archive', url: input.url, cadence: 'Daily observations', archived: true }
}
export function normalizeDaily(points, now = Date.now()) {
  const today = new Date(now).toISOString().slice(0, 10)
  return closeSeries((Array.isArray(points) ? points.slice(-800) : []).filter((point) => Array.isArray(point) && isDate(point[0]) && point[0] <= today)).slice(-400)
}
export async function history(id, interval = '1d', env = process.env) {
  if (!hasInstrument(id)) return null
  const source = publisher(env)
  const licensed = interval === '1d' && env.AURA_HISTORY_FEED_URL && source.url ? await refresh(`history-${id}`, 5 * 60_000, async () => {
    const url = configured(env, 'AURA_HISTORY_FEED_URL')
    url.searchParams.set('id', id); url.searchParams.set('interval', '1d')
    const json = JSON.parse(await providerText(url, 4200, 240_000, source.headers))
    if (json?.id !== id || json?.interval !== '1d') return null
    const points = normalizeDaily(json.points)
    return points.length > 1 ? { id, points, name: source.name, url: source.url, cadence: 'Daily closes', archived: false } : null
  }) : null
  if (licensed?.data) return licensed.data
  const item = instruments[id]
  if (item.coin && env.AURA_COMMUNITY_CRYPTO === 'true') {
    const result = await refresh(`community-history-${id}-${interval}`, interval === '1m' ? 45_000 : 30 * 60_000, async () => {
      const url = metricsUrl(item.coin, interval, { ...(interval === '1d' ? { metrics: 'PriceUSD' } : {}), page_size: interval === '1m' ? '120' : '365', paging_from: 'end' })
      const payload = JSON.parse(await providerText(url, 5000, 100_000))
      const points = interval === '1m' ? closeSeries(referenceRates(payload).filter((row) => row.id === id).map((item) => [item.at, item.price])) : normalizeDaily(payload.data?.filter?.((row) => row?.asset === item.coin && typeof row.time === 'string' && /T00:00:00(?:\.0+)?Z$/.test(row.time)).map((row) => [row.time.slice(0, 10), Number(row.PriceUSD)]))
      if (points.length < 2) throw new Error('No dated series.')
      return { id, points, name: metricsSource, url: CM_SOURCE, cadence: interval === '1m' ? 'Minute reference rates' : 'Daily closes · UTC', archived: false }
    })
    if (result.data) return result.data
  }
  if (interval === '1m') return null
  const fred = item.fred
  if (fred && env.AURA_FRED_ENABLED !== 'false') {
    const result = await refresh(`fred-history-${fred}`, 20 * 60_000, async () => {
      const date = new Date(Date.now() - 400 * 86400_000).toISOString().slice(0,10)
      const csv = await providerText(`https://fred.stlouisfed.org/graph/fredgraph.csv?id=${fred}&cosd=${date}`, 5000, 180_000)
      const points = normalizeDaily(csv.trim().split(/\r?\n/).slice(1).map((line) => { const [day, value] = line.split(','); return [day, Number(value)] }))
      if (points.length < 2) throw new Error('No dated series.')
      return { id, points, name: 'FRED · daily reference', url: `https://fred.stlouisfed.org/series/${fred}`, cadence: 'Daily observations', archived: false }
    })
    if (result.data) return result.data
  }
  return archivedHistory(id)
}
