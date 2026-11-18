import { feedSources, sources, snapshot } from '../src/data/markets.js'
import { isDate } from '../src/lib/format.js'
import { providerText } from './http.js'
import { sentimentArchive } from '../src/data/sentiment.js'

const schemas = {
  cbk: { 'usd-kes': ['USD / KES', 'KES'], cbr: ['CBK Policy Rate', '%'], tbill: ['91-Day T-Bill', '%', 3], reserves: ['FX Reserves', 'USD bn', 3], kesonia: ['Overnight Rate (KESONIA)', '%'] },
  knbs: { cpi: ['Kenya Inflation', '%', 1], gdp: ['Real GDP Growth', '%', 1] },
  epra: { petrol: ['Nairobi Petrol Cap', 'KES/L'], diesel: ['Nairobi Diesel Cap', 'KES/L'], kerosene: ['Nairobi Kerosene Cap', 'KES/L'] },
  eatta: { tea: ['Tea Auction Volume', 'million kg'], 'tea-price': ['Tea Auction Average', 'USD/kg'] },
  nse: { nse20: ['NSE 20 Index', 'pts'], nasi: ['NSE All Share', 'pts'], nse25: ['NSE 25 Index', 'pts'] },
  mmf: { 'mmf-cic': ['CIC Money Market Fund', '%'], 'mmf-ncba': ['NCBA Money Market Fund', '%'], 'mmf-sanlam': ['Sanlam Money Market Fund', '%'] },
}
const validHosts = { mmf: ['cma.or.ke','cic.co.ke','ncbagroup.com','sanlam.com','sanlam.co.ke'] }
function officialUrl(id, candidate) {
  const source = sources[id]
  try {
    const url = new URL(candidate)
    const root = new URL(source.url).hostname.replace(/^www\./, '')
    if (url.protocol === 'https:' && !url.username && !url.password && (validHosts[id] || [root]).some((host) => url.hostname === host || url.hostname.endsWith(`.${host}`))) return url.href
  } catch { /* the publisher index is the citation fallback */ }
  return source.url
}
const eventStyles = { cbk: ['Policy', 'bank', 'mint'], knbs: ['Economy', 'chart', 'violet'], epra: ['Energy', 'fuel', 'amber'], eatta: ['Commodities', 'leaf', 'mint'], nse: ['Corporate action', 'chart', 'cyan'] }
const shortText = (value, limit) => typeof value === 'string' ? value.trim().slice(0, limit) : ''
export function normalizedEvents(id, data, today = new Date().toISOString().slice(0, 10)) {
  if (!eventStyles[id] || !Array.isArray(data?.events)) return []
  const [area, icon, color] = eventStyles[id]
  return data.events.slice(0, 250).flatMap((item) => {
    if (!item || typeof item.id !== 'string' || !/^[a-z0-9-]{1,48}$/.test(item.id) || !isDate(item.date) || item.date > today) return []
    const title = shortText(item.title, 140), detail = shortText(item.detail, 1200)
    if (!title || !detail) return []
    return [{ id: `${id}-feed-${item.id}`, date: item.date, title, detail, impact: shortText(item.impact, 400), source: id, url: officialUrl(id, item.url), area, icon, color, region: 'Kenya' }]
  })
}
function secureFeedUrl(value) {
  const url = new URL(value)
  if (url.protocol !== 'https:' || url.username || url.password) throw new Error('Use a trusted HTTPS feed.')
  return url
}
export function normalizedSentiment(data, trusted, today = new Date().toISOString().slice(0, 10)) {
  const hosts = new Set(trusted.map((item) => item.trim().toLowerCase()))
  if (!Array.isArray(data?.excerpts)) return []
  return data.excerpts.slice(0, 100).flatMap((item) => {
    if (!item || typeof item.id !== 'string' || !/^[a-z0-9-]{1,48}$/.test(item.id) || !['retail', 'wire'].includes(item.channel) || !isDate(item.date) || item.date > today) return []
    const text = shortText(item.text, 500), publisher = shortText(item.publisher, 65)
    try {
      const url = secureFeedUrl(item.url)
      if (!text || !publisher || !hosts.has(url.hostname) || url.search || url.hash || /@|\b\d{9,}\b/.test(text)) return []
      return [{ id: `sentiment-${item.id}`, kind: 'feed', channel: item.channel, date: item.date, text, publisher, url: url.href }]
    } catch { return [] }
  }).sort((a, b) => b.date.localeCompare(a.date))
}
function decimal(value) {
  if (!['number', 'string'].includes(typeof value) || String(value).trim() === '') return NaN
  return Number(String(value).replace(/,/g, ''))
}
export function normalizedRows(id, data, today = new Date().toISOString().slice(0, 10)) {
  if (!schemas[id]) throw new Error('Unknown feed.')
  const entries = Array.isArray(data) ? data : data?.rows
  if (!Array.isArray(entries) || entries.length > 500) throw new Error('Expected up to 500 market records.')
  const latest = new Map()
  for (const item of entries) {
    if (!item || !Object.hasOwn(schemas[id], item.id)) continue
    const value = decimal(item.value), d = decimal(item.delta)
    if (!Number.isFinite(value) || Math.abs(value) > 1e8 || !isDate(item.asOf) || item.asOf > today || latest.get(item.id)?.asOf > item.asOf) continue
    const [name, unit, digits = 2] = schemas[id][item.id]
    latest.set(item.id, { id: item.id, name, value, unit, digits, source: id, region: 'Kenya', asOf: item.asOf, url: officialUrl(id, item.url), origin: 'feed', period: typeof item.period === 'string' ? item.period.slice(0, 90) : '', delta: Math.abs(d) <= 10000 && ['%', 'bps','pp'].includes(item.changeUnit) ? d : undefined, changeUnit: ['%','bps','pp'].includes(item.changeUnit) ? item.changeUnit : '%' })
  }
  if (!latest.size) throw new Error('No valid dated observations.')
  return [...latest.values()]
}
export function parseFred(text, id) {
  const entries = text.trim().split(/\r?\n/).slice(1).map((line) => line.split(',')).filter(([date, value]) => isDate(date) && Number.isFinite(decimal(value)))
  if (!entries.length) throw new Error('Empty FRED series.')
  const [asOf, raw] = entries.at(-1), value = decimal(raw), prev = decimal(entries.at(-2)?.[1])
  const [name, unit] = { DGS10: ['US 10-Year Yield','%'], SP500: ['S&P 500','pts'], DCOILBRENTEU: ['Brent Crude','USD'] }[id]
  return { id: id.toLowerCase(), name, unit, digits: 2, asOf, value, source: 'fred', region: 'Global', origin: 'feed', url: `https://fred.stlouisfed.org/series/${id}`, period: 'Last published observation', delta: Number.isFinite(prev) && prev !== 0 ? (unit === '%' ? (value - prev) * 100 : (value / prev - 1) * 100) : undefined, changeUnit: unit === '%' ? 'bps' : '%' }
}
async function fredFeed() {
  const since = new Date(Date.now() - 45 * 86400000).toISOString().slice(0, 10)
  const points = await Promise.allSettled(['DGS10', 'SP500', 'DCOILBRENTEU'].map(async (id) => parseFred(await providerText(`https://fred.stlouisfed.org/graph/fredgraph.csv?id=${id}&cosd=${since}`), id)))
  const rows = points.filter((result) => result.status === 'fulfilled').map((result) => result.value)
  if (!rows.length) throw new Error('FRED is unavailable.')
  return rows
}
async function alphaFeed(key) {
  const data = JSON.parse(await providerText(`https://www.alphavantage.co/query?${new URLSearchParams({ function: 'TREASURY_YIELD', interval: 'daily', maturity: '2year', apikey: key })}`))
  const items = Array.isArray(data?.data) ? data.data.filter((r) => isDate(r.date) && Number.isFinite(decimal(r.value))).sort((a, b) => b.date.localeCompare(a.date)) : []
  if (!items.length) throw new Error('Alpha Vantage returned no observations.')
  return [{ id: 'us2y', name: 'US 2-Year Yield', unit: '%', digits: 2, source: 'alpha', value: decimal(items[0].value), asOf: items[0].date, region: 'Global', origin: 'feed', period: 'Last published observation', url: sources.alpha.url, delta: items[1] ? (decimal(items[0].value) - decimal(items[1].value)) * 100 : undefined, changeUnit: 'bps' }]
}
const envs = { cbk: 'CBK_FEED_URL', knbs: 'KNBS_FEED_URL', epra: 'EPRA_FEED_URL', eatta: 'EATTA_FEED_URL', nse: 'NSE_FEED_URL', mmf: 'MMF_FEED_URL' }
let cache, inFlight
export async function marketFeeds() {
  if (cache && Date.now() - Date.parse(cache.asOf) < 5 * 60000) return cache
  if (inFlight) return inFlight
  inFlight = (async () => {
    const rows = [...snapshot], events = []
    const sentimentJob = (async () => {
      if (!process.env.SENTIMENT_FEED_URL || !process.env.SENTIMENT_PUBLISHERS) return { rows: sentimentArchive, state: 'Archive' }
      try {
        const data = JSON.parse(await providerText(secureFeedUrl(process.env.SENTIMENT_FEED_URL)))
        const fresh = normalizedSentiment(data, process.env.SENTIMENT_PUBLISHERS.split(','))
        if (!fresh.length) throw new Error('No publishable records.')
        return { rows: [...fresh, ...sentimentArchive], state: 'Updated' }
      } catch { return { rows: sentimentArchive, state: 'Unavailable' } }
    })()
    const statuses = await Promise.all([...feedSources, 'mmf'].map(async (id) => {
      const env = process.env[envs[id]], enabled = id === 'fred' ? process.env.AURA_FRED_ENABLED !== 'false' : id === 'alpha' ? process.env.ALPHA_VANTAGE_API_KEY : env
      if (!enabled) return { id, state: 'Archive' }
      try {
        let records
        if (id === 'fred') records = await fredFeed()
        else if (id === 'alpha') records = await alphaFeed(enabled)
        else {
          const data = JSON.parse(await providerText(secureFeedUrl(env)))
          const notices = normalizedEvents(id, data)
          const payload = Array.isArray(data) ? data : data?.rows
          records = Array.isArray(payload) && payload.length ? normalizedRows(id, payload) : []
          if (!records.length && !notices.length) throw new Error('No valid observations or notices.')
          events.push(...notices)
        }
        for (const record of records) {
          const index = rows.findIndex((row) => row.id === record.id)
          if (index < 0) rows.push(record)
          else if (record.asOf >= rows[index].asOf) rows[index] = record
        }
        return { id, state: 'Updated', count: records.length, asOf: records.reduce((latest, row) => row.asOf > latest ? row.asOf : latest, '') }
      } catch { return { id, state: 'Unavailable' } }
    }))
    const sentiment = await sentimentJob
    cache = { rows, events, sentiment: sentiment.rows, statuses: [...statuses, { id: 'sentiment', state: sentiment.state }], asOf: new Date().toISOString() }
    return cache
  })()
  try { return await inFlight } finally { inFlight = undefined }
}
