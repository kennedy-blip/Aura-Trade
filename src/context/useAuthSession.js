import { useEffect, useRef, useState } from 'react'
import { App as NativeApp } from '@capacitor/app'
import { native, supabase } from '../lib/client.js'
import { callbackUrl, restoreWorkspacePath } from '../lib/authClient.js'
import { authCallbackPath, readAuthReturn } from '../lib/authFlow.js'

export function useAuthSession() {
  const [session, setSession] = useState(null)
  const [ready, setReady] = useState(!supabase)
  const [issue, setIssue] = useState('')
  const handled = useRef(null)
  useEffect(() => {
    if (!supabase) return
    let active = true, listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, value) => {
      if (active) setSession(value)
    })
    async function complete(url, expected) {
      const result = readAuthReturn(url, expected)
      if (!active || !result || handled.current === url) return
      handled.current = url
      if (!native) restoreWorkspacePath()
      if (result.error) { setIssue(result.error); return }
      setReady(false)
      try {
        const { error } = await supabase.auth.exchangeCodeForSession(result.code, result.flowId ? { flowId: result.flowId } : undefined)
        if (error) throw error
        if (active) setIssue('')
      } catch {
        if (active) setIssue('This sign-in link expired or was opened in a different browser. Start again here, or sign in with your confirmed email.')
      } finally { if (active) setReady(true) }
    }
    async function open() {
      try {
        const expected = await callbackUrl()
        if (!active) return
        if (native) {
          const handle = await NativeApp.addListener('appUrlOpen', ({ url }) => { void complete(url, expected) })
          if (!active) { await handle.remove(); return }
          listener = handle
          const result = await NativeApp.getLaunchUrl()
          if (result?.url) await complete(result.url, expected)
        } else if (location.pathname === authCallbackPath) await complete(location.href, expected)
        const { data } = await supabase.auth.getSession()
        if (active) setSession(data.session)
      } catch {
        if (active) setIssue('Could not restore your sign-in. Connect to the internet and try again.')
      } finally { if (active) setReady(true) }
    }
    void open()
    return () => { active = false; subscription.unsubscribe(); void listener?.remove().catch(() => {}) }
  }, [])
  return { session: session?.user?.is_anonymous ? null : session, ready, issue }
}
