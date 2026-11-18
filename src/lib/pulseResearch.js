import { instruments } from '../data/pulse.js'
import { marketReview } from './marketSignals.js'
import { dateLabel, num } from './format.js'

const aliases = [
  ['btc-usd', /\b(?:btc|bitcoin)\b/i], ['eth-usd', /\b(?:eth|ether|ethereum)\b/i],
  ['nasi', /\b(?:nasi|all share index)\b/i], ['nse20', /\bnse[ -]?20\b/i], ['nse25', /\bnse[ -]?25\b/i],
  ['usd-kes', /\busd[ /-]?kes\b/i], ['scom', /\b(?:scom|safaricom)\b/i], ['eqty', /\b(?:eqty|equity group)\b/i],
  ['kcb', /\bkcb\b/i], ['eabl', /\beabl\b/i], ['sp500', /\b(?:sp500|s&p 500)\b/i],
  ['dgs10', /\b(?:us 10y|treasury 10-year|dgs10)\b/i], ['dcoilbrenteu', /\bbrent\b/i],
]
export const mentionedInstrument = (question) => aliases.find(([, term]) => term.test(question))?.[0]
export const observationTime = (time) => dateLabel(time, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', second: '2-digit' }) + ' EAT'
export function pulseResearch(id, quote, status, data) {
  const { code, unit } = instruments[id]
  const review = data?.points?.length ? marketReview(data.points) : null
  if (!quote && !data && !instruments[id].coin) return null
  const paragraphs = [quote ? `${code} was ${num(quote.price)} ${unit} at ${observationTime(quote.at)} from ${quote.source} (${status.toLowerCase()}). It is an observation, not an execution price.` : `There is no current verified quote for ${code}. Use the dated source evidence below when it is available.`]
  const citations = quote ? [{ id: `${id}-quote`, name: quote.source, date: quote.at, url: quote.url }] : []
  if (review) {
    const { asOf, label, upper, lower, fast, slow, width } = review
    paragraphs.push(`${data.cadence} through ${dateLabel(asOf)} showed ${label.toLowerCase()}: the 5-observation average was ${num(fast)} and the 10-observation average ${num(slow)}. The prior 10-observation range was ${num(lower)}–${num(upper)} ${unit}. Recent one-observation return volatility was ${num(width)}%. Staying outside that range could support continuation; a return inside would weaken the breakout reading. This is descriptive, not a forecast.`)
    citations.push({ id: `${id}-history`, name: data.name, date: asOf, url: data.url })
  } else paragraphs.push('A trend or breakout assessment needs at least 11 genuine observations from one source. No pattern is inferred from an isolated reading.')
  return { title: `${code} · market evidence`, agent: 'quant', paragraphs, citations, mode: 'Local analysis', at: new Date().toISOString() }
}
