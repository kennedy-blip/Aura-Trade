import { identity, deskRequest } from '../server/auth.js'
import { HttpError, readJson, route } from '../server/http.js'
import { validateSettings } from '../src/lib/models.js'
export default route(['GET','PUT'], async (req) => {
  const auth = await identity(req, { admin: req.method === 'PUT' })
  const { user, role } = auth
  if (req.method === 'GET') {
    const stored = role === 'admin' && new URL(req.url, 'http://internal').searchParams.get('settings') === '1'
      ? (await (await deskRequest(auth, `aura_desk_settings?select=config&owner=eq.${encodeURIComponent(user.id)}`)).json())[0]?.config || null : null
    let settings = null
    try { if (stored) settings = validateSettings(stored) } catch { settings = null }
    return { id: user.id, email: user.email, role, settings }
  }
  const body = await readJson(req)
  let settings
  try { settings = validateSettings(body) } catch (error) { throw new HttpError(400, error.message) }
  await deskRequest(auth, 'aura_desk_settings?on_conflict=owner', { method: 'POST', headers: { 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates,return=minimal' }, body: JSON.stringify({ owner: user.id, config: settings, updated_at: new Date().toISOString() }) })
  return { settings }
})
