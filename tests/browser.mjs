import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { preview } from 'vite'
import { withChromium } from './chromium.mjs'

process.env.AURA_FRED_ENABLED = 'false'
process.env.AURA_COMMUNITY_CRYPTO = 'false'
const server = await preview({ preview: { host: '127.0.0.1', port: 4179, strictPort: true } })
await withChromium(async (browser) => {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, acceptDownloads: true })
  const page = await context.newPage()
  page.setDefaultTimeout(10000)
  const errors = []
  page.on('pageerror', (error) => { errors.push(error.message); console.error(error) })
  const url = 'http://127.0.0.1:4179'
  const byButton = (name) => page.getByRole('button', { name, exact: true })
  const byHeading = (name) => page.getByRole('heading', { name, exact: true })
  const nav = (name) => page.getByRole('complementary').getByRole('link', { name, exact: true }).first()
  const sampleAt = Date.now() - 45_000
  let pulseCount = 0, bumped = false, rejectGroq = false
  const mockKey = 'gsk_' + 'f'.repeat(44)
  const requested = []
  page.on('request', (request) => {
    const outsideGroq = new URL(request.url()).origin !== 'https://api.groq.com'
    if (request.postData()?.includes(mockKey) || (outsideGroq && request.headers().authorization?.includes(mockKey))) requested.push(request.url())
  })
  await page.route('**/api/pulse**', async (route) => {
    const query = new URL(route.request().url()).searchParams
    const id = query.get('history')
    if (id && id !== 'btc-usd') { await route.continue(); return }
    if (id) {
      const interval = query.get('interval')
      const points = Array.from({ length: 60 }, (_, i) => {
        const at = new Date(sampleAt - (60 - i) * (interval === '1m' ? 60_000 : 86400_000)).toISOString()
        return [interval === '1m' ? at : at.slice(0, 10), 62900 + i * 18 + i % 4 * 5]
      })
      await route.fulfill({ json: { history: { id, points, name: 'Test market source', url: 'https://prices.example/btc', cadence: interval === '1m' ? 'Minute reference rates' : 'Daily reference rates', archived: false } } })
      return
    }
    pulseCount++
    const price = bumped ? 64200 : 64020
    await route.fulfill({ json: { checkedAt: new Date().toISOString(), interval: 15000, sources: [{ id: 'community', state: 'ok' }, { id: 'licensed', state: 'off' }], quotes: [{ id: 'btc-usd', at: new Date(sampleAt + (bumped ? 16_000 : 0)).toISOString(), price, health: 'ok', provider: 'community', mode: 'indicative', source: 'Test market source', url: 'https://prices.example/btc' }] } })
  })
  await page.route('https://api.groq.com/openai/v1/chat/completions', async (route) => {
    const headers = { 'access-control-allow-origin': '*', 'access-control-allow-headers': 'authorization, content-type', 'access-control-allow-methods': 'POST, OPTIONS' }
    if (route.request().method() === 'OPTIONS') { await route.fulfill({ status: 204, headers }); return }
    assert.equal(route.request().headers().authorization, `Bearer ${mockKey}`)
    await route.fulfill({ status: rejectGroq ? 429 : 200, headers, json: rejectGroq ? { error: { message: 'Limit reached' } } : { choices: [{ message: { content: 'The cited evidence should be treated as observations, not execution prices.' } }] } })
  })
  await page.goto(url)
  await byHeading('Market Terminal').waitFor()
  const revision = await page.locator('meta[name="aura-revision"]').getAttribute('content')
  assert.match(revision, /^(?:[a-f0-9]{40}|local)$/)
  await page.getByText(`Web build ${revision.slice(0, 8)}`, { exact: true }).waitFor()
  await page.evaluate(() => navigator.serviceWorker.ready)
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null)
  const widths = () => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)
  assert.ok(await widths(), 'desktop does not overflow')

  await byButton('1W').click()
  assert.equal(await byButton('1W').getAttribute('aria-pressed'), 'true')
  await page.getByLabel('Chart instrument').selectOption('nasi')
  await byHeading('NSE All Share Index').waitFor()
  await byButton('Expand chart').click()
  await page.getByRole('dialog', { name: 'NSE All Share Index' }).waitFor()
  await page.keyboard.press('Escape')
  await page.keyboard.press('Control+k')
  await page.getByLabel('Search commands').fill('Kenya Inflation')
  await page.keyboard.press('Enter')
  await byHeading('Macro Engine').waitFor()
  await page.getByText('SELECTED INDICATOR', { exact: true }).waitFor()
  await byButton('Shock Lab').click()
  await byButton('Fuel price spike').click()
  assert.equal(await page.getByRole('slider', { name: /EPRA fuel/ }).inputValue(), '10')
  await byButton('Reset shocks').click()
  assert.equal(await page.getByRole('slider', { name: /EPRA fuel/ }).inputValue(), '0')

  await nav('Market Pulse').click()
  await byHeading('Market Pulse').waitFor()
  await page.locator('.pulse-quote').getByText('64,020.00 USD', { exact: true }).waitFor()
  await byHeading('Conditional outlook').waitFor()
  await page.getByText('Upper range break', { exact: true }).waitFor()
  await byButton('1M').click()
  await page.getByText(/Daily reference rates ·/).waitFor()
  await page.getByLabel('Price target').fill('64100')
  await byButton('Add alert').click()
  await page.getByText('Market alert armed.', { exact: true }).waitFor()
  await byButton('Check quotes').click()
  await byButton('Check quotes').waitFor()
  await page.waitForFunction(async () => {
    return new Promise((resolve, reject) => {
      const open = indexedDB.open('auratrade-east-africa')
      open.onerror = () => reject(open.error)
      open.onsuccess = () => {
        const connection = open.result
        const rows = connection.transaction('marketRules').objectStore('marketRules').getAll()
        rows.onsuccess = () => { connection.close(); resolve(rows.result.some((row) => row.scope === 'local' && row.latest?.price === 64020)) }
        rows.onerror = () => { connection.close(); reject(rows.error) }
      }
    })
  })
  const beforePulse = pulseCount
  bumped = true
  await page.locator('.pulse-alert').getByText('BTC/USD crossed above 64,100.00').waitFor({ timeout: 20_000 })
  assert.ok(pulseCount > beforePulse, '15-second foreground refresh made a new request')
  await byButton('Mark alerts read').click()
  await page.locator('.pulse-alert:not(.unread)').waitFor()
  await byButton('Kenya').click()
  await page.getByRole('button', { name: /NSE 20 Kenya/ }).click()
  await page.locator('.pulse-quote').getByText('Dated reference', { exact: true }).waitFor()
  await page.getByText('No fresh quote for this instrument.', { exact: false }).waitFor()

  await nav('AI Research').click()
  await byHeading('Aura Research').waitFor()
  await page.getByLabel('Research question').fill('How do EPRA fuel prices affect NSE industrials?')
  await byButton('Send').click()
  await byHeading('From fuel caps to margins and FX').waitFor()
  const researchEvidence = page.getByRole('link', { name: /EPRA Petroleum Price Review/ })
  assert.match(await researchEvidence.getAttribute('href'), /epra\.go\.ke/)

  await page.getByText('Hosted Groq is not configured on this deployment.', { exact: true }).waitFor()
  await byButton('Event studies').click()
  await byButton('Groq setup').click()
  await page.waitForFunction(() => document.activeElement?.id === 'research-connection')
  await byButton('Use my Groq key').click()
  await page.getByText('LOCAL · GROQ SETUP NEEDED', { exact: true }).waitFor()
  assert.equal(await byButton('Test Groq connection').isEnabled(), false)
  await page.getByLabel('Groq API key').fill(mockKey)
  await page.getByRole('checkbox', { name: 'Remember on this device' }).check()
  await byButton('Save key').click()
  await byButton('Test Groq connection').click()
  await page.getByText('Groq replied successfully.', { exact: true }).waitFor()
  await page.getByLabel('Research question').fill('Explain BTC volatility.')
  await byButton('Send').click()
  await byHeading('Groq research brief').waitFor()
  await page.reload()
  await byHeading('Groq research brief').waitFor()
  assert.equal(await page.getByLabel('Answer mode').inputValue(), 'device')
  rejectGroq = true
  await page.getByLabel('Research question').fill('How is GDP related to tea exports?')
  await byButton('Send').click()
  await byHeading('Real activity and export flows').waitFor()
  await page.getByText(/Groq’s usage limit was reached.*Showing local research instead/).waitFor()
  assert.deepEqual(requested, [], 'the key is sent only in the Groq Authorization header')
  await byButton('Manage Groq key').click()
  await byButton('Remove key').click()
  assert.equal(await page.getByLabel('Answer mode').inputValue(), 'local')
  await byButton('Event studies').click()
  await page.getByRole('button', { name: /June 2025 · CBK cuts by 25 bps/ }).click()
  await page.getByText('9.75% CBR', { exact: true }).waitFor()

  await nav('Paper Trading').click()
  await byButton('Fund with M-Pesa').click()
  await byButton('Simulate STK push').click()
  await byButton('Approve payment').click()
  await byButton('Done').click()
  await page.getByText('KES 105,000.00', { exact: true }).first().waitFor()
  await byButton('Buy SCOM (paper)').click()
  await page.getByRole('cell', { name: /BUY SCOM/ }).waitFor()
  const book = page.getByRole('table', { name: 'SCOM simulated order book' })
  await book.waitFor()
  const bid = book.locator('tbody tr').first().locator('td').nth(1)
  const firstBid = await bid.innerText()
  await byButton('Next replay day').click()
  await page.getByText('Paper replay · Day 1', { exact: true }).waitFor()
  assert.notEqual(await bid.innerText(), firstBid)
  await page.getByLabel('Order instrument').selectOption('KCB')
  await page.getByRole('table', { name: 'KCB simulated order book' }).waitFor()
  assert.equal(await byButton('Reset paper wallet').count(), 0)
  await page.goto(`${url}/compliance`)
  await byHeading('Compliance Hub').waitFor()
  await byButton('Tax estimator').click()
  await byButton('Calculate estimate').click()
  await page.getByText('KES 6,750.00', { exact: true }).waitFor()
  assert.equal(await byButton('Export audit').count(), 0)
  await nav('Settings').click()
  await page.getByRole('button', { name: /Savannah Wealth/ }).click()
  assert.equal(await page.locator('html').getAttribute('data-theme'), 'savannah')
  await page.getByRole('button', { name: /Terminal Amber/ }).click()
  assert.equal(await page.locator('html').getAttribute('data-theme'), 'amber')
  await page.getByRole('button', { name: /Lead Quantitative Analyst/ }).click()
  await byHeading('Lead Analyst controls').waitFor()
  await page.getByLabel('CPI sensitivity to fuel').fill('0.075')
  await byButton('Save configuration').click()
  await page.getByText('Desk configuration saved.', { exact: true }).waitFor()

  await byButton('Download Android APK').click()
  const dialog = page.getByRole('dialog', { name: 'Get AuraTrade for Android' })
  await dialog.waitFor()
  const manifest = await context.request.get(`${url}/app/android.json`)
  if (manifest.ok() && manifest.headers()['content-type']?.includes('json')) {
    const handle = page.waitForEvent('download')
    await dialog.getByRole('link', { name: 'Download Android APK', exact: true }).click()
    const apk = await handle
    const metadata = await manifest.json(), bytes = await readFile(await apk.path())
    assert.equal(apk.suggestedFilename(), metadata.url.split('/').at(-1))
    assert.equal(bytes.length, metadata.bytes)
    assert.equal(bytes.readUInt32LE(0), 0x04034b50)
    assert.equal(createHash('sha256').update(bytes).digest('hex'), metadata.sha256)
  } else await dialog.getByText('No APK has been published', { exact: false }).waitFor()
  await page.keyboard.press('Escape')
  await page.setViewportSize({ width: 390, height: 844 })
  const mobile = page.getByRole('navigation', { name: 'Mobile workspace' })
  await mobile.getByRole('link', { name: 'Terminal', exact: true }).click()
  await byHeading('Market Terminal').waitFor()
  assert.ok(await widths(), 'mobile does not overflow')
  await mobile.getByRole('link', { name: 'Pulse', exact: true }).click()
  await byHeading('Market Pulse').waitFor()
  assert.ok(await widths(), 'mobile Market Pulse does not overflow')
  await mobile.getByRole('link', { name: 'Terminal', exact: true }).click()
  await byHeading('Market Terminal').waitFor()
  await context.setOffline(true)
  await page.reload()
  await byHeading('Market Terminal').waitFor()
  await page.getByText('Offline mode.', { exact: false }).waitFor()
  await mobile.getByRole('link', { name: 'Paper Sim', exact: true }).click()
  await page.getByRole('cell', { name: 'SCOM', exact: true }).waitFor()
  await byButton('Open navigation').click()
  await page.getByRole('dialog').getByRole('link', { name: 'AI Research', exact: false }).click()
  await byHeading('From fuel caps to margins and FX').waitFor()
  assert.deepEqual(errors, [], 'no unhandled browser errors')
  console.log('Browser smoke passed: dashboard, chart, scope search, sourced history, 15s pulse and price alert, Groq success and fallback, paper fills, STK flow, taxation, roles, themes, APK center, and offline reload.')
}).finally(() => new Promise((resolve) => server.httpServer.close(resolve)))
