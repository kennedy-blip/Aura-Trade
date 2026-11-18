import { useCallback, useEffect, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { AnimatePresence, motion } from 'framer-motion'
import { ArrowRight, ChevronDown, Download, Send, Sparkles, Trash2 } from 'lucide-react'
import { useDesk } from '../context/workspace.js'
import { db } from '../db/index.js'
import { historicalStudies } from '../data/markets.js'
import { agents, analyzeResearch, researchExamples } from '../lib/research.js'
import { api } from '../lib/client.js'
import { dateLabel, download } from '../lib/format.js'
import { CheckBox, EmptyState, GlyphBox, Modal, PanelTitle, SectionHeading, SourceLink, Tabs } from './common.jsx'

const order = Object.entries(agents)
function Studies() {
  const studies = useLiveQuery(() => db.studies.toArray(), [], historicalStudies)
  const [kind, setKind] = useState('All')
  const [opened, setOpened] = useState(null)
  return <section className="glass module-card"><PanelTitle title="Historical case studies" subtitle="Compare documented observations without assuming causality" icon="history" color="cyan"><Tabs options={['All', 'Policy', 'Energy', 'Equities']} value={kind} onChange={setKind} label="Study topic"/></PanelTitle><div className="accordion">{(studies.length ? studies : historicalStudies).filter((row) => kind === 'All' || row.category === kind).map((row) => <article className="accordion-item" key={row.id}><button type="button" className="accordion-trigger" aria-expanded={opened === row.id} aria-controls={`study-${row.id}`} onClick={() => setOpened(opened === row.id ? null : row.id)}><GlyphBox name={row.category === 'Policy' ? 'bank' : row.category === 'Energy' ? 'fuel' : 'chart'} color="cyan"/><span><strong>{row.title}</strong><small>{row.category} · {dateLabel(row.date)}</small></span><ChevronDown size={17} className={opened === row.id ? 'rotated' : ''}/></button><AnimatePresence initial={false}>{opened === row.id && <motion.div id={`study-${row.id}`} className="accordion-body" initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}><div><div className="study-compare"><span><small>BASELINE</small><b>{row.baseline}</b></span><ArrowRight size={18}/><span><small>OBSERVATION</small><b>{row.observed}</b></span></div><p>{row.detail}</p><SourceLink id={row.source} date={row.date}/></div></motion.div>}</AnimatePresence></article>)}</div></section>
}
function Response({ report }) {
  const agent = agents[report.agent] || agents.macro
  return <div className="research-answer"><div className="answer-meta"><GlyphBox name={agent.icon} color={agent.color}/><span><strong>{agent.short}</strong><small>{report.mode} · {dateLabel(report.at, { hour: '2-digit', minute: '2-digit' })} EAT</small></span><button className="icon-button bordered" type="button" aria-label="Download research response" onClick={() => download(`aura-research-${report.at.slice(0, 10)}.txt`, `${report.title}\n${report.mode} · ${report.at}\n\n${report.paragraphs.join('\n\n')}\n\n${report.citations.map((ref) => `${ref.name} (${ref.date || 'publisher archive'}): ${ref.url}`).join('\n')}`, 'text/plain;charset=utf-8')}><Download size={14}/></button></div><h3>{report.title}</h3>{report.paragraphs.map((line, i) => <p key={i}>{line}</p>)}{report.citations.length > 0 && <div className="citation-list"><span className="eyebrow">SOURCE EVIDENCE</span>{report.citations.map((item) => <SourceLink key={item.id} id={item.id} url={item.url} label={item.name} date={item.date}/>)}</div>}</div>
}
export default function ResearchTerminal({ focus }) {
  const { rows, sentiment, scope, session, online, role, authEnabled, toast } = useDesk()
  const [tab, setTab] = useState('Analyst chat')
  const [agent, setAgent] = useState('auto')
  const [text, setText] = useState('')
  const [pending, setPending] = useState(false)
  const [remote, setRemote] = useState(false)
  const [confirm, setConfirm] = useState(false)
  const messages = useLiveQuery(() => db.messages.where('scope').equals(scope).reverse().sortBy('at').then((items) => items.slice(-100)), [scope], [])
  const feed = useRef(null), input = useRef(null), lastFocus = useRef(null), lock = useRef(false)
  const ask = useCallback(async (value, useAgent) => {
    const question = value.trim()
    if (lock.current || !question || question.length > 1800) return
    lock.current = true; setPending(true); setText('')
    const local = analyzeResearch(question, useAgent, rows, sentiment)
    let answer = local
    try {
      if (remote && session?.access_token && online && local.agent !== 'sentiment') {
        try {
          const result = await api('research', { method: 'POST', token: session.access_token, body: { question, agent: useAgent, useDeskSettings: role === 'admin' }, timeout: 29000 })
          if (Array.isArray(result.paragraphs) && Array.isArray(result.citations)) answer = result
        } catch { toast('Hosted research was unavailable. The local desk completed the analysis.', 'info') }
      }
      await db.messages.add({ id: crypto.randomUUID(), scope, question, answer, at: new Date().toISOString() })
    } catch { toast('The response could not be saved. Check your device storage and retry.', 'info'); setText(value) }
    finally { lock.current = false; setPending(false) }
  }, [online, remote, role, rows, sentiment, scope, session?.access_token, toast])
  useEffect(() => {
    if (!focus?.question || lastFocus.current === focus) return
    lastFocus.current = focus; setTab('Analyst chat'); setAgent(focus.agent || 'auto'); ask(focus.question, focus.agent || 'auto')
  }, [focus, ask])
  useEffect(() => { if (feed.current) feed.current.scrollTo({ top: feed.current.scrollHeight, behavior: 'auto' }) }, [messages?.length, pending, tab])
  const ready = tab === 'Analyst chat'
  return <div className="module-page"><SectionHeading title="Aura Research" description="Ask, compare and verify. Four specialist agents, grounded in dated evidence." eyebrow="MULTI-AGENT INTELLIGENCE" icon="sparkle"><span className="ai-badge"><i/> {remote && online && session ? 'HOSTED ASSIST' : 'LOCAL RESEARCH'}</span></SectionHeading><div className="page-tabs"><Tabs options={['Analyst chat', 'Event studies']} value={tab} onChange={setTab} label="Research mode"/>{ready && !!messages.length && <button type="button" className="button secondary" onClick={() => setConfirm(true)} disabled={pending}><Trash2 size={14}/> Clear history</button>}</div>
    <motion.div className="module-tab" key={tab} initial={{ opacity: .6, y: 6 }} animate={{ opacity: 1, y: 0 }}>{ready ? <div className="research-layout"><section className="glass chat-panel"><PanelTitle icon="sparkle" color="violet" title={agent === 'auto' ? 'Aura desk' : agents[agent].name} subtitle={agent === 'auto' ? 'Auto-routes questions to the relevant specialist' : agents[agent].description}/><div className="chat-scroll" ref={feed} aria-live="polite" aria-label="Research conversation">
      {!messages.length && !pending && <div className="chat-intro"><GlyphBox name="sparkle" color="violet"/><h2>What are you researching?</h2><p>Start with a question about Kenyan markets, or try one of these queries.</p><div className="research-examples">{researchExamples.map((example) => <button type="button" key={example.agent} onClick={() => { setAgent(example.agent); ask(example.text, example.agent) }}><GlyphBox name={agents[example.agent].icon} color={agents[example.agent].color}/><span>{example.text}</span><ArrowRight size={14}/></button>)}</div></div>}
      {messages.map((item) => <article className="chat-exchange" key={item.id}><div className="user-message">{item.question}</div><Response report={item.answer}/></article>)}{pending && <div className="research-pending"><span/><span/><span/> Reviewing available evidence…</div>}
    </div><form className="chat-form" onSubmit={(e) => { e.preventDefault(); ask(text, agent) }}><div className="chat-composer"><label htmlFor="research-question" className="sr-only">Research question</label><textarea ref={input} id="research-question" rows={2} placeholder="Ask a research question…" value={text} maxLength={1800} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); ask(text, agent) } }}/><button type="submit" className="button violet-button" disabled={!text.trim() || pending}><Send size={16}/><span>Send</span></button></div><small>Enter to send · Shift + Enter for a new line · Not investment advice</small></form></section>
    <aside className="research-side"><section className="glass module-card"><PanelTitle icon="globe" color="cyan" title="Research agents" subtitle="Choose a specialty or auto-route"/><div className="agent-list"><button type="button" className={agent === 'auto' ? 'selected' : ''} aria-pressed={agent === 'auto'} onClick={() => { setAgent('auto'); input.current?.focus() }}><GlyphBox name="sparkle" color="violet"/><span><strong>Auto-route</strong><small>Match the question to a specialist</small></span><i/></button>{order.map(([id, item]) => <button key={id} type="button" className={agent === id ? 'selected' : ''} aria-pressed={agent === id} onClick={() => { setAgent(id); input.current?.focus() }}><GlyphBox name={item.icon} color={item.color}/><span><strong>{item.name}</strong><small>{item.description}</small></span><i/></button>)}</div></section>
    <section className="glass module-card privacy-card"><PanelTitle icon="shield" title="Evidence &amp; privacy" color="amber"/><p>Each local reply uses bundled or cached evidence. Sentiment is scored from submitted text or curated excerpts, not a broad market index.</p><button type="button" className="text-link compare-sentiment" onClick={() => { setAgent('sentiment'); ask('Compare retail Sheng, Swahili and institutional sentiment', 'sentiment') }} disabled={pending}>Compare sentiment channels <ArrowRight size={13}/></button>{authEnabled && session ? <CheckBox checked={remote} onChange={setRemote}>Use hosted synthesis when available. Questions may be sent to the configured model provider.</CheckBox> : <p className="muted">{authEnabled ? 'Sign in through Settings to enable hosted synthesis.' : 'Hosted synthesis is not configured for this workspace.'}</p>}</section></aside></div> : <Studies/>}</motion.div>
    {confirm && <Modal title="Clear research history?" description="This removes cached questions and answers from this workspace on this device." close={() => setConfirm(false)}><div className="modal-actions"><button type="button" className="button secondary" onClick={() => setConfirm(false)}>Keep history</button><button type="button" className="button danger" onClick={async () => { try { await db.messages.where('scope').equals(scope).delete(); setConfirm(false); toast('Research history cleared.') } catch { toast('History could not be cleared.', 'info') } }}>Clear history</button></div></Modal>}
  </div>
}
