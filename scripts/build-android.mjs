import { spawnSync } from 'node:child_process'
import { access, cp, mkdir, readdir, rm } from 'node:fs/promises'
import { constants } from 'node:fs'
import { resolve, join } from 'node:path'
import { loadEnv } from 'vite'

const mode = process.argv[2]
if (!['debug', 'preview', 'release'].includes(mode)) throw new Error('Pass debug, preview or release.')
const sdkHome = process.env.ANDROID_HOME || process.env.ANDROID_SDK_ROOT
if (!sdkHome) throw new Error('Install Android SDK Platform 35 and Build Tools 35, then set ANDROID_HOME.')
const config = loadEnv('production', process.cwd(), 'VITE_')
if (mode !== 'debug' && (!config.VITE_API_BASE_URL?.startsWith('https://') || !config.VITE_SUPABASE_URL?.startsWith('https://') || !config.VITE_SUPABASE_PUBLISHABLE_KEY)) throw new Error('Set the hosted API and Supabase public connection variables before packaging an account build.')
if (mode === 'release') for (const env of ['AURA_KEYSTORE', 'AURA_KEYSTORE_PASSWORD', 'AURA_KEY_ALIAS', 'AURA_KEY_PASSWORD']) if (!process.env[env]) throw new Error(`Set ${env} before building a signed Android release.`)
if (process.env.AURA_KEYSTORE) process.env.AURA_KEYSTORE = resolve(process.env.AURA_KEYSTORE)
const windows = process.platform === 'win32'
const npm = windows ? 'npm.cmd' : 'npm'
function exec(command, args, cwd) {
  const child = spawnSync(command, args, { stdio: 'inherit', cwd, shell: windows && /\.(bat|cmd)$/i.test(command) })
  if (child.error) throw child.error
  if (child.status !== 0) process.exit(child.status ?? 1)
}
const tools = (await readdir(join(sdkHome, 'build-tools'))).filter((version) => /^\d+\.\d+\.\d+$/.test(version)).sort((a,b) => b.localeCompare(a, undefined, { numeric: true }))
if (!tools.length) throw new Error('Android Build Tools 35+ are required to verify and publish the package.')
const signer = join(sdkHome, 'build-tools', tools[0], windows ? 'apksigner.bat' : 'apksigner')
await access(signer, constants.R_OK)
const aapt2 = join(sdkHome, 'build-tools', tools[0], windows ? 'aapt2.exe' : 'aapt2')
exec(npm, ['run','android:sync'], process.cwd())
await rm('android/app/src/main/assets/public/app', { recursive: true, force: true })
const gradleTask = `assemble${mode[0].toUpperCase()}${mode.slice(1)}`
exec(windows ? 'gradlew.bat' : './gradlew', [gradleTask, '--no-daemon'], resolve('android'))
const file = resolve(`android/app/build/outputs/apk/${mode}/app-${mode}.apk`)
exec(signer, ['verify', '--verbose', '--print-certs', file], process.cwd())
const badge = spawnSync(aapt2, ['dump', 'badging', file], { encoding: 'utf8' })
const expectedId = `africa.auratrade.terminal${mode === 'preview' ? '.accountpreview' : mode === 'debug' ? '.debug' : ''}`
if (badge.status || !badge.stdout.startsWith(`package: name='${expectedId}'`)) throw new Error('Unexpected Android package ID.')
console.log(badge.stdout.split('\n')[0])
await mkdir('artifacts', { recursive: true })
const stored = resolve('artifacts', mode === 'release' ? 'auratrade-east-africa.apk' : `auratrade-east-africa-${mode}.apk`)
await cp(file, stored)
if (mode !== 'debug') exec(process.execPath, ['scripts/publish-apk.mjs', stored, mode], process.cwd())
