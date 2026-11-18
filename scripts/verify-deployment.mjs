import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { setTimeout } from 'node:timers/promises'

const base = new URL(process.argv[2])
assert.equal(base.protocol, 'https:', 'Pass the deployed HTTPS URL')
const production = base.hostname === 'auratrade-east-africa.vercel.app'
const expected = JSON.parse(await readFile(new URL('../public/app/android.json', import.meta.url), 'utf8'))
const revision = process.env.AURA_EXPECTED_REVISION || ''
if (revision) assert.match(revision, /^[a-f0-9]{40}$/, 'Use a full Git commit SHA to verify a specific deployment')
async function request(path, { status, ...options } = {}) {
  const response = await fetch(new URL(path, base), { redirect: 'error', signal: AbortSignal.timeout(20_000), ...options })
  if (!status) assert.ok(response.ok, `${path} returned HTTP ${response.status}`)
  else assert.equal(response.status, status, `${path} returned the expected HTTP status`)
  return response
}
const revisionOf = (html) => html.match(/<meta name="aura-revision" content="([a-f0-9]{40}|local)"/)?.[1]
async function htmlAt(path) {
  const response = await request(path, { cache: 'no-cache' })
  assert.match(response.headers.get('cache-control') ?? '', /(?:no-cache|no-store)/, `${path} revalidates the HTML shell`)
  return response.text()
}

// The APK often stays unchanged between web releases. Wait for the actual web
// revision as well, instead of accepting a previous deployment with the same APK.
let manifest, settings
for (let i = 0; i < (production ? 28 : 1); i++) {
  try {
    const [artifact, html] = await Promise.all([request('/app/android.json').then((response) => response.json()), htmlAt('/settings')])
    manifest = artifact
    settings = html
  } catch (error) { if (!production || i === 27) throw error }
  if (!production || (manifest?.sha256 === expected.sha256 && (!revision || revisionOf(settings) === revision))) break
  if (i < 27) await setTimeout(4500)
}
if (production) assert.equal(manifest?.sha256, expected.sha256, 'Current signed preview is deployed to the production URL')
const deployed = revisionOf(settings)
assert.ok(deployed, 'The public Settings shell identifies its web build')
if (revision) assert.equal(deployed, revision, 'Production serves the expected web release')
assert.match(manifest?.url, /^\/app\/[a-z0-9-]+\.apk$/)
assert.match(manifest.sha256, /^[0-9a-f]{64}$/)

const [home, research, markets, market, pulse, shell, config, apk, nativeResponse] = await Promise.all([
  htmlAt('/'),
  htmlAt('/research'),
  htmlAt('/markets?symbol=btc-usd'),
  request('/api/market').then((response) => response.json()),
  request('/api/pulse').then((response) => response.json()),
  request('/sw.js').then((response) => response.text()),
  request('/api/research').then((response) => response.json()),
  request(manifest.url),
  request('/api/pulse', production ? { headers: { Origin: 'https://localhost' } } : {}),
])
for (const html of [home, research, markets, settings]) {
  assert.match(html, /<title>AuraTrade East Africa/)
  assert.equal(revisionOf(html), deployed, 'Home and all tested deep links serve the same web release')
}
assert.ok(market.rows.some((row) => row.id === 'usd-kes' && row.asOf), 'Dated market observations are served')
assert.match(shell, /aura-shell-/)
assert.equal(pulse.interval, 15000)
assert.ok(Number.isFinite(Date.parse(pulse.checkedAt)))
assert.ok(Array.isArray(pulse.quotes))
assert.equal(typeof config.groqConfigured, 'boolean')
if (production) {
  assert.equal(nativeResponse.headers.get('access-control-allow-origin'), 'https://localhost')
  assert.equal(config.authConfigured, true)
  await request('/api/workspace', { status: 401 })
  await request('/api/research', { status: 401, method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{"test":true}' })
  const origin = 'https://localhost'
  const cors = await request('/api/research', { method: 'OPTIONS', headers: { Origin: origin, 'Access-Control-Request-Method': 'POST', 'Access-Control-Request-Headers': 'authorization,content-type' }, status: 204 })
  assert.equal(cors.headers.get('access-control-allow-origin'), origin)
  for (const id of ['btc-usd', 'eth-usd']) {
    const quote = pulse.quotes.find((row) => row.id === id)
    assert.ok(quote?.price > 0, `${id} reference available`)
    assert.equal(quote.mode, 'indicative')
    assert.ok(Date.now() - Date.parse(quote.at) < 4 * 60_000, `${id} reference is timestamped within four minutes`)
    console.log(`${id}: ${quote.price} USD at ${quote.at} (${quote.source}, ${quote.mode})`)
  }
  const [daily, intraday] = await Promise.all(['1d', '1m'].map((interval) => request(`/api/pulse?history=btc-usd&interval=${interval}`).then((response) => response.json())))
  for (const series of [daily.history, intraday.history]) assert.ok(series?.points?.length >= 11 && series.name && series.url, 'Sourced crypto history is available for outlooks')
  const groq = await fetch('https://api.groq.com/openai/v1/chat/completions', { method: 'OPTIONS', headers: { Origin: base.origin, 'Access-Control-Request-Method': 'POST', 'Access-Control-Request-Headers': 'authorization,content-type' }, signal: AbortSignal.timeout(8000) }).catch(() => null)
  console.log(`Groq direct browser preflight: HTTP ${groq?.status ?? 'unavailable'}; allowed origin: ${groq?.headers.get('access-control-allow-origin') || 'not declared'}. No key or prompt sent.`)
}
assert.match(apk.headers.get('content-type') ?? '', /^application\/(?:vnd\.android\.package-archive|octet-stream)(?:;|$)/)
const bytes = Buffer.from(await apk.arrayBuffer())
assert.equal(bytes.byteLength, manifest.bytes, 'APK size matches the manifest')
assert.equal(bytes.readUInt32LE(0), 0x04034b50, 'APK is a ZIP archive')
assert.equal(createHash('sha256').update(bytes).digest('hex'), manifest.sha256, 'APK checksum matches the manifest')
console.log(`Verified ${base.origin} web build ${deployed}: deep links, market pulse, research status (hosted Groq configured: ${config.groqConfigured}), offline shell and ${manifest.kind} APK v${manifest.version} (${bytes.byteLength} bytes, SHA-256 ${manifest.sha256}).`)
