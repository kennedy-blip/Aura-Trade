import { useMemo, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { motion, useReducedMotion } from 'framer-motion'
import { ArrowDownLeft, ArrowDownToLine, ArrowRight, ArrowUpRight, Clock3, RotateCcw, Smartphone, Wallet } from 'lucide-react'
import { useDesk } from '../context/workspace.js'
import { assets, fundScenarios } from '../data/markets.js'
import { db, advanceReplay, executeTrade, resetWallet, settlePush, startPush } from '../db/index.js'
import { fillQuote, freshWallet, FEE_BPS, portfolioReturn, replayBook, replayPrice, walletValue } from '../lib/ledger.js'
import { compoundedBenchmark, simpleBenchmark } from '../lib/models.js'
import { changeLabel, csv, dateLabel, download, money, num, tone } from '../lib/format.js'
import { Delta, EmptyState, GlyphBox, Modal, PanelTitle, SectionHeading, Select, SourceLink, spring, Tabs } from './common.jsx'
import { Sparkline } from './MarketChart.jsx'

const instruments = assets.map(({ symbol, name }) => ({ value: symbol, label: `${symbol} · ${name}` }))
function Stat({ label, icon, color, value, detail, children }) {
  return <div className="glass sim-stat"><GlyphBox name={icon} color={color}/><span>{label}</span><strong>{value}</strong><small>{detail}</small>{children}</div>
}
function ReplayPrice({ value, previous, currency = false }) {
  const reduced = useReducedMotion()
  return <span className="mono quote-flash">{!reduced && previous !== value && <motion.i key={value} aria-hidden="true" className={value >= previous ? 'flash-rise' : 'flash-fall'} initial={{ opacity: .85 }} animate={{ opacity: 0 }} transition={spring}/>}<span>{currency ? money(value / 100) : num(value / 100)}</span></span>
}
function OrderBook({ asset, day }) {
  const book = replayBook(asset, day), prior = day > 0 ? replayBook(asset, day - 1) : book
  const largest = Math.max(...book.flatMap((level) => [level.bidSize, level.askSize]))
  return <section className="glass module-card"><PanelTitle title="Replay order book" icon="activity" color="cyan" subtitle={`${asset.symbol} · simulated size in shares`}><span className="subtle-badge">Day {day}</span></PanelTitle>
    <table className="data-table depth-table" aria-label={`${asset.symbol} simulated order book`}><thead><tr><th>Bid size</th><th>Bid (KES)</th><th>Ask (KES)</th><th>Ask size</th></tr></thead><tbody>{book.map((level, i) => <tr key={i}><td className="depth-size depth-bid mono" style={{ '--depth': `${level.bidSize / largest * 100}%` }}>{num(level.bidSize, 0)}</td><td className="positive"><ReplayPrice value={level.bid} previous={prior[i].bid}/></td><td className="negative"><ReplayPrice value={level.ask} previous={prior[i].ask}/></td><td className="depth-size depth-ask mono" style={{ '--depth': `${level.askSize / largest * 100}%` }}>{num(level.askSize, 0)}</td></tr>)}</tbody></table>
    <p className="helper-text">Illustrative depth only. Paper orders use top-of-book pricing plus fees, not queue matching.</p>
  </section>
}
function BenchmarkPanel({ wallet }) {
  const { rows } = useDesk()
  const bill = rows.find((r) => r.id === 'tbill')
  const funds = fundScenarios.map((fund, index) => {
    const recorded = rows.find((r) => r.id === ['mmf-cic','mmf-ncba','mmf-sanlam'][index])
    return { ...fund, rate: recorded?.value ?? fund.rate, recorded }
  })
  const [fundIndex, setFundIndex] = useState('1')
  const [horizon, setHorizon] = useState('Replay')
  const actual = portfolioReturn(wallet), days = horizon === 'Replay' ? wallet.day : Number.parseInt(horizon, 10)
  const fund = funds[Number(fundIndex)]
  const benchmarks = [{ title: '91-day Treasury bill', yield: bill.value, value: simpleBenchmark(bill.value, days), source: bill }, { title: fund.name, yield: fund.rate, value: compoundedBenchmark(fund.rate, days), source: fund.recorded }]
  return <section className="glass module-card"><PanelTitle title="Benchmark comparison" icon="bank" subtitle="Compare equivalent holding periods"/><div className="benchmark-controls"><Tabs options={['Replay','30 days','91 days','365 days']} value={horizon} onChange={setHorizon} label="Benchmark horizon"/><Select label="Money market fund" options={funds.map((row, i) => ({ value: String(i), label: row.name }))} value={fundIndex} onChange={setFundIndex}/></div>
    {horizon === 'Replay' && <div className="benchmark-row"><span>Paper strategy<small>Modified Dietz · day {wallet.day}</small></span><strong className={tone(actual)}>{changeLabel(actual)}</strong></div>}
    {benchmarks.map((row) => <div className="benchmark-row" key={row.title}><span>{row.title}<small>{num(row.yield, 3)}% annualized · {row.source ? dateLabel(row.source.asOf) : 'Illustrative rate'}</small></span><strong>{changeLabel(row.value)}</strong></div>)}
    {horizon === 'Replay' && days > 0 && <div className="benchmark-row"><span>Excess vs. T-bill<small>Paper return less {days}-day bill equivalent</small></span><strong>{changeLabel(actual - benchmarks[0].value, 'pp', 2)}</strong></div>}
    <p className="helper-text">T-bills use simple pro-rating as a comparison proxy; periods beyond 91 days assume reinvestment at the same rate. Funds use effective annual compounding. Before tax and fund fees; neither a guarantee nor a live executable quote.</p><div className="chip-links"><SourceLink id={bill.source} url={bill.url} label="CBK auction"/><SourceLink id={fund.recorded?.source || 'mmf'} url={fund.recorded?.url} label={fund.recorded ? 'Fund disclosure' : 'CMA fund register'}/></div></section>
}
function FundingModal({ walletScope, pending, close }) {
  const { toast } = useDesk()
  const [phone, setPhone] = useState('0700 000 000')
  const [amount, setAmount] = useState('5000')
  const [item, setItem] = useState(pending || null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const lock = useRef(false)
  async function run(action) {
    if (lock.current) return
    lock.current = true; setBusy(true); setError('')
    try {
      const result = action ? await settlePush(walletScope, item.id, action) : await startPush(walletScope, phone, Number(amount))
      setItem(result)
      if (result.status === 'completed') toast(`${money(result.amount / 100)} added to paper cash.`)
    } catch (err) { setError(err.message) }
    finally { lock.current = false; setBusy(false) }
  }
  return <Modal title="M-Pesa sandbox funding" description="A local Daraja STK Push simulation. No SMS, PIN or money is sent." close={close}>
    {!item ? <form className="stack-form" onSubmit={(e) => { e.preventDefault(); run() }}><div className="sandbox-note"><Smartphone size={18}/><p>Use a test number. Only the last four digits are stored on this device.</p></div><label>Kenyan test phone<input type="tel" autoComplete="off" value={phone} onChange={(e) => setPhone(e.target.value)} required maxLength={18}/></label><label>Funding amount (KES)<input type="number" step="1" min="1" max="250000" value={amount} onChange={(e) => setAmount(e.target.value)} required/></label>{error && <p className="form-error" role="alert">{error}</p>}<button className="button primary full" type="submit" disabled={busy}><Smartphone size={16}/> Simulate STK push</button></form>
      : <div className="stack-form"><div className="fund-receipt"><GlyphBox name="wallet" color={item.status === 'completed' ? 'mint' : 'amber'}/><div><b>{money(item.amount / 100)}</b><small>{item.reference} · {item.phone}</small></div><span className={`subtle-badge ${item.status === 'completed' ? 'positive' : ''}`}>{item.status}</span></div>{item.status === 'pending' ? <><p className="helper-text">Choose the callback this checkout should receive. Approving credits paper cash once. A pending request expires after two minutes.</p>{error && <p className="form-error" role="alert">{error}</p>}<div className="modal-actions multiline"><button className="button secondary" type="button" disabled={busy} onClick={() => run('expire')}>Simulate timeout</button><button className="button secondary" type="button" disabled={busy} onClick={() => run('decline')}>Decline</button><button className="button primary" type="button" disabled={busy} onClick={() => run('approve')}>Approve payment</button></div></> : <><p className="helper-text" role="status">Sandbox callback code <b>{item.resultCode}</b>. {item.status === 'completed' ? 'Paper balance updated.' : 'No cash was credited.'}</p><button className="button primary full" type="button" onClick={close}>Done</button></>}</div>}
  </Modal>
}
export default function PaperTradingSimulator() {
  const { scope, role, toast } = useDesk()
  const wallet = useLiveQuery(() => db.wallets.get(scope), [scope]) || freshWallet(scope)
  const trades = useLiveQuery(() => db.trades.where('scope').equals(scope).sortBy('at'), [scope], [])
  const deposits = useLiveQuery(() => db.deposits.where('scope').equals(scope).sortBy('at'), [scope], [])
  const [symbol, setSymbol] = useState('SCOM')
  const [side, setSide] = useState('buy')
  const [quantity, setQuantity] = useState('100')
  const [tab, setTab] = useState('Positions')
  const [modal, setModal] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const lock = useRef(false)
  const asset = assets.find((row) => row.symbol === symbol)
  const quote = useMemo(() => { try { return fillQuote(asset, wallet.day, side, Number(quantity)) } catch { return null } }, [asset, quantity, side, wallet.day])
  const pnl = walletValue(wallet) - wallet.contributed
  const positions = Object.entries(wallet.positions)
  const currentRequest = deposits.find((row) => row.id === modal?.id)
  async function perform(operation, message) {
    if (lock.current) return
    lock.current = true; setBusy(true); setError('')
    try { await operation(); if (message) toast(message) } catch (err) { setError(err.message) } finally { setBusy(false); lock.current = false }
  }
  function exportLedger() {
    const records = [['type','time','symbol_or_ref','status_or_side','amount_cents','quantity','unit_price_cents'], ...trades.map((r) => ['fill', r.at, r.symbol, r.side, r.net, r.quantity, r.price]), ...deposits.map((r) => ['stk', r.at, r.reference, r.status, r.amount])]
    download('auratrade-paper-ledger.csv', csv(records), 'text/csv;charset=utf-8')
    toast('Paper ledger exported.')
  }
  return <div className="module-page"><SectionHeading eyebrow="PRACTICE DESK" title="Paper Trading" description="Trade illustrative NSE quotes, fund a paper wallet, and compare local benchmarks." icon="wallet"><button className="button secondary" type="button" disabled={busy} onClick={() => perform(() => advanceReplay(scope), 'Replay advanced one session.')}><Clock3 size={16}/> Next replay day</button><button type="button" className="button primary" onClick={() => setModal({ type: 'fund' })}><Smartphone size={16}/> Fund with M-Pesa</button></SectionHeading>
    <div className="sim-stats"><Stat label="Portfolio value" icon="wallet" value={money(walletValue(wallet) / 100)} detail={`Paper replay · Day ${wallet.day}`}>{wallet.curve.length > 1 && <Sparkline values={wallet.curve.map((p) => p.value)}/>}</Stat><Stat label="Available cash" icon="money" color="cyan" value={money(wallet.cash / 100)} detail="KES sandbox balance"/><Stat label="Net P&L" icon="activity" color={pnl >= 0 ? 'mint' : 'amber'} value={money(pnl / 100)} detail={`${changeLabel(portfolioReturn(wallet))} cash-flow adjusted`} /><Stat label="Open positions" icon="chart" color="violet" value={positions.length} detail={`${trades.length} simulated fills`}/></div>
    <div className="module-grid paper-grid"><div className="dashboard-column"><section className="glass module-card"><PanelTitle title="NSE replay watchlist" subtitle="Illustrative quotes · no orders reach a broker" icon="chart" color="cyan"><span className="subtle-badge">Day {wallet.day}</span></PanelTitle><div className="table-scroll"><table className="data-table watch-table"><thead><tr><th>Instrument</th><th>Replay price</th><th>Session change</th><th><span className="sr-only">Open ticket</span></th></tr></thead><tbody>{assets.map((item) => { const mark = replayPrice(item, wallet.day), prior = replayPrice(item, Math.max(0, wallet.day - 1)); return <tr key={item.symbol} className={symbol === item.symbol ? 'row-selected' : ''}><td><strong>{item.symbol}</strong><small>{item.name}</small></td><td><ReplayPrice value={mark} previous={prior} currency/></td><td><Delta value={wallet.day ? (mark / prior - 1) * 100 : 0}/></td><td><button className="icon-button bordered" type="button" title={`Trade ${item.symbol}`} aria-label={`Trade ${item.symbol}`} onClick={() => { setSymbol(item.symbol); document.getElementById('order-ticket')?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); document.querySelector('#order-ticket select')?.focus({ preventScroll: true }) }}><ArrowUpRight size={15}/></button></td></tr> })}</tbody></table></div></section>
    <section className="glass module-card"><PanelTitle title="Paper ledger" subtitle="Stored privately on this device" icon="history" color="violet"><button className="icon-button bordered" type="button" onClick={exportLedger} aria-label="Export paper ledger"><ArrowDownToLine size={15}/></button></PanelTitle><Tabs label="Ledger view" options={['Positions','Orders','Funding']} value={tab} onChange={setTab}/>
      {tab === 'Positions' && (positions.length ? <div className="table-scroll"><table className="data-table"><thead><tr><th>Symbol</th><th>Shares</th><th>Cost basis</th><th>Market value</th></tr></thead><tbody>{positions.map(([key, pos]) => <tr key={key}><td><strong>{key}</strong></td><td>{pos.quantity}</td><td className="mono">{money(pos.cost / 100)}</td><td className="mono">{money(pos.quantity * replayPrice(assets.find((a) => a.symbol === key), wallet.day) / 100)}</td></tr>)}</tbody></table></div> : <EmptyState icon="wallet" title="No open positions"><p>Use the order ticket to buy your first paper shares.</p></EmptyState>)}
      {tab === 'Orders' && (trades.length ? <div className="table-scroll"><table className="data-table"><thead><tr><th>Order</th><th>Shares</th><th>Fill</th><th>Net cash</th></tr></thead><tbody>{[...trades].reverse().map((r) => <tr key={r.id}><td><strong>{r.side.toUpperCase()} {r.symbol}</strong><small>Day {r.day} · {dateLabel(r.at)}</small></td><td>{r.quantity}</td><td className="mono">{money(r.price/100)}</td><td className="mono">{money(r.net/100)}</td></tr>)}</tbody></table></div> : <EmptyState title="No filled orders"><p>Simulated executions will appear here.</p></EmptyState>)}
      {tab === 'Funding' && (deposits.length ? <div className="table-scroll"><table className="data-table"><thead><tr><th>Reference</th><th>Amount</th><th>Status</th><th>Checkout</th></tr></thead><tbody>{[...deposits].reverse().map((r) => <tr key={r.id}><td><strong>{r.reference}</strong><small>{r.phone}</small></td><td>{money(r.amount/100)}</td><td><span className="subtle-badge">{r.status}</span></td><td>{r.status === 'pending' ? <button className="text-link" type="button" onClick={() => setModal({ type: 'fund', id: r.id })}>Resume <ArrowRight size={13}/></button> : `Code ${r.resultCode}`}</td></tr>)}</tbody></table></div> : <EmptyState title="No sandbox deposits"><p>Try a local M-Pesa STK push to add paper cash.</p></EmptyState>)}
      {role === 'admin' && <button type="button" className="text-link negative" onClick={() => setModal({ type: 'reset' })}><RotateCcw size={14}/> Reset paper wallet</button>}
    </section></div><div className="dashboard-column"><section id="order-ticket" className="glass module-card"><PanelTitle title="Order ticket" icon="activity" subtitle="Simulated market execution"/><form className="stack-form" onSubmit={(e) => { e.preventDefault(); perform(async () => { const result = await executeTrade(scope, { symbol, side, quantity: Number(quantity) }); setTab('Orders'); toast(`${result.side === 'buy' ? 'Bought' : 'Sold'} ${result.quantity} ${result.symbol} at ${money(result.price / 100)} (paper).`) }) }}><Tabs options={[{ value: 'buy', label: 'Buy' }, { value: 'sell', label: 'Sell' }]} value={side} onChange={(next) => { setSide(next); setError('') }} label="Order side" className="order-sides"/><label>Instrument<Select label="Order instrument" options={instruments} value={symbol} onChange={setSymbol}/></label><label>Quantity<input type="number" value={quantity} min="1" max="100000" step="1" required onChange={(e) => setQuantity(e.target.value)}/></label><div className="ticket-estimate"><div>Fill estimate <b>{quote ? money(quote.price / 100) : '—'}</b></div><div>Fee ({FEE_BPS} bps) <b>{quote ? money(quote.fee / 100) : '—'}</b></div><div>{side === 'buy' ? 'Total debit' : 'Net proceeds'} <b>{quote ? money(quote.net / 100) : '—'}</b></div></div>{error && <p className="form-error" role="alert">{error}</p>}<button className={`button ${side === 'buy' ? 'primary' : 'danger'} full`} type="submit" disabled={!quote || busy}>{side === 'buy' ? <ArrowUpRight size={17}/> : <ArrowDownLeft size={17}/>} {side === 'buy' ? 'Buy' : 'Sell'} {symbol} (paper)</button></form></section><OrderBook asset={asset} day={wallet.day}/><BenchmarkPanel wallet={wallet}/></div></div>
    {modal?.type === 'fund' && <FundingModal walletScope={scope} pending={currentRequest} close={() => setModal(null)}/>}
    {modal?.type === 'reset' && role === 'admin' && <Modal title="Reset the paper wallet?" description="Clears this device’s orders, positions and simulated deposits, then restores KES 100,000 in starting paper cash." close={() => setModal(null)}><div className="modal-actions"><button className="button secondary" type="button" onClick={() => setModal(null)}>Cancel</button><button className="button danger" type="button" disabled={busy} onClick={() => perform(async () => { await resetWallet(scope, role); setModal(null) }, 'Paper wallet reset.')}>Reset wallet</button></div></Modal>}
  </div>
}
