import assert from 'node:assert/strict'
import { withChromium } from './chromium.mjs'

const base = new URL(process.argv[2]).origin
const expected = process.env.AURA_EXPECTED_REVISION
await withChromium(async (browser) => {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  const page = await context.newPage()
  page.setDefaultTimeout(18_000)
  const errors = []
  page.on('pageerror', (error) => errors.push(error.message))
  const button = (name) => page.getByRole('button', { name, exact: true })
  const heading = (name) => page.getByRole('heading', { name, exact: true })
  await page.goto(`${base}/research`, { waitUntil: 'domcontentloaded' })
  await heading('Sign in to AuraTrade').waitFor()
  assert.equal(await heading('Aura Research').count(), 0, 'direct links are gated')
  const revision = await page.locator('meta[name="aura-revision"]').getAttribute('content')
  assert.ok(revision, 'production HTML identifies the loaded build')
  if (expected) assert.equal(revision, expected)
  await page.getByText(`Web build ${revision.slice(0, 8)}`, { exact: true }).waitFor()
  await button('Continue with GitHub').waitFor()
  await button('Create account').click()
  await button('Create email account').waitFor()
  assert.equal(await page.getByLabel('Password', { exact: true }).getAttribute('type'), 'password')

  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto(`${base}/settings#research-connection`, { waitUntil: 'domcontentloaded' })
  await heading('Sign in to AuraTrade').waitFor()
  assert.equal(await heading('Groq connection').count(), 0)
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'account entry fits a phone')
  const manifest = await page.request.get(`${base}/manifest.webmanifest`).then((response) => response.json())
  assert.equal(manifest.display, 'standalone')
  await page.evaluate(() => navigator.serviceWorker.ready)
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null)
  await context.setOffline(true)
  await page.reload({ waitUntil: 'domcontentloaded' })
  await heading('Sign in to AuraTrade').waitFor()
  assert.equal(await heading('Settings').count(), 0, 'offline shell cannot bypass sign-in')
  await context.setOffline(false)
  await page.goto(`${base}/auth/callback?error=access_denied`, { waitUntil: 'domcontentloaded' })
  await page.getByRole('alert').filter({ hasText: /Sign-in wasn’t completed/ }).waitFor()
  assert.equal(page.url(), `${base}/`)
  assert.deepEqual(errors, [], 'no unhandled errors from deployed browser assets')

  // Avoid sending credentials or using anyone’s linked GitHub session. Inspect
  // Supabase's real handoff to the public GitHub authorization endpoint only.
  if (base === 'https://auratrade-east-africa.vercel.app') {
    const authorize = page.waitForResponse((response) => {
      const target = new URL(response.url())
      return target.pathname === '/auth/v1/authorize' && target.searchParams.get('provider') === 'github'
    })
    await button('Continue with GitHub').click()
    const response = await authorize
    const request = new URL(response.url())
    const provider = new URL((await response.allHeaders()).location)
    assert.equal(response.status(), 302)
    assert.equal(request.searchParams.get('redirect_to'), `${base}/auth/callback`)
    assert.equal(request.searchParams.get('code_challenge_method'), 's256')
    assert.equal(provider.origin + provider.pathname, 'https://github.com/login/oauth/authorize')
    assert.equal(provider.searchParams.get('redirect_to'), `${base}/auth/callback`)
    assert.equal(new URL(provider.searchParams.get('redirect_uri')).origin, request.origin)
    console.log('Live GitHub OAuth handoff verified; no GitHub account was signed in.')
  }
  console.log(`Browser verified ${base} build ${revision.slice(0, 8)}: desktop and mobile account entry, callback recovery, and the installable offline shell.`)
})
