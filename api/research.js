import { analyzeResearch, agents } from '../src/lib/research.js'
import { agentDefaults, validateSettings } from '../src/lib/models.js'
import { groqCompletion, groqReport, GroqError, GROQ_MODEL, synthesisMessages, validGroqKey } from '../src/lib/groq.js'
import { mentionedInstrument, pulseResearch } from '../src/lib/pulseResearch.js'
import { quoteState } from '../src/data/pulse.js'
import { deskRequest, identity } from '../server/auth.js'
import { HttpError, readJson, route } from '../server/http.js'
import { marketFeeds } from '../server/feeds.js'
import { history, pulse } from '../server/pulse.js'

export default route(['GET', 'POST'], async (req) => {
  const key = process.env.GROQ_API_KEY?.trim()
  const authConfigured = Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_PUBLISHABLE_KEY)
  if (req.method === 'GET') return { groqConfigured: validGroqKey(key) && authConfigured, authConfigured }
  const auth = await identity(req)
  if (!auth.canUseGroq) throw new HttpError(403, 'This account is not enabled for hosted Groq. Use a device key or ask your AuraTrade administrator for access.')
  if (!validGroqKey(key)) throw new HttpError(503, 'Hosted Groq is not configured. Add GROQ_API_KEY in Vercel and redeploy, or use your own device key.')
  const body = await readJson(req, 12_000)
  const question = typeof body?.question === 'string' ? body.question.trim() : ''
  const test = body?.test === true
  if (!test && (!question || question.length > 1800 || (body.agent !== 'auto' && !Object.hasOwn(agents, body.agent)))) throw new HttpError(400, 'Enter a question of up to 1,800 characters and select a valid agent.')
  const permit = await deskRequest(auth, 'rpc/aura_consume_research_quota', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })
  if ((await permit.json()) !== true) throw new HttpError(429, 'Hosted research quota reached (20 calls per UTC hour). Local research is still available.')
  const model = process.env.GROQ_MODEL?.trim() || GROQ_MODEL
  try {
    if (test) {
      await groqCompletion(key, [], { model, test })
      return { connected: true }
    }
    const instrument = body.agent === 'auto' || body.agent === 'quant' ? mentionedInstrument(question) : null
    const [market, report, dataset, configured] = await Promise.all([
      marketFeeds(), instrument ? pulse() : null, instrument ? history(instrument) : null,
      auth.role === 'admin' && body.useDeskSettings === true ? deskRequest(auth, `aura_desk_settings?select=config&owner=eq.${encodeURIComponent(auth.user.id)}`).then(async (value) => (await value.json())[0]?.config) : null,
    ])
    let settings = agentDefaults
    try { if (configured) settings = validateSettings(configured).agent } catch { /* use safe defaults */ }
    const quote = report?.quotes.find((item) => item.id === instrument)
    const lead = (instrument && pulseResearch(instrument, quote, quote?.health === 'ok' ? quoteState(quote) : 'Cached', dataset)) || analyzeResearch(question, body.agent, market.rows, market.sentiment)
    const secondary = analyzeResearch(question, lead.agent === 'macro' ? 'quant' : 'macro', market.rows, market.sentiment)
    const text = await groqCompletion(key, synthesisMessages(question, lead, secondary, settings), { model })
    return groqReport(text, lead, secondary, 'Groq · Vercel')
  } catch (error) {
    if (error instanceof GroqError) throw new HttpError(error.status, error.message)
    throw error
  }
})
