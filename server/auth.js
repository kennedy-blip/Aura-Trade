import { HttpError } from './http.js'

export async function identity(req, { admin = false } = {}) {
  const url = (process.env.SUPABASE_URL || '').replace(/\/$/, '')
  const key = process.env.SUPABASE_PUBLISHABLE_KEY
  if (!url || !key) throw new HttpError(503, 'Hosted authentication is not configured.')
  const token = /^Bearer ([\w.-]+)$/i.exec(req.headers.authorization || '')?.[1]
  if (!token || token.length > 8192) throw new HttpError(401, 'Sign in to continue.')
  const headers = { apikey: key, Authorization: `Bearer ${token}` }
  const upstream = await fetch(`${url}/auth/v1/user`, { headers, redirect: 'error', signal: AbortSignal.timeout(5000) })
  if (!upstream.ok) throw new HttpError(upstream.status >= 500 ? 503 : 401, upstream.status >= 500 ? 'Authentication is temporarily unavailable.' : 'Your session is no longer valid.')
  const user = await upstream.json()
  if (!user.id || user.is_anonymous === true) throw new HttpError(401, 'Sign in with a workspace account to continue.')
  const auth = { url, headers, user }
  const access = await deskRequest(auth, 'rpc/aura_workspace_access', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' }).then((response) => response.json())
  if (!access || !['admin', 'member'].includes(access.role) || typeof access.canUseGroq !== 'boolean') throw new HttpError(403, 'Workspace access could not be verified.')
  if (admin && access.role !== 'admin') throw new HttpError(403, 'Lead Quantitative Analyst privileges are required.')
  return { ...auth, role: access.role, canUseGroq: access.canUseGroq }
}
export async function deskRequest(auth, path, options = {}) {
  const upstream = await fetch(`${auth.url}/rest/v1/${path}`, { ...options, headers: { ...auth.headers, ...options.headers }, redirect: 'error', signal: AbortSignal.timeout(6000) })
  if (!upstream.ok) throw new HttpError(upstream.status === 401 || upstream.status === 403 ? 403 : 503, 'The workspace operation was not authorized or the database is unavailable.')
  return upstream
}
