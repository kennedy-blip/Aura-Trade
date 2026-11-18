import { createHash } from 'node:crypto'
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { basename } from 'node:path'

const [source, kind] = process.argv.slice(2)
if (!source || !['preview', 'release'].includes(kind)) throw new Error('Usage: node scripts/publish-apk.mjs path/to/signed.apk preview|release')
const apk = await readFile(source)
if (!source.endsWith('.apk') || apk.length < 100_000 || apk.readUInt32LE(0) !== 0x04034b50) throw new Error(`${basename(source)} is not a valid APK archive.`)
const { version } = JSON.parse(await readFile('package.json', 'utf8'))
const packageId = kind === 'preview' ? 'africa.auratrade.terminal.accountpreview' : 'africa.auratrade.terminal'
const file = `auratrade-east-africa${kind === 'preview' ? '-preview' : ''}.apk`
await mkdir('public/app', { recursive: true })
await writeFile(`public/app/${file}`, apk)
await writeFile('public/app/android.json', JSON.stringify({ kind, url: `/app/${file}`, version, packageId, bytes: apk.length, sha256: createHash('sha256').update(apk).digest('hex') }, null, 2) + '\n')
console.log(`Published ${file} and android.json to public/app/. Run npm run build to include them on the web.`)
