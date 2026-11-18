import assert from 'node:assert/strict'
import { createReadStream, createWriteStream } from 'node:fs'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createBrotliDecompress } from 'node:zlib'
import { pipeline } from 'node:stream/promises'
import { spawnSync } from 'node:child_process'
import { chromium as playwright } from 'playwright-core'
import chromium from '@sparticuz/chromium'

export async function withChromium(run) {
  const temp = await mkdtemp(join(tmpdir(), 'aura-browser-'))
  const system = process.env.AURA_CHROMIUM
  let browser
  try {
    if (!system) {
      const root = dirname(fileURLToPath(import.meta.resolve('@sparticuz/chromium')))
      const tar = join(temp, 'libs.tar')
      await pipeline(createReadStream(join(root, '..', 'bin', 'al2023.tar.br')), createBrotliDecompress(), createWriteStream(tar))
      const extract = spawnSync('tar', ['-xf', tar, '-C', temp])
      assert.equal(extract.status, 0, 'extract Chromium shared libraries')
    }
    browser = await playwright.launch({
      executablePath: system || await chromium.executablePath(),
      headless: true,
      args: system ? ['--no-sandbox'] : ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
      env: { ...process.env, LD_LIBRARY_PATH: [join(temp, 'lib'), process.env.LD_LIBRARY_PATH].filter(Boolean).join(':') },
    })
    return await run(browser)
  } finally {
    try { await browser?.close() } finally { await rm(temp, { force: true, recursive: true }) }
  }
}
