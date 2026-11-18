import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { tmpdir } from 'node:os'
import { fileURLToPath } from 'node:url'
import { createReadStream, createWriteStream } from 'node:fs'
import { createBrotliDecompress } from 'node:zlib'
import { pipeline } from 'node:stream/promises'
import { spawnSync } from 'node:child_process'
import { chromium as playwright } from 'playwright-core'
import chromium from '@sparticuz/chromium'
import { preview } from 'vite'

const temp = await mkdtemp(join(tmpdir(), 'aura-browser-'))
const root = dirname(fileURLToPath(import.meta.resolve('@sparticuz/chromium')))
const tar = join(temp, 'libs.tar')
if (!process.env.AURA_CHROMIUM) {
  await pipeline(createReadStream(join(root, '..', 'bin', 'al2023.tar.br')), createBrotliDecompress(), createWriteStream(tar))
  const extract = spawnSync('tar', ['-xf', tar, '-C', temp])
  assert.equal(extract.status, 0, 'extract Chromium shared libraries')
}
process.env.AURA_FRED_ENABLED = 'false'
const server = await preview({ preview: { host: '127.0.0.1', port: 4179, strictPort: true } })
let browser
try {
  browser = await playwright.launch({ executablePath: process.env.AURA_CHROMIUM || await chromium.executablePath(), headless: true, args: process.env.AURA_CHROMIUM ? ['--no-sandbox'] : ['--no-sandbox','--disable-dev-shm-usage','--disable-gpu'], env: { ...process.env, LD_LIBRARY_PATH: [join(temp, 'lib'), process.env.LD_LIBRARY_PATH].filter(Boolean).join(':') } })
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, acceptDownloads: true })
  const page = await context.newPage()
  page.setDefaultTimeout(10000)
  const errors = []
  page.on('pageerror', (error) => { errors.push(error.message); console.error(error) })
  const url = 'http://127.0.0.1:4179'
  const byButton = (name) => page.getByRole('button', { name, exact: true })
  const byHeading = (name) => page.getByRole('heading', { name, exact: true })
  const nav = (name) => page.getByRole('complementary').getByRole('link', { name, exact: true }).first()
  await page.goto(url)
  await byHeading('Market Terminal').waitFor()
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

  await nav('AI Research').click()
  await byHeading('Aura Research').waitFor()
  await page.getByLabel('Research question').fill('How do EPRA fuel prices affect NSE industrials?')
  await byButton('Send').click()
  await byHeading('From fuel caps to margins and FX').waitFor()
  const researchEvidence = page.getByRole('link', { name: /EPRA Petroleum Price Review/ })
  assert.match(await researchEvidence.getAttribute('href'), /epra\.go\.ke/)
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
  console.log('Browser smoke passed: dashboard, chart, search, shock lab, research, paper fills, STK flow, taxation, roles, themes, APK center, and offline reload.')
} finally {
  await browser?.close()
  await new Promise((resolve) => server.httpServer.close(resolve))
  await rm(temp, { force: true, recursive: true })
}
