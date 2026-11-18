export class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status }
}
export async function readJson(req, max = 8192) {
  if (!String(req.headers['content-type'] || '').toLowerCase().startsWith('application/json')) throw new HttpError(415, 'Send JSON for this request.')
  if (Number(req.headers['content-length']) > max) throw new HttpError(413, 'The request is too large.')
  let text = ''
  if (req.body !== undefined) text = typeof req.body === 'string' ? req.body : JSON.stringify(req.body)
  else for await (const chunk of req) {
    text += chunk.toString('utf8')
    if (Buffer.byteLength(text) > max) throw new HttpError(413, 'The request is too large.')
  }
  if (Buffer.byteLength(text) > max) throw new HttpError(413, 'The request is too large.')
  try { return JSON.parse(text) } catch { throw new HttpError(400, 'Invalid JSON.') }
}
export function route(methods, action, { publicCache = false } = {}) {
  return async (req, res) => {
    const origin = req.headers.origin
    const allowed = (process.env.AURA_ALLOWED_ORIGINS || '').split(',').map((item) => item.trim())
    if (origin && allowed.includes(origin)) {
      res.setHeader('Access-Control-Allow-Origin', origin)
      res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type')
      res.setHeader('Access-Control-Max-Age', '600')
      res.setHeader('Access-Control-Allow-Methods', [...methods, 'OPTIONS'].join(', '))
    }
    res.setHeader('Vary', 'Origin')
    res.setHeader('X-Content-Type-Options', 'nosniff')
    res.setHeader('Content-Type', 'application/json; charset=utf-8')
    res.setHeader('Cache-Control', 'no-store')
    if (req.method === 'OPTIONS') { res.statusCode = origin && allowed.includes(origin) ? 204 : 403; return res.end() }
    try {
      if (!methods.includes(req.method)) {
        res.setHeader('Allow', [...methods, 'OPTIONS'].join(', '))
        throw new HttpError(405, 'Method not allowed.')
      }
      const result = await action(req)
      if (publicCache) res.setHeader('Cache-Control', typeof publicCache === 'string' ? publicCache : 'public, max-age=60, s-maxage=900, stale-while-revalidate=120')
      res.end(JSON.stringify(result))
    } catch (err) {
      res.statusCode = err instanceof HttpError ? err.status : 500
      res.end(JSON.stringify({ error: err instanceof HttpError ? err.message : 'The upstream service could not complete this request.' }))
    }
  }
}
export async function providerText(url, timeout = 5500, max = 750_000, headers = {}) {
  const res = await fetch(url, { signal: AbortSignal.timeout(timeout), redirect: 'error', headers: { Accept: 'application/json, text/csv, text/html;q=0.7, */*;q=0.2', ...headers } })
  if (!res.ok || !res.body || Number(res.headers.get('content-length')) > max) throw new Error('Feed unavailable.')
  const parts = []
  let length = 0
  for await (const chunk of res.body) {
    length += chunk.byteLength
    if (length > max) throw new Error('Feed too large.')
    parts.push(Buffer.from(chunk))
  }
  return Buffer.concat(parts, length).toString('utf8')
}
