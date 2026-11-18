import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { build, preview } from 'vite'
import { withChromium } from './chromium.mjs'

const auth = 'https://aura-identity.test'
const outDir = await mkdtemp(join(tmpdir(), 'aura-account-'))
process.env.VITE_SUPABASE_URL = auth
process.env.VITE_SUPABASE_PUBLISHABLE_KEY = 'fixture-publishable-key'
process.env.VITE_AUTH_SITE_URL = ''
process.env.VITE_ENABLE_PREVIEW_ROLES = 'false'
process.env.AURA_FRED_ENABLED = 'false'
process.env.AURA_COMMUNITY_CRYPTO = 'false'
let server
try {
  await build({ build: { outDir, emptyOutDir: true }, logLevel: 'error' })
  server = await preview({ build: { outDir }, logLevel: 'error', preview: { host: '127.0.0.1', port: 0 } })
  const base = `http://127.0.0.1:${server.httpServer.address().port}`
  await withChromium(async (browser) => {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true })
    const page = await context.newPage()
    page.setDefaultTimeout(12_000)
    const errors = []
    page.on('pageerror', (error) => errors.push(error.message))
    const byButton = (name) => page.getByRole('button', { name, exact: typeof name === 'string' })
    const byHeading = (name) => page.getByRole('heading', { name, exact: true })
    const email = 'member@example.test'
    const password = 'fixture-passphrase'
    const account = (role) => ({ id: `fixture-${role}`, email: role === 'member' ? email : 'lead@example.test', aud: 'authenticated', role: 'authenticated', app_metadata: {}, user_metadata: { aura_role: 'admin' }, created_at: '2026-11-18T00:00:00Z' })
    const session = (role) => ({ user: account(role), access_token: `fixture-${role}-token`, refresh_token: `fixture-${role}-refresh`, expires_in: 3600, token_type: 'bearer' })
    const cors = { 'access-control-allow-origin': base, 'access-control-allow-headers': '*', 'access-control-allow-methods': 'GET, POST, OPTIONS', 'x-supabase-api-version': '2024-01-01' }
    let signup = false, confirmed = false, exchangeCount = 0, challenge, oauthDenied = true, providerTest = 0
    const authCode = '140bb3e6-9556-4a6f-824a-e45706d934fd'
    await context.route(`${auth}/auth/v1/**`, async (route) => {
      const request = route.request(), url = new URL(request.url())
      if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors })
      if (url.pathname.endsWith('/signup')) {
        const body = request.postDataJSON()
        assert.equal(body.email, email)
        assert.equal(body.password, password)
        assert.equal(url.searchParams.get('redirect_to'), `${base}/auth/callback`)
        assert.equal(body.code_challenge_method, 's256')
        signup = true
        return route.fulfill({ headers: cors, json: account('member') })
      }
      if (url.pathname.endsWith('/authorize')) {
        assert.equal(url.searchParams.get('provider'), 'github')
        assert.equal(url.searchParams.get('code_challenge_method'), 's256')
        challenge = url.searchParams.get('code_challenge')
        assert.match(challenge, /^[A-Za-z0-9_-]{43}$/)
        const target = url.searchParams.get('redirect_to')
        assert.equal(target, `${base}/auth/callback`)
        return route.fulfill({ status: 302, headers: { location: `${target}${oauthDenied ? '?error=access_denied' : `?code=${authCode}`}` } })
      }
      if (url.pathname.endsWith('/token')) {
        const body = request.postDataJSON()
        if (url.searchParams.get('grant_type') === 'pkce') {
          assert.equal(body.auth_code, authCode)
          assert.equal(createHash('sha256').update(body.code_verifier).digest('base64url'), challenge)
          exchangeCount++
          return route.fulfill({ headers: cors, json: session('admin') })
        }
        assert.equal(url.searchParams.get('grant_type'), 'password')
        assert.equal(body.email, email)
        if (body.password !== password) return route.fulfill({ status: 400, headers: cors, json: { error_code: 'invalid_credentials', msg: 'Fixture error.' } })
        if (!confirmed) return route.fulfill({ status: 400, headers: cors, json: { error_code: 'email_not_confirmed', msg: 'Fixture error.' } })
        return route.fulfill({ headers: cors, json: session('member') })
      }
      if (url.pathname.endsWith('/logout')) return route.fulfill({ status: 204, headers: cors })
      assert.fail(`Unexpected fixture request ${url.pathname}`)
    })
    await context.route('**/api/workspace**', async (route) => {
      const admin = route.request().headers().authorization === 'Bearer fixture-admin-token'
      const { id, email } = account(admin ? 'admin' : 'member')
      await route.fulfill({ json: { id, email, role: admin ? 'admin' : 'member', canUseGroq: admin, settings: null } })
    })
    await context.route('**/api/research', async (route) => {
      if (route.request().method() === 'GET') return route.fulfill({ json: { groqConfigured: true, authConfigured: true } })
      assert.equal(route.request().headers().authorization, 'Bearer fixture-admin-token')
      assert.deepEqual(route.request().postDataJSON(), { test: true })
      providerTest++
      return route.fulfill({ json: { connected: true } })
    })

    await page.goto(`${base}/settings#research-connection`)
    await byHeading('Sign in to AuraTrade').waitFor()
    assert.equal(await byHeading('Settings').count(), 0)
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'mobile sign-in fits the viewport')
    await byButton('Create account').click()
    await page.getByLabel('Email', { exact: true }).fill(email)
    await page.getByLabel('Password', { exact: true }).fill(password)
    await byButton('Create email account').click()
    await page.getByText('Check your email', { exact: true }).waitFor()
    assert.equal(signup, true)
    assert.equal(await byHeading('Settings').count(), 0)
    await byButton('Return to sign-in').click()
    await page.getByLabel('Password', { exact: true }).fill('incorrect-passphrase')
    await byButton('Sign in').click()
    await page.getByRole('alert').filter({ hasText: /did not match/ }).waitFor()
    await page.getByLabel('Password', { exact: true }).fill(password)
    await byButton('Sign in').click()
    await page.getByRole('alert').filter({ hasText: /Confirm your email/ }).waitFor()
    confirmed = true
    await byButton('Sign in').click()
    await byHeading('Workspace account').waitFor()
    await page.getByText('Verified · Research Member', { exact: true }).waitFor()
    assert.equal(await byButton(/Lead Quantitative Analyst/).isEnabled(), false)
    await page.getByLabel('Answer mode').selectOption('hosted')
    await page.getByText(/This account does not have access to the shared key/).waitFor()
    assert.equal(await byButton('Test Groq connection').isEnabled(), false)
    assert.equal(await byHeading('Lead Analyst controls').count(), 0)
    await page.reload()
    await byHeading('Workspace account').waitFor()
    await byButton('Sign out').click()
    await byHeading('Sign in to AuraTrade').waitFor()
    await byButton('Continue with GitHub').click()
    await page.getByRole('alert').filter({ hasText: /Sign-in wasn’t completed/ }).waitFor()
    assert.equal(new URL(page.url()).pathname, '/settings')

    oauthDenied = false
    await byButton('Continue with GitHub').click()
    await page.getByText('Verified · Lead Analyst and hosted research access granted', { exact: true }).waitFor()
    assert.equal(exchangeCount, 1)
    assert.equal(page.url(), `${base}/settings#research-connection`)
    await byButton(/Lead Quantitative Analyst/).click()
    await byHeading('Lead Analyst controls').waitFor()
    await byButton('Use workspace Groq').click()
    await byButton('Test Groq connection').click()
    await page.getByText('Groq replied successfully.', { exact: true }).waitFor()
    assert.equal(providerTest, 1)

    await page.evaluate(() => navigator.serviceWorker.ready)
    await page.waitForFunction(() => navigator.serviceWorker.controller !== null)
    await context.setOffline(true)
    await page.reload()
    await byHeading('Workspace account').waitFor()
    await page.getByText('Offline · hosted privileges are paused', { exact: true }).waitFor()
    assert.equal(await byButton(/Lead Quantitative Analyst/).isEnabled(), false)
    assert.equal(await byButton('Test Groq connection').isEnabled(), false)
    await context.setOffline(false)
    await byButton('Sign out').click()
    await byHeading('Sign in to AuraTrade').waitFor()
    assert.deepEqual(errors, [])
    console.log('Account browser verified mobile email signup and sign-in with fixtures, GitHub PKCE success/cancellation, member and Lead permissions, hosted research test, and offline session restoration.')
  })
} finally {
  if (server) await new Promise((resolve) => server.httpServer.close(resolve))
  await rm(outDir, { recursive: true, force: true })
}
