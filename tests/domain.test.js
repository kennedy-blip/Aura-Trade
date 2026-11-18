import 'fake-indexeddb/auto'
import { beforeEach, after, test } from 'node:test'
import assert from 'node:assert/strict'
import { db, readyDB, cacheFeeds, executeTrade, settlePush, startPush, advanceReplay, resetWallet } from '../src/db/index.js'
import { baseline, shockImpact, simpleBenchmark, compoundedBenchmark, taxEstimate, validateSettings } from '../src/lib/models.js'
import { analyzeResearch, pickAgent, scoreSentiment, statistics } from '../src/lib/research.js'
import { fillQuote, replayBook, testPhone, START_CENTS, walletValue } from '../src/lib/ledger.js'
import { assets } from '../src/data/markets.js'
import { csv, isDate } from '../src/lib/format.js'
import { normalizedRows, parseFred } from '../server/feeds.js'
import { identity } from '../server/auth.js'

beforeEach(async () => { await db.delete(); await db.open(); await readyDB() })
after(async () => db.delete())

test('seeds dated research and does not overwrite a newer archived observation', async () => {
  const saved = await db.market.get('usd-kes')
  await cacheFeeds({ rows: [{ ...saved, asOf: '2026-11-16', value: 130 }, { ...saved, asOf: '2026-10-15', value: 200 }], statuses: [], asOf: '2026-11-17' })
  await readyDB()
  assert.equal((await db.market.get('usd-kes')).value, 130)
  assert.equal(await db.studies.count(), 4)
})
test('paper wallet does not borrow cash, short, or mix workspace scopes', async () => {
  const result = await executeTrade('alpha', { symbol: 'SCOM', side: 'buy', quantity: 100 })
  const wallet = await db.wallets.get('alpha')
  assert.equal(wallet.cash, START_CENTS - result.net)
  assert.equal(wallet.positions.SCOM.quantity, 100)
  assert.equal(result.price, 2984)
  await assert.rejects(executeTrade('alpha', { symbol: 'SCOM', side: 'sell', quantity: 101 }), /sell more/)
  await assert.rejects(executeTrade('beta', { symbol: 'SCOM', side: 'sell', quantity: 1 }), /sell more/)
  await assert.rejects(executeTrade('alpha', { symbol: 'BAT', side: 'buy', quantity: 100000 }), /paper cash/)
  await assert.rejects(executeTrade('alpha', { symbol: 'SCOM', side: 'buy', quantity: 3.5 }), /whole shares/)
  assert.equal(await db.trades.count(), 1)
  await advanceReplay('alpha')
  assert.equal((await db.wallets.get('alpha')).day, 1)
  await executeTrade('alpha', { symbol: 'SCOM', side: 'sell', quantity: 100 })
  assert.equal((await db.wallets.get('alpha')).positions.SCOM, undefined)
  assert.equal((await db.wallets.get('alpha')).curve.length, 2)
  await assert.rejects(resetWallet('alpha', 'member'), /privileges/)
  assert.equal(await db.trades.count(), 2)
  await resetWallet('alpha', 'admin')
  assert.equal(await db.trades.count(), 0)
  assert.equal(walletValue(await db.wallets.get('alpha')), START_CENTS)
})
test('concurrent fills cannot spend the same opening cash twice', async () => {
  const results = await Promise.allSettled([executeTrade('alpha', { symbol: 'BAT', side: 'buy', quantity: 222 }), executeTrade('alpha', { symbol: 'BAT', side: 'buy', quantity: 222 })])
  assert.equal(results.filter((result) => result.status === 'fulfilled').length, 1)
  assert.ok((await db.wallets.get('alpha')).cash >= 0)
})
test('sandbox funding is idempotent on concurrent callbacks and stores only masked test numbers', async () => {
  const now = Date.parse('2026-11-18T10:00:00Z')
  const { id, phone } = await startPush('alpha', '+254 (700) 000-000', 3500, now)
  assert.equal(phone, '••• 0000')
  await assert.rejects(settlePush('beta', id, 'approve', now), /not found/)
  const statuses = await Promise.all([settlePush('alpha', id, 'approve', now), settlePush('alpha', id, 'approve', now)])
  assert.deepEqual(statuses.map((item) => item.resultCode), [0, 0])
  assert.equal((await db.wallets.get('alpha')).cash, START_CENTS + 350000)
  const stale = await startPush('alpha', '0710000000', 1, now)
  assert.equal((await settlePush('alpha', stale.id, 'approve', now + 120001)).status, 'expired')
  const declined = await startPush('alpha', '0710000000', 1, now)
  assert.equal((await settlePush('alpha', declined.id, 'decline', now)).resultCode, 1032)
  assert.equal((await db.wallets.get('alpha')).cash, START_CENTS + 350000)
  assert.throws(() => testPhone('123'), /test number/)
})
test('bounded shock coefficients, benchmark math and date-specific tax modes', () => {
  const fuel = shockImpact(10, 0, 0), rate = shockImpact(0, -50, 0)
  assert.ok(fuel[0] > 0 && fuel[1] > 0 && fuel[2] < 0)
  assert.ok(rate[1] > 0 && rate[2] > 0)
  assert.throws(() => validateSettings({ model: { ...baseline, fxRate: '1.1' }, agent: { detail: 'Standard', scope: '' } }), /fxRate/)
  assert.equal(simpleBenchmark(8.745, 0), 0)
  assert.ok(Math.abs(compoundedBenchmark(10.4, 365) - 10.4) < 1e-10)
  assert.deepEqual(taxEstimate('capital', { proceeds: 150000, cost: 100000, expenses: 5000 }), { base: 45000, rate: 0.15, tax: 6750 })
  assert.equal(taxEstimate('capital', { proceeds: 1, cost: 2, expenses: 0 }).tax, 0)
  assert.equal(taxEstimate('excise', { value: 5000 }).tax, 500)
  assert.equal(taxEstimate('legacy', { value: 20000 }).tax, 600)
  assert.throws(() => taxEstimate('false', { value: 20000 }))
})
test('research routes to distinct grounded agents and labels a sentiment sample', () => {
  assert.equal(pickAgent('How volatile is NSE?'), 'quant')
  assert.equal(pickAgent('Compare October 2026 to 2025'), 'events')
  assert.equal(analyzeResearch('How does EPRA affect NSE stocks?').citations.some((ref) => ref.code === 'EPRA'), true)
  assert.deepEqual(scoreSentiment('Soko iko chini; kuna matumaini.'), { positive: ['matumaini'], negative: ['soko iko chini'], label: 'Mixed' })
  assert.equal(analyzeResearch('Score: “bei zimepanda and soko iko chini.”').mode, 'Local analysis')
  assert.equal(statistics([100,110,99]).dd < 0, true)
})
test('market normalizer allows only known series, values and publisher URLs', () => {
  const data = { rows: [{ id: 'gdp', value: 5.1, asOf: '2026-11-17', url: 'https://www.knbs.or.ke/reports/gdp/' }, { id: 'gdp', value: 4.8, asOf: '2026-10-30' }, { id: 'gdp', value: 9.4, asOf: '2026-11-25' }, { id: 'cbr', value: 1, asOf: '2026-11-01' }, { id: 'cpi', value: '7.7', asOf: '2026-01-30', url: 'https://outside.example' }] }
  const rows = normalizedRows('knbs', data, '2026-11-18')
  assert.equal(rows.length, 2)
  assert.equal(rows[0].value, 5.1)
  assert.equal(new URL(rows[1].url).hostname, 'www.knbs.or.ke')
  assert.equal(parseFred('observation_date,DGS10\n2026-11-12,4.1\n2026-11-13,.\n2026-11-16,4.13', 'DGS10').asOf, '2026-11-16')
  assert.equal(isDate('2026-02-31'), false)
  assert.equal(csv([['=1+1','comma,thing',2]]), '"\'=1+1","comma,thing","2"')
})
test('hosted admin validation ignores user-controlled metadata', async () => {
  const realFetch = globalThis.fetch
  const saved = [process.env.SUPABASE_URL, process.env.SUPABASE_PUBLISHABLE_KEY]
  process.env.SUPABASE_URL = 'https://auth.test'
  process.env.SUPABASE_PUBLISHABLE_KEY = 'unit-test'
  globalThis.fetch = async () => Response.json({ id: 'user-id', user_metadata: { aura_role: 'admin' }, app_metadata: {} })
  try {
    await assert.rejects(identity({ headers: {} }), { status: 401 })
    await assert.rejects(identity({ headers: { authorization: 'Bearer test.jwt' } }, { admin: true }), { status: 403 })
    assert.equal((await identity({ headers: { authorization: 'Bearer test.jwt' } })).role, 'member')
  } finally {
    globalThis.fetch = realFetch
    if (saved[0] === undefined) delete process.env.SUPABASE_URL; else process.env.SUPABASE_URL = saved[0]
    if (saved[1] === undefined) delete process.env.SUPABASE_PUBLISHABLE_KEY; else process.env.SUPABASE_PUBLISHABLE_KEY = saved[1]
  }
})

