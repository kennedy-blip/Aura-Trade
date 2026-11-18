import { useEffect, useState } from 'react'
import { ArrowDownToLine, ExternalLink, HardDriveDownload, ShieldCheck, Smartphone, WifiOff } from 'lucide-react'
import { apkUrl, native } from '../lib/client.js'
import { num } from '../lib/format.js'
import { Modal } from './common.jsx'

const fallback = { kind: 'unavailable' }
export default function DownloadAPKModal({ close }) {
  const [artifact, setArtifact] = useState(apkUrl ? { url: apkUrl, kind: 'release' } : null)
  useEffect(() => {
    if (apkUrl) return
    const request = new AbortController()
    const timer = setTimeout(() => { request.abort(); setArtifact(fallback) }, 8000)
    fetch('/app/android.json', { cache: 'no-cache', signal: request.signal }).then(async (response) => {
      if (!response.ok || !response.headers.get('content-type')?.includes('json')) return fallback
      const info = await response.json()
      if (!info || !/^\/app\/[a-z0-9-]+\.apk$/.test(info.url) || !['preview', 'release'].includes(info.kind) || !/^[a-f0-9]{64}$/.test(info.sha256) || !Number.isSafeInteger(info.bytes) || info.bytes < 100_000) return fallback
      const head = await fetch(info.url, { method: 'HEAD', signal: request.signal, cache: 'no-cache' })
      const length = head.headers.get('content-length')
      return head.ok && !head.headers.get('content-type')?.includes('text/html') && (!length || Number(length) === info.bytes) ? info : fallback
    }).then((info) => { if (!request.signal.aborted) setArtifact(info) }).catch(() => { if (!request.signal.aborted) setArtifact(fallback) }).finally(() => clearTimeout(timer))
    return () => { clearTimeout(timer); request.abort() }
  }, [])
  const preview = artifact?.kind === 'preview'
  const separateApp = artifact?.packageId === 'africa.auratrade.terminal.accountpreview'
  return <Modal title="Get AuraTrade for Android" description="A full research terminal that travels with you." className="apk-modal" close={close}>
    <div className="apk-hero"><span className="apk-hero-icon"><Smartphone size={26}/></span><span><strong>AuraTrade East Africa</strong><small>{artifact?.version ? `Version ${artifact.version} · ` : ''}{preview ? 'Signed preview build' : artifact?.kind === 'release' ? 'Android release' : 'Android package'}{artifact?.bytes ? ` · ${num(artifact.bytes / 1024 ** 2, 1)} MB` : ''}</small></span></div>
    <div className="apk-features"><span><WifiOff size={15}/> Offline market archive</span><span><HardDriveDownload size={15}/> Local research &amp; paper ledger</span><span><ShieldCheck size={15}/> No real payments</span><span><Smartphone size={15}/> Mobile terminal layout</span></div>
    {native && !apkUrl ? <p className="helper-text">You’re already using the Android app. Open your desk’s web deployment on your phone to download a newer build.</p> : artifact?.url ? <><a className="button primary full" href={artifact.url} download={artifact.url.startsWith('/') ? artifact.url.split('/').at(-1) : undefined} target={artifact.url.startsWith('/') ? undefined : '_blank'} rel="noreferrer"><ArrowDownToLine size={17}/> Download Android APK</a><p className="helper-text">{preview ? 'This is a sideloadable preview, not a Play Store or production-signed release. ' : ''}Download on Android and open the file. Android may ask you to allow installs from your browser.</p>{separateApp && <p className="helper-text"><strong>Keep your old app installed.</strong> This installs as AuraTrade Account Preview alongside 1.1. Existing local data stays in the old app and isn’t transferred.</p>}{artifact.sha256 && <code className="apk-checksum">SHA-256 {artifact.sha256}</code>}</> : artifact ? <><p className="helper-text">No APK has been published for this deployment. Follow the project’s Android build instructions to publish the signed release.</p><a className="button secondary full" href="https://github.com/kennedy-blip/Aura-Trade" target="_blank" rel="noreferrer">Open project <ExternalLink size={15}/></a></> : <p role="status" className="helper-text">Checking the Android artifact…</p>}
  </Modal>
}
