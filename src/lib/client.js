import { Capacitor } from '@capacitor/core'
import { createClient } from '@supabase/supabase-js'

const env = import.meta.env
export const native = Capacitor.isNativePlatform()
const endpoint = (env.VITE_API_BASE_URL || '').trim().replace(/\/$/, '')
export const hasHostedApi = !native || endpoint.startsWith('https://')
function httpsOrigin(value) {
  try { const url = new URL(value); return url.protocol === 'https:' && !url.username && !url.password ? url.origin : '' } catch { return '' }
}
export const publicAuthUrl = httpsOrigin(env.VITE_AUTH_SITE_URL)
export const supabaseUrl = env.VITE_SUPABASE_URL
export const supabase = supabaseUrl && env.VITE_SUPABASE_PUBLISHABLE_KEY ? createClient(supabaseUrl, env.VITE_SUPABASE_PUBLISHABLE_KEY, { auth: { flowType: 'pkce', detectSessionInUrl: false } }) : null
export const requiresAccount = Boolean(supabase) || native || env.VITE_REQUIRE_ACCOUNT === 'true'
export const previewRoles = !requiresAccount && env.VITE_ENABLE_PREVIEW_ROLES !== 'false'
export const apkUrl = (env.VITE_ANDROID_APK_URL || '').startsWith('https://') ? env.VITE_ANDROID_APK_URL : null
export async function api(path, { method = 'GET', token, body, timeout = 8500 } = {}) {
  if (!hasHostedApi || !navigator.onLine) throw new Error('The hosted service is unavailable offline.')
  const controller = new AbortController()
  const cancel = setTimeout(() => controller.abort(), timeout)
  try {
    const url = `${native ? endpoint : ''}/api/${path}`
    const response = await fetch(url, { method, credentials: 'omit', signal: controller.signal, headers: { Accept: 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(body ? { 'Content-Type': 'application/json' } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) })
    if (!response.headers.get('content-type')?.includes('application/json')) throw new Error('The hosted service did not return data.')
    const result = await response.json()
    if (!response.ok) throw new Error(result.error || 'The request could not be completed.')
    return result
  } catch (error) {
    if (error instanceof TypeError) throw new Error('Could not reach the hosted service. Check your connection and try again.', { cause: error })
    if (error.name === 'AbortError') throw new Error('The hosted service did not respond in time.', { cause: error })
    throw error
  } finally { clearTimeout(cancel) }
}
