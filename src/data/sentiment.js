import { sources } from './markets.js'
export const sentimentArchive = [
  { id: 'example-retail-1', channel: 'retail', kind: 'example', date: '2026-11-12', publisher: 'Illustrative Sheng / Swahili', text: 'Bei zimepanda na soko iko chini, lakini kuna matumaini.' },
  { id: 'example-retail-2', channel: 'retail', kind: 'example', date: '2026-11-12', publisher: 'Illustrative Sheng / Swahili', text: 'Shilingi iko sawa, lakini gharama bado ni ghali.' },
  { id: 'cbk-bulletin-1', channel: 'wire', kind: 'archive', date: sources.bulletin.date, publisher: sources.bulletin.name, url: sources.bulletin.url, text: 'Equity indices were mixed. The NSE 20 rose over the week; the NASI declined slightly. The shilling was steady against the US dollar.' },
  { id: 'cbk-bulletin-2', channel: 'wire', kind: 'archive', date: sources.bulletin.date, publisher: sources.bulletin.name, url: sources.bulletin.url, text: 'Murban crude prices declined from November 5 to November 12, and the US Dollar Index strengthened.' },
]
