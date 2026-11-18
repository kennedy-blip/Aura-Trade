import { App as NativeApp } from '@capacitor/app'
import { native, supabase, supabaseUrl } from './client.js'
import { authCallbackPath, workspaceReturnPath } from './authFlow.js'

export async function callbackUrl() {
  if (!native) return `${location.origin}${authCallbackPath}`
  const { id } = await NativeApp.getInfo()
  if (!/^[a-z][a-z0-9.]+$/.test(id)) throw new Error('Invalid Android app ID.')
  return `${id}://auth/callback`
}

const returnKey = 'aura-auth-return'
export function rememberWorkspacePath() {
  if (native) return
  try { localStorage.setItem(returnKey, workspaceReturnPath(location.pathname + location.search + location.hash)) } catch { /* storage availability is handled by Auth */ }
}
export function restoreWorkspacePath() {
  let target = '/'
  try { target = workspaceReturnPath(localStorage.getItem(returnKey)); localStorage.removeItem(returnKey) } catch { /* use the home route */ }
  history.replaceState(null, '', target)
}

export async function continueWithGitHub() {
  const redirectTo = await callbackUrl()
  rememberWorkspacePath()
  const { data, error } = await supabase.auth.signInWithOAuth({ provider: 'github', options: { redirectTo, skipBrowserRedirect: true } })
  if (error) throw error
  const url = new URL(data.url)
  if (url.protocol !== 'https:' || url.origin !== new URL(supabaseUrl).origin || url.pathname !== '/auth/v1/authorize') throw new Error('Invalid authorization URL.')
  url.searchParams.delete('skip_http_redirect')
  if (native) {
    const { Browser } = await import('@capacitor/browser')
    await Browser.open({ url: url.href })
  } else location.assign(url.href)
}
