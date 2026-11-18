import Dexie from 'dexie'
import { historicalStudies, marketEvents, snapshot } from '../data/markets.js'
import { sentimentArchive } from '../data/sentiment.js'
import { applyOrder, freshWallet, recordEquity, testPhone } from '../lib/ledger.js'

export const db = new Dexie('auratrade-east-africa')
db.version(1).stores({
  preferences: 'key', market: 'id, asOf, source', studies: 'id, category, date', feedMeta: 'id',
  wallets: 'scope', trades: 'id, scope, [scope+at]', deposits: 'id, scope, [scope+at]', messages: 'id, scope, [scope+at]',
  compliance: '[scope+id], scope',
})

db.version(2).stores({ events: 'id, date, source', sentiment: 'id, date, channel' })
export async function readyDB() {
  await db.transaction('rw', db.market, db.studies, db.events, db.sentiment, async () => {
    const stored = await db.market.bulkGet(snapshot.map(({ id }) => id))
    await db.market.bulkPut(snapshot.filter((row, index) => !stored[index] || row.asOf > stored[index].asOf || (row.asOf === stored[index].asOf && stored[index].origin === 'snapshot')))
    await db.studies.bulkPut(historicalStudies)
    await db.events.bulkPut(marketEvents)
    await db.sentiment.bulkPut(sentimentArchive)
  })
}
export async function cacheFeeds(result) {
  await db.transaction('rw', db.market, db.feedMeta, db.events, db.sentiment, async () => {
    for (const row of result.rows) {
      const prev = await db.market.get(row.id)
      if (!prev || row.asOf >= prev.asOf) await db.market.put(row)
    }
    if (Array.isArray(result.events)) {
      await db.events.bulkPut(result.events)
      if (await db.events.count() > 400) await db.events.orderBy('date').limit((await db.events.count()) - 400).delete()
    }
    if (Array.isArray(result.sentiment)) {
      await db.sentiment.bulkPut(result.sentiment)
      if (await db.sentiment.count() > 150) await db.sentiment.orderBy('date').limit((await db.sentiment.count()) - 150).delete()
    }
    await db.feedMeta.put({ id: 'status', asOf: result.asOf, statuses: result.statuses })
  })
}
export async function executeTrade(scope, order) {
  return db.transaction('rw', db.wallets, db.trades, async () => {
    const before = await db.wallets.get(scope) || freshWallet(scope)
    const { wallet, quote } = applyOrder(before, order)
    const entry = { id: crypto.randomUUID(), scope, ...order, ...quote, day: wallet.day, at: new Date().toISOString() }
    await db.wallets.put(wallet)
    await db.trades.add(entry)
    return entry
  })
}
export async function startPush(scope, rawPhone, amountKes, now = Date.now()) {
  const phone = testPhone(rawPhone)
  if (!Number.isSafeInteger(amountKes) || amountKes < 1 || amountKes > 250_000) throw new Error('Enter a whole amount between KES 1 and KES 250,000.')
  const id = crypto.randomUUID()
  const item = { id, scope, phone, amount: amountKes * 100, status: 'pending', at: new Date(now).toISOString(), expires: now + 120_000, reference: `SIM-${id.slice(0, 8).toUpperCase()}` }
  await db.deposits.add(item)
  return item
}
export async function settlePush(scope, id, action, now = Date.now()) {
  if (!['approve','decline','expire'].includes(action)) throw new Error('Choose a sandbox callback outcome.')
  return db.transaction('rw', db.wallets, db.deposits, async () => {
    const request = await db.deposits.get(id)
    if (!request || request.scope !== scope) throw new Error('Sandbox checkout not found.')
    if (request.status !== 'pending') return request
    const status = now >= request.expires || action === 'expire' ? 'expired' : action === 'approve' ? 'completed' : 'declined'
    const resultCode = { completed: 0, declined: 1032, expired: 1037 }[status]
    if (status === 'completed') {
      const wallet = await db.wallets.get(scope) || freshWallet(scope)
      await db.wallets.put(recordEquity({ ...wallet, cash: wallet.cash + request.amount, contributed: wallet.contributed + request.amount, flows: [...wallet.flows, { day: wallet.day, amount: request.amount }] }))
    }
    const result = { ...request, status, resultCode, settledAt: new Date(now).toISOString() }
    await db.deposits.put(result)
    return result
  })
}
export async function advanceReplay(scope) {
  return db.transaction('rw', db.wallets, async () => {
    const wallet = await db.wallets.get(scope) || freshWallet(scope)
    if (wallet.day >= 365) throw new Error('This replay has reached its 365-day limit.')
    await db.wallets.put(recordEquity({ ...wallet, day: wallet.day + 1 }))
  })
}
export async function resetWallet(scope, capability) {
  if (capability !== 'admin') throw new Error('Desk administration privileges are required.')
  await db.transaction('rw', db.wallets, db.trades, db.deposits, async () => {
    await db.wallets.put(freshWallet(scope))
    await db.trades.where('scope').equals(scope).delete()
    await db.deposits.where('scope').equals(scope).delete()
  })
}
export async function clearLocalWorkspace(scope) {
  await db.transaction('rw', db.wallets, db.trades, db.deposits, db.messages, db.compliance, async () => {
    await db.wallets.delete(scope)
    await Promise.all([db.trades, db.deposits, db.messages, db.compliance].map((table) => table.where('scope').equals(scope).delete()))
  })
}
