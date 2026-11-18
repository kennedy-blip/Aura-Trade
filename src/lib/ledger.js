import { assets } from '../data/markets.js'
export const START_CENTS = 10_000_000
export const FEE_BPS = 20
export const cent = (kes) => Math.round(Number(kes) * 100)
export const replayPrice = (asset, day) => {
  if (!day) return cent(asset.price)
  const seed = assets.indexOf(asset) + 1
  return Math.max(1, cent(asset.price * Math.max(0.25, 1 + 0.0012 * day + 0.024 * Math.sin(day * 0.83 + seed) - 0.024 * Math.sin(seed))))
}
export function walletValue(wallet) {
  return wallet.cash + assets.reduce((sum, asset) => sum + (wallet.positions[asset.symbol]?.quantity || 0) * replayPrice(asset, wallet.day), 0)
}
export function freshWallet(scope) {
  return { scope, cash: START_CENTS, positions: {}, contributed: START_CENTS, realized: 0, day: 0, flows: [], curve: [{ day: 0, value: START_CENTS }], createdAt: new Date().toISOString() }
}
const replaySidePrice = (mark, side) => Math.max(1, Math.round(mark * (side === 'buy' ? 1.0015 : 0.9985)))
export function replayBook(asset, day) {
  const mark = replayPrice(asset, day), step = Math.max(1, Math.round(mark * .0008))
  const bestBid = replaySidePrice(mark, 'sell'), bestAsk = replaySidePrice(mark, 'buy')
  const seed = (assets.indexOf(asset) + 1) * 71 + day * 29
  return Array.from({ length: 5 }, (_, level) => ({
    bid: Math.max(1, bestBid - step * level), ask: bestAsk + step * level,
    bidSize: 100 + 25 * ((seed * (level + 3) + level * 61) % 121),
    askSize: 100 + 25 * ((seed * (level + 5) + level * 37) % 121),
  }))
}
export function fillQuote(asset, day, side, quantity) {
  if (!asset || !['buy', 'sell'].includes(side) || !Number.isSafeInteger(quantity) || quantity < 1 || quantity > 100_000) throw new Error('Enter 1 to 100,000 whole shares and choose an instrument.')
  const price = replaySidePrice(replayPrice(asset, day), side)
  const gross = price * quantity
  const fee = Math.max(1, Math.round(gross * FEE_BPS / 10_000))
  return { price, gross, fee, net: side === 'buy' ? gross + fee : gross - fee }
}
export function applyOrder(wallet, { symbol, side, quantity }) {
  const asset = assets.find((row) => row.symbol === symbol)
  const quote = fillQuote(asset, wallet.day, side, quantity)
  const position = wallet.positions[symbol] || { quantity: 0, cost: 0 }
  const next = { ...wallet, positions: { ...wallet.positions } }
  if (side === 'buy') {
    if (quote.net > next.cash) throw new Error('Not enough paper cash for this order, including fees.')
    next.cash -= quote.net
    next.positions[symbol] = { quantity: position.quantity + quantity, cost: position.cost + quote.net }
  } else {
    if (quantity > position.quantity) throw new Error('You cannot sell more shares than you hold.')
    next.cash += quote.net
    const cost = Math.round(position.cost * quantity / position.quantity)
    next.realized += quote.net - cost
    if (position.quantity === quantity) delete next.positions[symbol]
    else next.positions[symbol] = { quantity: position.quantity - quantity, cost: position.cost - cost }
  }
  return { wallet: recordEquity(next), quote }
}
export function recordEquity(wallet) {
  return { ...wallet, curve: [...wallet.curve.filter((item) => item.day !== wallet.day), { day: wallet.day, value: walletValue(wallet) }] }
}
export function portfolioReturn(wallet) {
  const pnl = walletValue(wallet) - wallet.contributed
  const weighted = wallet.flows.reduce((sum, flow) => sum + flow.amount * (wallet.day ? (wallet.day - flow.day) / wallet.day : 1), START_CENTS)
  return weighted ? pnl / weighted * 100 : 0
}
export function testPhone(raw) {
  const normal = raw.replace(/[\s()+-]/g, '').replace(/^0/, '254')
  if (!/^254(?:7|1)\d{8}$/.test(normal)) throw new Error('Enter a Kenyan test number (e.g. 0700 000 000).')
  return `••• ${normal.slice(-4)}`
}
