import { historicalStudies, series, snapshot, sources } from '../data/markets.js'
import { sentimentArchive } from '../data/sentiment.js'
import { dateLabel, displayValue, num, changeLabel } from './format.js'

export const agents = {
  macro: { name: 'Macro & Shock', short: 'Macro Agent', icon: 'globe', color: 'mint', description: 'CBK policy, exchange rates and cross-market transmission.' },
  events: { name: 'Historical Event Study', short: 'Event Agent', icon: 'history', color: 'cyan', description: 'Documented releases, event windows and historical context.' },
  quant: { name: 'Technical & Quant', short: 'Quant Agent', icon: 'chart', color: 'violet', description: 'Price structure, risk metrics and benchmark comparisons.' },
  sentiment: { name: 'Local Sentiment', short: 'Sentiment Agent', icon: 'message', color: 'amber', description: 'Sheng, Swahili and English language classification.' },
}
export const researchExamples = [
  { agent: 'macro', text: 'How do oil and EPRA fuel caps affect the shilling?' },
  { agent: 'events', text: 'Compare the October 2026 rate hold to the June 2025 cut.' },
  { agent: 'quant', text: 'What is the NSE 20 trend and volatility?' },
  { agent: 'sentiment', text: 'Score this sample: “bei zimepanda, soko iko chini; lakini kuna matumaini.”' },
]
export function pickAgent(text) {
  if (/sentiment|sheng|swahili|chatter|soko iko|classif|\bscore\b|\bhype\b/i.test(text)) return 'sentiment'
  if (/event stud|compare the|histor|2025|2024|what happened/i.test(text)) return 'events'
  if (/t[ -]?bill|bond|mmf|funds|return|volatil|momentum|technical|chart|nse 20 trend/i.test(text)) return 'quant'
  return 'macro'
}
export function statistics(values) {
  if (values.length < 2) return null
  const r = values.slice(1).map((n, i) => n / values[i] - 1)
  const avg = r.reduce((a, b) => a + b, 0) / r.length
  const vol = Math.sqrt(r.reduce((a, b) => a + (b - avg) ** 2, 0) / Math.max(1, r.length - 1)) * Math.sqrt(252) * 100
  let peak = values[0], dd = 0
  for (const n of values) { peak = Math.max(peak, n); dd = Math.min(dd, (n / peak - 1) * 100) }
  return { return: (values.at(-1) / values[0] - 1) * 100, vol, dd }
}
const words = {
  positive: ['soko iko juu','inaenda juu','bei imeshuka','tuko sawa','iko sawa','matumaini','faida','moto','poa','green','rally','bullish','upside','buying','improved','improves','rises','rose','higher','gain','gains','strong'],
  negative: ['soko iko chini','bei zimepanda','bei imepanda','kupanda kwa bei','ghali','hasara','imechapa','imechoma','noma','bearish','downside','slump','selloff','weak','falls','fell','declined','lower','loss','losses','risk'],
}
export function scoreSentiment(text) {
  const clean = text.toLowerCase().normalize('NFKC')
  const found = Object.fromEntries(Object.entries(words).map(([key, entries]) => [key, entries.filter((term) => new RegExp(`\\b${term}\\b`, 'u').test(clean))]))
  const n = found.positive.length - found.negative.length
  return { ...found, label: n > 0 ? 'Constructive' : n < 0 ? 'Cautious' : found.positive.length ? 'Mixed' : 'No clear signal' }
}
function cited(ids) {
  return [...new Set(ids)].filter((id) => sources[id]).map((id) => ({ id, ...sources[id] }))
}
export function analyzeResearch(question, selected = 'auto', indicators = snapshot, corpus = sentimentArchive) {
  const agent = Object.hasOwn(agents, selected) ? selected : pickAgent(question)
  const text = question.toLowerCase()
  const metric = (id) => indicators.find((item) => item.id === id) ?? snapshot.find((item) => item.id === id)
  const observation = (id) => `${displayValue(metric(id))} (${dateLabel(metric(id).asOf)})`
  const observationRefs = (...ids) => [...new Map(ids.map((id) => {
    const row = metric(id), publisher = sources[row.source]
    const item = row.origin === 'feed' ? { ...publisher, id: `${row.source}-${row.id}`, url: row.url, date: row.asOf } : { ...publisher, id: row.source }
    return [item.id, item]
  })).values()]
  const withRefs = (ids, ...extra) => [...new Map([...observationRefs(...ids), ...cited(extra)].map((item) => [item.id, item])).values()]
  let title, paragraphs, citations
  if (agent === 'events') {
    const rows = text.includes('oil') || text.includes('fuel') || text.includes('crude') ? [historicalStudies[1]] : text.includes('nse') || text.includes('equity') ? [historicalStudies[3]] : [historicalStudies[0], historicalStudies[2]]
    title = rows.length === 1 ? rows[0].title : 'Two CBK decisions, two different backdrops'
    paragraphs = rows.map((row) => `${row.title}: ${row.baseline} → ${row.observed}. ${row.detail}`)
    paragraphs.push('Method: Compare the observations around the dated release. These are descriptive changes, not isolated event-driven effects.')
    citations = cited(rows.map((row) => row.source))
  } else if (agent === 'quant' && /bill|mmf|fund|benchmark/.test(text)) {
    title = 'Compare like-for-like yields'
    paragraphs = [
      `The 91-day auction reference is ${observation('tbill')} annualized. A 91-day T-bill is a discounted sovereign instrument, so compare its cash return over the holding period—not its annualized quote—to a fund’s return.`,
      'Money market fund yields vary, may be before fees or tax, and are not guaranteed. Compare current fact sheets for fees, tax treatment, liquidity and annualization conventions. The paper simulator offers editable-horizon scenarios using illustrative fund yields.',
    ]
    citations = withRefs(['tbill'], 'mmf')
  } else if (agent === 'quant') {
    const key = /\bnasi\b|all share/.test(text) ? 'nasi' : /nse\s?25/.test(text) ? 'nse25' : /usd|kes|shilling/.test(text) ? 'usd-kes' : 'nse20'
    const s = series[key], values = s.columns.map((r) => r[s.index]), stats = statistics(values)
    title = `${s.code} · historical trend and risk`
    paragraphs = [
      `The recorded series ends at ${num(values.at(-1), s.digits)} on ${dateLabel(s.columns.at(-1)[0])}. Over ${values.length} observations, it returned ${changeLabel(stats.return)} with a maximum observed drawdown of ${changeLabel(stats.dd)}.`,
      `Annualized close-to-close volatility: ${num(stats.vol)}%. This illustrative annualization uses √252 on a short historical window. It is not a forecast, does not include dividends or spreads, and may not capture intraday risk.`,
    ]
    citations = cited(key === 'usd-kes' ? ['bulletin'] : ['octBulletin', 'novBulletin', 'bulletin'])
  } else if (agent === 'sentiment') {
    const quote = question.match(/[“"]([^”"]+)[”"]/)?.[1] || question.split(':').slice(1).join(':').trim()
    const result = quote ? scoreSentiment(quote) : null
    if (!result && /compar|retail|wire|institution/.test(text)) {
      const choice = ['retail', 'wire'].map((channel) => {
        const matches = corpus.filter((item) => item.channel === channel)
        const licensed = matches.filter((item) => item.kind === 'feed')
        return (licensed.length ? licensed : matches).slice(0, 5)
      })
      title = 'Retail vs. institutional language'
      paragraphs = choice.map((bucket, index) => {
        const heading = index === 0 ? 'Retail Sheng / Swahili' : 'Institutional coverage'
        if (!bucket.length) return `${heading}: no cached excerpts.`
        const data = bucket.map((item) => scoreSentiment(item.text))
        const n = data.filter((item) => item.label === 'Constructive').length
        const k = data.filter((item) => item.label === 'Cautious').length
        return `${heading}: ${n} constructive, ${k} cautious, ${data.length - n - k} mixed or unclear across ${data.length} excerpts (${bucket[0].kind === 'example' ? 'illustrative retail examples' : bucket[0].kind === 'archive' ? 'archived primary bulletin summaries' : 'configured publisher feed'}). Most recent excerpt: ${dateLabel(bucket[0].date)}.`
      })
      paragraphs.push('These are small language samples, not measured market positioning. Differences in language, source and publication timing limit comparison.')
      citations = [...new Map(choice.flat().filter((item) => item.url).map((item) => [item.url, { id: item.id, name: item.publisher, url: item.url, date: item.date }])).values()]
    } else {
      title = result ? `${result.label} · language sample` : 'Score a retail or institutional excerpt'
      paragraphs = result ? [
        `Constructive phrases: ${result.positive.join(', ') || 'none'}. Cautious phrases: ${result.negative.join(', ') || 'none'}.`,
        'This is a lexicon score of the submitted excerpt, not a live sentiment index or an independently verified claim. Negation, slang and sarcasm can change its meaning. Compare with primary releases before drawing conclusions.',
      ] : ['Paste a short excerpt after a colon or inside quotation marks. The offline classifier recognizes common Sheng, Swahili and English market phrases.', 'No social posts or institutional wires were retrieved. Use text you have permission to share and omit names and account details.']
      citations = []
    }
  } else if (/fuel|oil|epra|industrial|petrol|diesel|crude/.test(text)) {
    title = 'From fuel caps to margins and FX'
    paragraphs = [`CBK reported Murban crude at ${observation('oil')} and USD/KES at ${observation('usd-kes')}. EPRA sets maximum retail prices by town; the pricing window, taxes and the exchange rate mean the pump-price move can differ from the crude-price move.`,
      'Higher diesel costs can lift freight, transport CPI and import demand for dollars. For NSE industrials, the effect depends on diesel exposure and how much cost the firm can pass to customers. The Macro Engine lets you vary the fuel, rate and dollar shocks independently.']
    citations = withRefs(['oil', 'usd-kes', 'diesel'], 'fuel', 'cpi')
  } else if (/tea|eatta|export|gdp|growth/.test(text)) {
    title = 'Real activity and export flows'
    paragraphs = [`The Mombasa auction recorded ${observation('tea')} sold${metric('tea').origin === 'snapshot' ? ' in Sale 17' : ''}. The available KNBS real GDP growth reading is ${observation('gdp')}; check its reference quarter and publication lag.`, 'Tea receipts can supply dollars to the local market. To measure the effect on KES, pair auction volumes with USD prices, settlement timing and other flows such as oil imports and remittances.']
    citations = observationRefs('tea', 'gdp')
  } else if (/inflation|cpi|\bcbk\b|rate cut|policy/.test(text)) {
    title = 'Monetary policy meets rising headline CPI'
    paragraphs = [`The CBR was ${observation('cbr')} at the recorded MPC decision, and headline CPI was ${observation('cpi')}. These observations have different release dates.`, 'A higher policy rate can support shilling carry and push up local funding and discount rates. Watch KESONIA and auction yields for transmission; energy and food shocks may still drive headline inflation.']
    citations = withRefs(['cbr','cpi'], 'bulletin')
  } else {
    title = 'What’s moving the shilling?'
    paragraphs = [`The available CBK reference for USD/KES is ${observation('usd-kes')}, with FX reserves at ${observation('reserves')}. These are dated observations, not live prices. In the 13 November 2026 bulletin, the rate was unchanged week on week.`,
      'Watch three channels: dollar demand from energy imports, supply from exports and remittances, and the CBK–US rate differential. Domestic carry and reserves can cushion volatility, but cannot determine the next move.']
    citations = withRefs(['usd-kes','reserves','cbr'], 'fred')
  }
  return { agent, title, paragraphs, citations, mode: 'Local analysis', at: new Date().toISOString() }
}
