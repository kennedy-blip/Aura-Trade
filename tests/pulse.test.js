import 'fake-indexeddb/auto'
import { after, test } from 'node:test'
import assert from 'node:assert/strict'
import { db } from '../src/db/index.js'
import { addMarketRule, markSignalsRead, savePulse, toggleWatch, watchlist } from '../src/db/pulse.js'
import { alertFor, closeSeries, crossed, marketReview, rangeTransition, sampleBars } from '../src/lib/marketSignals.js'
import { PULSE_MS, quoteState, validateQuote } from '../src/data/pulse.js'
import { normalizeDaily, referenceRates, vendorQuotes } from '../server/pulse.js'

const now = Date.parse('2026-11-18T14:00:00.000Z')
const at = (mins) => new Date(now + mins * 60_000).toISOString()
const quote = (price, mins = -1, extra = {}) => ({ id: 'btc-usd', price, at: at(mins), mode: 'indicative', source: 'Test Reference', url: 'https://prices.example/btc', ...extra })
after(async () => db.delete())

test('15-second checks classify publisher time independently of the request', () => {
  assert.equal(PULSE_MS, 15000)
  assert.equal(quoteState(quote(100, -1), now), 'Indicative')
  assert.equal(quoteState(quote(100, -5), now), 'Stale')
  assert.equal(quoteState(quote(100, -1, { mode: 'live' }), now), 'Live')
  assert.equal(quoteState(quote(100, -2, { mode: 'live' }), now), 'Stale')
  assert.equal(quoteState(quote(100, -16, { mode: 'delayed' }), now), 'Delayed')
  assert.equal(quoteState(quote(100, -8, { mode: 'closed' }), now), 'Market closed')
  assert.equal(validateQuote(quote(100, 1), now), null)
  assert.equal(validateQuote({ ...quote(100), at: '2026-11-18' }, now), null)
  assert.equal(validateQuote(quote(100, -1, { url: 'javascript:alert(1)' }), now), null)
})

test('adapters preserve dates and take only valid allowlisted source fields', () => {
  assert.deepEqual(referenceRates({ data: [
    { asset: 'btc', time: at(-1), ReferenceRateUSD: '64000.25' },
    { asset: 'eth', time: at(1), ReferenceRateUSD: '1900.01' },
    { asset: 'unsupported', time: at(-1), ReferenceRateUSD: '2' },
    { asset: 'btc', time: at(-1), ReferenceRateUSD: 'NaN' },
  ] }, now).map(({ id, price, mode, at }) => [id, price, mode, at]), [['btc-usd', 64000.25, 'indicative', at(-1)]])
  const source = { name: 'Verified publisher', url: 'https://publisher.example/' }
  assert.deepEqual(vendorQuotes({ quotes: [quote(1), quote(2,-2),quote(0),quote(2,-2,{ id: 'constructor' })] }, source, now).map(({ price, url }) => [price, url]), [[1, source.url]])
  assert.deepEqual(normalizeDaily([['2026-11-31', 11], ['2026-11-19', 29], ['2026-11-18', 5], ['2026-11-18', 6], ['2026-11-17', 0]], now), [['2026-11-18', 6]])
})

test('conditional setup uses only prior observations and withholds small analog counts', () => {
  const items = Array.from({ length: 12 }, (_, i) => [at(i - 13), 100 + i % 2]); items.at(-1)[1] = 103
  assert.equal(marketReview(items.slice(-10)), null)
  assert.deepEqual(closeSeries([[at(-2), 3], [at(-2), 4], [at(-3), 0], ['fictitious', 2]]), [[at(-2), 4]])
  const review = marketReview(items)
  assert.equal(review.kind, 'upper')
  assert.equal(review.upper, 101)
  assert.equal(review.lower, 100)
  assert.equal(review.price, 103)
  assert.equal(review.up, null)
  assert.equal(review.median, null)
  assert.ok(review.width > 0)
  assert.equal(rangeTransition(items)?.kind, 'upper')
  assert.equal(rangeTransition([...items, [at(0), 104]]), null, 'continued range move is not a new break')
})

test('pattern rules only fire on a fresh contiguous new sample, never a gap or provider switch', () => {
  const ticks = Array.from({ length: 12 }, (_, i) => quote(i === 11 ? 103 : 100 + i % 2, i - 12))
  const last = ticks.at(-1), latest = { ...last, at: at(-2) }
  const rule = { type: 'range', enabled: true, latest }
  assert.equal(alertFor(rule, last, ticks, now).setup.kind, 'upper')
  assert.equal(alertFor({ ...rule, latest: null }, last, ticks, now).fired, false)
  assert.equal(alertFor(rule, last, ticks.filter((_, i) => i !== 6), now).fired, false)
  assert.equal(alertFor({ ...rule, latest: { ...latest, source: 'Old provider' } }, last, ticks, now).fired, false)
  assert.equal(alertFor(rule, { ...last, mode: 'delayed' }, ticks, now), null)
  assert.equal(sampleBars([...ticks, quote(1000, 0)], 60_000, now).at(-1)[1], 103, 'last open minute is not a completed sample')
  assert.equal(crossed(9, 10, 10, 'above'), true)
  assert.equal(crossed(10, 11, 10, 'above'), false)
})

test('foreground threshold fires once, preserves evidence and isolates workspaces', async () => {
  const scope = 'user:price-test', other = 'user:other'
  const response = (row, health = 'ok') => ({ quotes: [{ ...row, provider: 'community', health }], samples: [], sources: [{ id: 'community', state: health }] })
  await addMarketRule(scope, 'btc-usd', 'price', 'above', 105)
  await assert.rejects(addMarketRule(scope, 'btc-usd', 'price', 'above', 105), /exists/)
  await addMarketRule(other, 'btc-usd', 'price', 'above', 105)
  assert.equal((await savePulse(response(quote(100, -2)), scope, now)).generated.length, 0)
  assert.equal((await savePulse(response(quote(106), 'unavailable'), scope, now)).generated.length, 0)
  const results = await Promise.all([savePulse(response(quote(106)), scope, now), savePulse(response(quote(106)), scope, now)])
  assert.equal(results.flatMap((item) => item.generated).length, 1)
  const saved = await db.marketAlerts.where('scope').equals(scope).first()
  assert.equal(saved.url, 'https://prices.example/btc')
  assert.equal(saved.sourceAt, at(-1))
  assert.equal(await db.marketAlerts.where('scope').equals(other).count(), 0)
  const rule = await db.marketRules.where('scope').equals(scope).first()
  assert.equal(rule.enabled, false)
  await markSignalsRead(scope)
  assert.equal((await db.marketAlerts.get([scope, saved.id])).read, true)
  await toggleWatch(scope, 'eabl')
  assert.ok((await watchlist(scope)).includes('eabl'))
  assert.ok(!(await watchlist(other)).includes('eabl'))
})
