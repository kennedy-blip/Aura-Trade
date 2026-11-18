import { test } from 'node:test'
import assert from 'node:assert/strict'
import research from '../api/research.js'
import { groqCompletion, groqReport, GROQ_MODEL, synthesisMessages, validGroqKey } from '../src/lib/groq.js'

const key = 'gsk_' + 'z'.repeat(44)
const reply = Response.json({ choices: [{ message: { content: 'The reference is historical.\n\nCheck the next official release.' } }] })

test('Groq only calls the fixed provider and never inserts a credential into the prompt', async () => {
  const primary = { paragraphs: ['Dated evidence.'], citations: [{ id: 'cbk' }] }
  const text = await groqCompletion(key, synthesisMessages('What is observed?', primary, primary), { fetcher: async (url, init) => {
    assert.equal(url, 'https://api.groq.com/openai/v1/chat/completions')
    assert.equal(init.redirect, 'error')
    assert.equal(init.headers.Authorization, `Bearer ${key}`)
    assert.ok(!init.body.includes(key))
    const body = JSON.parse(init.body)
    assert.equal(body.model, GROQ_MODEL)
    assert.equal(body.reasoning_format, 'hidden')
    assert.match(body.messages[1].content, /Dated evidence/)
    return reply.clone()
  } })
  const report = groqReport(text, primary, primary, 'Groq · device key')
  assert.equal(report.paragraphs.length, 2)
  assert.deepEqual(report.citations, [{ id: 'cbk' }])
  assert.equal(validGroqKey('sk_' + 'z'.repeat(44)), false)
})

test('invalid key, provider limit and no answer are different errors; upstream bodies are never surfaced', async () => {
  for (const [status, match] of [[401, /rejected/], [429, /usage limit/], [404, /model/], [503, /temporarily/]]) {
    await assert.rejects(groqCompletion(key, [], { fetcher: () => new Response(`Do not echo ${key}`, { status }) }), (error) => match.test(error.message) && !error.message.includes(key))
  }
  await assert.rejects(groqCompletion(key, [], { fetcher: () => Response.json({}) }), /no response/)
  await assert.rejects(groqCompletion('', [], { fetcher: () => assert.fail('no upstream call') }), /valid API key/)
})

function call(handler, method = 'GET', body, token) {
  const headers = new Map()
  const response = { statusCode: 200, setHeader: (k, v) => headers.set(k, v), end: (text) => { response.body = JSON.parse(text) } }
  return handler({ method, url: '/api/research', body, headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) } }, response).then(() => ({ ...response, headers }))
}

test('hosted Groq is allowlisted, separately opted in, and spends quota before calling the model', async (t) => {
  const current = { ...process.env }
  process.env.SUPABASE_URL = 'https://auth.example'
  process.env.SUPABASE_PUBLISHABLE_KEY = 'public-test-key'
  process.env.GROQ_API_KEY = key
  t.after(() => { for (const name of ['SUPABASE_URL', 'SUPABASE_PUBLISHABLE_KEY', 'GROQ_API_KEY']) { if (current[name] === undefined) delete process.env[name]; else process.env[name] = current[name] } })
  let authorized = false, underQuota = false
  const upstreams = []
  t.mock.method(globalThis, 'fetch', (url) => {
    upstreams.push(String(url))
    if (url === 'https://auth.example/auth/v1/user') return Promise.resolve(Response.json({ id: 'member', user_metadata: { aura_role: 'admin', aura_ai: true } }))
    if (url === 'https://auth.example/rest/v1/rpc/aura_workspace_access') return Promise.resolve(Response.json({ role: 'member', canUseGroq: authorized }))
    if (url === 'https://auth.example/rest/v1/rpc/aura_consume_research_quota') return Promise.resolve(Response.json(underQuota))
    if (url.startsWith('https://api.groq.com/')) return Promise.resolve(reply.clone())
    assert.fail(`Unexpected upstream: ${url}`)
  })
  const configuration = await call(research)
  assert.deepEqual(configuration.body, { groqConfigured: true, authConfigured: true })
  assert.equal(configuration.headers.get('Cache-Control'), 'no-store')
  assert.ok(!JSON.stringify(configuration.body).includes(key))
  assert.equal((await call(research, 'POST', { test: true })).statusCode, 401)
  assert.equal((await call(research, 'POST', { test: true }, 'session')).statusCode, 403)
  authorized = true
  assert.equal((await call(research, 'POST', { test: true }, 'session')).statusCode, 429)
  assert.ok(upstreams.every((url) => !url.startsWith('https://api.groq.com')))
  underQuota = true
  assert.deepEqual((await call(research, 'POST', { test: true }, 'session')).body, { connected: true })
  assert.equal(upstreams.at(-1), 'https://api.groq.com/openai/v1/chat/completions')
})
