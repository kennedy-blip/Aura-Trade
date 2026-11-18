import { db } from './index.js'

const guest = 'local'
const restored = 'guest-workspace-restored'
const tables = [db.trades, db.deposits, db.messages, db.compliance, db.marketRules, db.marketAlerts]
const byScope = (table, scope) => table.where('scope').equals(scope)

async function containsActivity(scope) {
  return (await db.wallets.get(scope)) || (await db.preferences.get(`watch:${scope}`)) ||
    (await Promise.all(tables.map((table) => byScope(table, scope).count()))).some(Boolean)
}

export async function hasGuestWorkspace() {
  return !(await db.preferences.get(restored)) && Boolean(await containsActivity(guest))
}

export async function restoreGuestWorkspace(scope) {
  if (!scope?.startsWith('user:')) throw new Error('Sign in before restoring an earlier guest workspace.')
  return db.transaction('rw', [db.wallets, db.preferences, ...tables], async () => {
    if (!await hasGuestWorkspace()) throw new Error('There is no unclaimed guest workspace on this device.')
    if (await containsActivity(scope)) throw new Error('This account already has activity on this device. The guest workspace was kept unchanged.')
    const wallet = await db.wallets.get(guest)
    if (wallet) await db.wallets.add({ ...wallet, scope })
    const watch = await db.preferences.get(`watch:${guest}`)
    if (watch) await db.preferences.add({ ...watch, key: `watch:${scope}` })
    for (const table of tables) {
      const records = await byScope(table, guest).toArray()
      await table.bulkAdd(records.map((record) => ({ ...record, scope, id: typeof table.schema.primKey.keyPath === 'string' ? crypto.randomUUID() : record.id })))
    }
    // Don't copy localStorage secrets or assign this unowned data to a second account.
    await db.preferences.add({ key: restored, value: true })
  })
}
