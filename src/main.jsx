import React from 'react'
import { createRoot } from 'react-dom/client'
import { MotionConfig } from 'framer-motion'
import '@fontsource-variable/inter/wght.css'
import '@fontsource-variable/manrope/wght.css'
import '@fontsource-variable/jetbrains-mono/wght.css'
import './styles/index.css'
import { App } from './App.jsx'
import DeskProvider from './context/DeskProvider.jsx'
import { useAuthSession } from './context/useAuthSession.js'
import WorkspaceEntry from './components/WorkspaceEntry.jsx'
import { native, requiresAccount } from './lib/client.js'

function WorkspaceRoot() {
  const { session, ready, issue } = useAuthSession()
  if (requiresAccount && (!ready || !session?.user)) return <WorkspaceEntry ready={ready} issue={issue}/>
  return <DeskProvider key={session?.user?.id || 'local'} session={session}><App /></DeskProvider>
}

createRoot(document.getElementById('root')).render(<React.StrictMode><MotionConfig reducedMotion="user" transition={{ type: 'spring', stiffness: 300, damping: 25 }}><WorkspaceRoot /></MotionConfig></React.StrictMode>)
if (import.meta.env.PROD && 'serviceWorker' in navigator && !native) {
  window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js', { updateViaCache: 'none' }).catch(() => {}))
}
