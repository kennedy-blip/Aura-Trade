import { quoteState } from '../data/pulse.js'

const mean = (items) => items.reduce((sum, value) => sum + value, 0) / items.length
const move = (from, to) => (to / from - 1) * 100
export function closeSeries(items) {
  const dated = new Map()
  for (const point of items) {
    if (Array.isArray(point) && typeof point[0] === 'string' && Number.isFinite(Date.parse(point[0])) && Number.isFinite(point[1]) && point[1] > 0) dated.set(point[0], point[1])
  }
  return [...dated].sort((a, b) => a[0].localeCompare(b[0]))
}

export function sampleBars(ticks, width, now = Date.now()) {
  const bars = new Map()
  const ordered = ticks.filter((item) => ['live', 'indicative'].includes(item.mode) && Number.isFinite(Date.parse(item.at)) && Number.isFinite(item.price) && item.price > 0).sort((a,b) => a.at.localeCompare(b.at))
  const last = ordered.at(-1)
  if (!last) return []
  for (const row of ordered) {
    if (row.source !== last.source || row.url !== last.url) continue
    const start = Math.floor(Date.parse(row.at) / width) * width
    if (start + width <= now) bars.set(start, row.price)
  }
  const result = []
  for (const [start, price] of [...bars].reverse()) {
    if (result.length && result.at(-1)[0] - start !== width) break
    result.push([start, price])
  }
  return result.reverse().map(([at, price]) => [new Date(at).toISOString(), price])
}

function setupAt(values, index) {
  if (index < 10) return null
  const reference = values.slice(index - 10, index)
  const upper = Math.max(...reference), lower = Math.min(...reference), price = values[index]
  const fast = mean(values.slice(index - 4, index + 1)), slow = mean(values.slice(index - 9, index + 1))
  const kind = price > upper ? 'upper' : price < lower ? 'lower' : fast > slow ? 'uptrend' : fast < slow ? 'downtrend' : 'range'
  return { kind, upper, lower, fast, slow }
}
const labels = { upper: 'Upper range break', lower: 'Lower range break', uptrend: 'Positive momentum', downtrend: 'Negative momentum', range: 'Balanced range' }

export function marketReview(points) {
  const clean = closeSeries(points), values = clean.map((point) => point[1]), last = values.length - 1
  const setup = setupAt(values, last)
  if (!setup) return null
  const returns = values.slice(-21).map((value, i, span) => i > 0 ? move(span[i - 1], value) : null).slice(1)
  const average = mean(returns)
  const width = Math.sqrt(returns.reduce((acc, value) => acc + (value - average) ** 2, 0) / Math.max(1, returns.length - 1))
  const analogs = []
  for (let i = 10; i < last - 1; i++) if (setupAt(values, i)?.kind === setup.kind) analogs.push(move(values[i], values[i + 1]))
  const price = values[last]
  return { ...setup, asOf: clean[last][0], price, label: labels[setup.kind], count: values.length, width, low: price * (1 - width / 100), high: price * (1 + width / 100),
    comparisons: analogs.length, median: analogs.length >= 8 ? mean(analogs.sort((a,b) => a-b).slice(Math.floor((analogs.length - 1)/2), Math.floor(analogs.length/2)+1)) : null,
    up: analogs.length >= 8 ? analogs.filter((value) => value > 0).length : null }
}
export const crossed = (previous, next, target, side) => Number.isFinite(previous) && (side === 'above' ? previous < target && next >= target : previous > target && next <= target)

export function rangeTransition(points) {
  const values = closeSeries(points).map((point) => point[1]), i = values.length - 1
  const current = setupAt(values, i), prior = setupAt(values, i - 1)
  return current && prior && current.kind !== prior.kind && ['upper', 'lower'].includes(current.kind) ? current : null
}

export function alertFor(rule, quote, ticks, now = Date.now()) {
  if (!rule.enabled || !quote || !['Live', 'Indicative'].includes(quoteState(quote, now))) return null
  if (rule.type === 'price') {
    if (rule.latest?.at >= quote.at) return null
    const before = rule.latest
    return { latest: quote, fired: before?.url === quote.url && before?.source === quote.source && Date.parse(quote.at) - Date.parse(before.at) <= 4 * 60_000 && crossed(before.price, quote.price, rule.target, rule.side) }
  }
  const points = sampleBars(ticks, 60_000, now)
  const at = points.at(-1)?.[0]
  if (!at || rule.latest?.at >= at || now - Date.parse(at) > 4 * 60_000) return null
  // First eligible sample arms the rule. A provider change or missed bars do not replay old alerts.
  const setup = rule.latest?.source === quote.source && rule.latest?.url === quote.url && Date.parse(at) - Date.parse(rule.latest.at) === 60_000 ? rangeTransition(points) : null
  return { latest: { ...quote, at }, fired: !!setup, setup, level: points.at(-1)[1] }
}
