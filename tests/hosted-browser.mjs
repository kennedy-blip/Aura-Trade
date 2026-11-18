import assert from 'node:assert/strict'
import { withChromium } from './chromium.mjs'

const base = new URL(process.argv[2]).origin
const expected = process.env.AURA_EXPECTED_REVISION
await withChromium(async (browser) => {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  const page = await context.newPage()
  page.setDefaultTimeout(15_000)
  const errors = []
  page.on('pageerror', (error) => { errors.push(error.message) })
  const panel = page.getByRole('region', { name: 'Groq connection', exact: true })
  const button = (name) => page.getByRole('button', { name, exact: true })
  const heading = (name) => page.getByRole('heading', { name, exact: true })
  await page.goto(`${base}/research`, { waitUntil: 'domcontentloaded' })
  await heading('Aura Research').waitFor()
  const revision = await page.locator('meta[name="aura-revision"]').getAttribute('content')
  assert.ok(revision, 'production HTML identifies the loaded build')
  if (expected) assert.equal(revision, expected)
  await page.getByText(`Web build ${revision.slice(0, 8)}`, { exact: true }).waitFor()
  await button('Groq setup').click()
  await page.waitForFunction(() => document.activeElement?.id === 'research-connection')
  await panel.getByText('Local answers are active. Groq isn’t used in this mode.', { exact: true }).waitFor()
  await button('Use my Groq key').click()
  assert.equal(await panel.getByLabel('Groq API key').getAttribute('type'), 'password')
  assert.equal(await button('Test Groq connection').isEnabled(), false, 'the browser cannot test Groq without a key')

  await page.getByRole('navigation', { name: 'Workspace', exact: true }).getByRole('link', { name: 'Market Pulse', exact: true }).click()
  await heading('Market Pulse').waitFor()
  await heading('Conditional outlook').waitFor()

  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto(`${base}/settings#research-connection`, { waitUntil: 'domcontentloaded' })
  await heading('Groq connection').waitFor()
  await page.waitForFunction(() => document.activeElement?.id === 'research-connection')
  const status = await page.request.get(`${base}/api/research`).then((response) => response.json())
  await panel.getByLabel('Answer mode').selectOption('hosted')
  await panel.getByText(status.groqConfigured ? /Sign in with an authorized workspace account/ : /no hosted Groq key configured/).waitFor()
  assert.equal(await button('Test Groq connection').isEnabled(), false, 'hosted Groq requires an authorized account')
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), 'Settings fits on mobile')
  assert.deepEqual(errors, [], 'no unhandled errors from deployed browser assets')
  console.log(`Browser verified ${base} build ${revision.slice(0, 8)} on desktop and mobile: Market Pulse, Groq setup, and authorization controls.`)
})