test('licensed inputs accept dated event and sentiment records, not arbitrary links or phone numbers', async () => {
  const { normalizedEvents, normalizedSentiment } = await import('../server/feeds.js')
  const events = normalizedEvents('nse', { events: [
    { id: 'notice-1', date: '2026-11-12', title: 'Circular', detail: 'Official corporate action', url: 'https://www.nse.co.ke/notices/circular.pdf' },
    { id: 'future', date: '2027-12-12', title: 'Future', detail: 'Not yet published' },
  ] }, '2026-11-18')
  assert.equal(events.length, 1)
  assert.equal(events[0].id, 'nse-feed-notice-1')
  const base = { channel: 'retail', date: '2026-11-14', publisher: 'Licensed sample', url: 'https://publisher.test/excerpts' }
  const entries = normalizedSentiment({ excerpts: [
    { ...base, id: 'ex-1', text: 'Soko iko juu.' },
    { ...base, id: 'ex-2', text: '0700000000' },
    { ...base, id: 'ex-3', text: 'Demo', url: 'https://untrusted.test/' },
  ] }, ['publisher.test'], '2026-11-18')
  assert.equal(entries.length, 1)
  assert.equal(entries[0].kind, 'feed')
  assert.match(analyzeResearch('Compare institutional and retail sentiment', 'sentiment').title, /Retail vs. institutional/)
  await cacheFeeds({ rows: [], events, sentiment: entries, statuses: [], asOf: '2026-11-18' })
  assert.equal((await db.events.get('nse-feed-notice-1')).title, 'Circular')
  assert.equal((await db.sentiment.get('sentiment-ex-1')).publisher, 'Licensed sample')
})


test('the illustrative replay book brackets the mark and uses the same top prices as fills', () => {
  for (const asset of assets) {
    const book = replayBook(asset, 1)
    assert.equal(book.length, 5)
    assert.equal(book[0].bid, fillQuote(asset, 1, 'sell', 1).price)
    assert.equal(book[0].ask, fillQuote(asset, 1, 'buy', 1).price)
    assert.ok(book.every((level, i) => level.bid > 0 && level.ask > level.bid && level.bidSize > 0 && level.askSize > 0 && (!i || level.bid < book[i - 1].bid && level.ask > book[i - 1].ask)))
    assert.notDeepEqual(book, replayBook(asset, 0))
  }
})
