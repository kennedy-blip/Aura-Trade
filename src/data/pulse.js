export const PULSE_MS = 15_000
export const NSE_VENDOR_URL = 'https://www.nse.co.ke/dataservices/nse-licensed-information-vendors/'

export const instruments = {
  'usd-kes': { label: 'US dollar / Kenyan shilling', code: 'USD/KES', unit: 'KES', group: 'Kenya' },
  nse20: { label: 'NSE 20 Share Index', code: 'NSE 20', unit: 'pts', group: 'Kenya' },
  nasi: { label: 'NSE All Share Index', code: 'NASI', unit: 'pts', group: 'Kenya' },
  nse25: { label: 'NSE 25 Share Index', code: 'NSE 25', unit: 'pts', group: 'Kenya' },
  scom: { label: 'Safaricom', code: 'SCOM', unit: 'KES', group: 'Kenya' },
  eqty: { label: 'Equity Group', code: 'EQTY', unit: 'KES', group: 'Kenya' },
  kcb: { label: 'KCB Group', code: 'KCB', unit: 'KES', group: 'Kenya' },
  eabl: { label: 'East African Breweries', code: 'EABL', unit: 'KES', group: 'Kenya' },
  sp500: { label: 'S&P 500', code: 'S&P 500', unit: 'pts', group: 'Global' },
  dgs10: { label: 'US Treasury 10-year yield', code: 'US 10Y', unit: '%', group: 'Global', fred: 'DGS10' },
  dcoilbrenteu: { label: 'Brent spot reference', code: 'BRENT', unit: 'USD', group: 'Global', fred: 'DCOILBRENTEU' },
  'btc-usd': { label: 'Bitcoin / US dollar', code: 'BTC/USD', unit: 'USD', group: 'Crypto', coin: 'btc' },
  'eth-usd': { label: 'Ether / US dollar', code: 'ETH/USD', unit: 'USD', group: 'Crypto', coin: 'eth' },
}
export const CM_LICENSE = 'https://creativecommons.org/licenses/by-nc/4.0/'
export const CM_SOURCE = 'https://gitbook-docs.coinmetrics.io/access-our-data/api'
export const initialWatch = ['usd-kes', 'nse20', 'btc-usd', 'eth-usd', 'dgs10']
export const hasInstrument = (id) => typeof id === 'string' && Object.hasOwn(instruments, id)
export const safeHttps = (value) => {
  try {
    if (typeof value !== 'string' || value.length > 1500) return null
    const link = new URL(value)
    return link.protocol === 'https:' && !link.username && !link.password ? link.href : null
  } catch { return null }
}
export function quoteState(quote, now = Date.now()) {
  if (!quote) return 'Unavailable'
  if (quote.mode === 'reference') return 'Dated reference'
  const age = now - Date.parse(quote.at)
  if (!Number.isFinite(age) || age < -30_000) return 'Stale'
  if (quote.mode === 'closed') return 'Market closed'
  if (quote.mode === 'delayed') return age <= 45 * 60_000 ? 'Delayed' : 'Stale'
  if (quote.mode === 'live') return age <= 90_000 ? 'Live' : 'Stale'
  return quote.mode === 'indicative' && age <= 240_000 ? 'Indicative' : 'Stale'
}
export function validateQuote(raw, now = Date.now()) {
  if (!raw || !hasInstrument(raw.id) || !['live','indicative','delayed','closed'].includes(raw.mode)) return null
  const at = typeof raw.at === 'string' && /T\d\d:\d\d.*(?:Z|[+-]\d\d:\d\d)$/.test(raw.at) ? Date.parse(raw.at) : NaN
  const price = typeof raw.price === 'string' && raw.price.trim() ? Number(raw.price) : raw.price
  const url = safeHttps(raw.url)
  if (!Number.isFinite(at) || at > now + 30_000 || at < now - 14 * 86400_000 || !Number.isFinite(price) || price <= 0 || price > 1e9 || !url || typeof raw.source !== 'string' || !raw.source.trim()) return null
  return { id: raw.id, at: new Date(at).toISOString(), price, source: raw.source.trim().slice(0, 80), url, mode: raw.mode, ...(typeof raw.change === 'number' && Number.isFinite(raw.change) && Math.abs(raw.change) <= 1000 ? { change: raw.change } : {}) }
}
