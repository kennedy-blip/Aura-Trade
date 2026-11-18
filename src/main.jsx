import React from 'react'
import { createRoot } from 'react-dom/client'
import { MotionConfig } from 'framer-motion'
import '@fontsource-variable/inter/wght.css'
import '@fontsource-variable/manrope/wght.css'
import '@fontsource-variable/jetbrains-mono/wght.css'
import './styles/index.css'
import { App } from './App.jsx'
import DeskProvider from './context/DeskProvider.jsx'
import { native } from './lib/client.js'

createRoot(document.getElementById('root')).render(<React.StrictMode><MotionConfig reducedMotion="user" transition={{ type: 'spring', stiffness: 300, damping: 25 }}><DeskProvider><App /></DeskProvider></MotionConfig></React.StrictMode>)
if (import.meta.env.PROD && 'serviceWorker' in navigator && !native) {
  window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(() => {}))
}
