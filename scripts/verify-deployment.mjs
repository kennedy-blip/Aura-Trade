import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'

const base = new URL(process.argv[2])
assert.equal(base.protocol, 'https:', 'Pass the deployed HTTPS URL')
async function request(path) {
  const response = await fetch(new URL(path, base), { redirect: 'error', signal: AbortSignal.timeout(30_000) })
  assert.ok(response.ok, `${path} returned HTTP ${response.status}`)
  return response
}

const [research, market, shell, manifest] = await Promise.all([
  request('/research').then((response) => response.text()),
  request('/api/market').then((response) => response.json()),
  request('/sw.js').then((response) => response.text()),
  request('/app/android.json').then((response) => response.json()),
])
assert.match(research, /<title>AuraTrade East Africa/)
assert.ok(market.rows.some((row) => row.id === 'usd-kes' && row.asOf), 'Dated market observations are served')
assert.match(shell, /aura-shell-/)
assert.match(manifest.url, /^\/app\/[a-z0-9-]+\.apk$/)
assert.match(manifest.sha256, /^[0-9a-f]{64}$/)
const apk = await request(manifest.url)
assert.match(apk.headers.get('content-type') ?? '', /^application\/(?:vnd\.android\.package-archive|octet-stream)(?:;|$)/)
const bytes = Buffer.from(await apk.arrayBuffer())
assert.equal(bytes.byteLength, manifest.bytes, 'APK size matches the manifest')
assert.equal(bytes.readUInt32LE(0), 0x04034b50, 'APK is a ZIP archive')
assert.equal(createHash('sha256').update(bytes).digest('hex'), manifest.sha256, 'APK checksum matches the manifest')
console.log(`Verified ${base.origin}: research deep link, market API, offline shell and ${manifest.kind} APK (${bytes.byteLength} bytes, SHA-256 ${manifest.sha256}).`)
