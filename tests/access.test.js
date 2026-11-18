import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { test } from 'node:test'
import { PGlite } from '@electric-sql/pglite'
import { readAuthReturn, workspaceReturnPath } from '../src/lib/authFlow.js'

const web = 'https://aura.test/auth/callback'
const native = 'africa.auratrade.terminal.accountpreview://auth/callback'
const code = '5eeebf3e-b128-4228-8d6c-5ab596eec4a7'
test('only exact callbacks carry a single PKCE code and return paths stay in the workspace', () => {
  assert.deepEqual(readAuthReturn(`${web}?code=${code}`, web), { code, flowId: undefined })
  assert.deepEqual(readAuthReturn(`${native}?code=${code}`, native), { code, flowId: undefined })
  assert.equal(readAuthReturn(`http://aura.test/auth/callback?code=${code}`, web), null)
  assert.equal(readAuthReturn(`https://aura.test.example/auth/callback?code=${code}`, web), null)
  assert.equal(readAuthReturn(`${native}/extra?code=${code}`, native), null)
  for (const params of ['#access_token=ignored', `?code=${code}&code=${code}`, `?code=${code}&refresh_token=ignored`, '?error=access_denied']) {
    assert.ok(readAuthReturn(`${web}${params}`, web).error)
  }
  assert.equal(workspaceReturnPath('/markets?symbol=btc-usd'), '/markets?symbol=btc-usd')
  assert.equal(workspaceReturnPath('/settings#research-connection'), '/settings#research-connection')
  assert.equal(workspaceReturnPath('/settings?account=signup'), '/settings')
  for (const target of ['//example.test/settings', 'https://example.test', '/\\example.test/', '/auth/callback?code=not-kept']) assert.equal(workspaceReturnPath(target), '/')
})

test('database grants keep ordinary, AI-only, and Lead settings/quota distinct', async () => {
  const db = new PGlite()
  const uid = (n) => `10000000-0000-4000-8000-00000000000${n}`
  try {
    await db.exec(`create role anon; create role authenticated; create schema auth;
      create table auth.users (id uuid primary key, raw_app_meta_data jsonb default '{}', raw_user_meta_data jsonb default '{}', is_anonymous boolean default false, deleted_at timestamptz, banned_until timestamptz);
      create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
      grant usage on schema auth to authenticated;
      insert into auth.users (id, raw_app_meta_data, raw_user_meta_data, is_anonymous) values
        ('${uid(1)}', '{}', '{"aura_role":"admin", "aura_ai":true}', false),
        ('${uid(2)}', '{}', '{}', false),
        ('${uid(3)}', '{"aura_ai":true}', '{}', false),
        ('${uid(4)}', '{"aura_role":"admin"}', '{}', true),
        ('${uid(5)}', '{"aura_role":"admin"}', '{}', false);
    `)
    for (const name of ['202611180001_aura_desk', '202611180002_aura_workspace_access']) await db.exec(await readFile(new URL(`../supabase/migrations/${name}.sql`, import.meta.url), 'utf8'))
    await db.query('insert into aura_private.desk_leads (user_id) values ($1)', [uid(2)])
    const access = async (n) => {
      await db.query("select set_config('request.jwt.claim.sub', $1, false)", [uid(n)])
      return (await db.query('select public.aura_workspace_access() as access')).rows[0].access
    }
    const quota = async () => (await db.query('select public.aura_consume_research_quota() as allowed')).rows[0].allowed
    const save = (n) => db.query('insert into public.aura_desk_settings (owner, config) values ($1, $2)', [uid(n), '{}'])
    await db.exec('set role anon')
    await assert.rejects(db.query('select public.aura_workspace_access()'), /permission denied/)
    await db.exec('set role authenticated')
    assert.deepEqual(await access(1), { role: 'member', canUseGroq: false })
    assert.equal(await quota(), false)
    await assert.rejects(save(1), /row-level security/)
    await assert.rejects(db.query('select * from aura_private.desk_leads'), /permission denied/)
    assert.deepEqual(await access(3), { role: 'member', canUseGroq: true })
    assert.equal(await quota(), true)
    await assert.rejects(save(3), /row-level security/)
    assert.equal(await access(4), null)
    assert.deepEqual(await access(5), { role: 'admin', canUseGroq: true })
    await save(5)
    assert.deepEqual(await access(2), { role: 'admin', canUseGroq: true })
    await assert.rejects(save(1), /row-level security/)
    await save(2)
    assert.deepEqual((await db.query('select owner from public.aura_desk_settings')).rows, [{ owner: uid(2) }])
    for (let i = 0; i < 20; i++) assert.equal(await quota(), true)
    assert.equal(await quota(), false)
    await db.exec('reset role')
    await db.query('delete from aura_private.desk_leads where user_id = $1', [uid(2)])
    await db.exec('set role authenticated')
    assert.deepEqual(await access(2), { role: 'member', canUseGroq: false })
    assert.deepEqual((await db.query('select * from public.aura_desk_settings')).rows, [])
  } finally { await db.close() }
})
