export const authCallbackPath = '/auth/callback'
const routes = new Set(['/', '/markets', '/macro', '/research', '/paper', '/compliance', '/settings'])

export function workspaceReturnPath(value) {
  if (typeof value !== 'string' || !value.startsWith('/') || value.startsWith('//') || value.includes('\\') || value.length > 1024) return '/'
  try {
    const url = new URL(value, 'https://workspace.invalid')
    if (url.origin !== 'https://workspace.invalid' || !routes.has(url.pathname)) return '/'
    for (const key of ['account', 'code', 'sb_flow_id', 'access_token', 'refresh_token']) url.searchParams.delete(key)
    return url.pathname + url.search + url.hash
  } catch { return '/' }
}

export function readAuthReturn(value, callback) {
  let url, expected
  try { url = new URL(value); expected = new URL(callback) } catch { return null }
  if (url.protocol !== expected.protocol || url.host !== expected.host || url.pathname !== expected.pathname || url.username || url.password) return null
  const fragment = new URLSearchParams(url.hash.slice(1))
  if (url.searchParams.has('error') || url.searchParams.has('error_code') || fragment.has('error') || fragment.has('error_code')) return { error: 'Sign-in wasn’t completed. Try again, or sign in with your email.' }
  if (url.hash || url.searchParams.has('access_token') || url.searchParams.has('refresh_token')) return { error: 'This link can’t be used to sign in. Start again from the sign-in screen.' }
  const codes = url.searchParams.getAll('code')
  if (codes.length !== 1 || !/^[A-Za-z0-9_-]{16,160}$/.test(codes[0])) return { error: 'Return to the app or browser where you started, then sign in.' }
  const flowId = url.searchParams.get('sb_flow_id')
  return { code: codes[0], flowId: /^[A-Za-z0-9_-]{8,64}$/.test(flowId || '') ? flowId : undefined }
}

export function authMessage(error) {
  if (error?.code === 'email_not_confirmed') return 'Confirm your email first, then sign in.'
  if (error?.code === 'invalid_credentials') return 'That email and password did not match. If you used GitHub before, continue with GitHub.'
  if (error?.code === 'email_address_not_authorized' || error?.code === 'unexpected_failure') return 'The provider couldn’t complete this request. If confirmation email isn’t available for your address, continue with GitHub.'
  if (error?.code === 'over_email_send_rate_limit' || error?.status === 429) return 'Too many attempts. Wait a moment before trying again, or use GitHub.'
  if (error?.code === 'signup_disabled') return 'Email account creation is unavailable. Use GitHub or contact your workspace owner.'
  if (error?.code === 'weak_password') return 'Choose a stronger password of at least 8 characters.'
  if (error?.code === 'provider_disabled' || error?.code === 'validation_failed') return 'The identity provider could not start sign-in. Check your details or try the other sign-in method.'
  return 'Couldn’t complete sign-in. Check your connection and try again.'
}
