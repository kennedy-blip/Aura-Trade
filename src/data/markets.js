export const MARKET_DATE = '2026-11-12'
export const kenya = 'Kenya'
export const global = 'Global'

const bulletin = 'https://www.centralbank.go.ke/uploads/weekly_bulletin/816739182_Weekly%20Bulletin%20Week%20Ending%20November%2013,%202026.pdf'
export const sources = {
  cbk: { name: 'Central Bank of Kenya', code: 'CBK', url: 'https://www.centralbank.go.ke/releases/weekly-bulletin/', group: kenya },
  bulletin: { name: 'CBK Weekly Bulletin', code: 'CBK', url: bulletin, date: '2026-11-13' },
  octBulletin: { name: 'CBK Weekly Bulletin · 30 Oct', code: 'CBK', url: 'https://www.centralbank.go.ke/uploads/weekly_bulletin/1190512301_Weekly%20CBK%20Bulletin,%20October%2030,%202026.pdf', date: '2026-10-30' },
  novBulletin: { name: 'CBK Weekly Bulletin · 6 Nov', code: 'CBK', url: 'https://www.centralbank.go.ke/uploads/weekly_bulletin/1864387498_Weekly%20CBK%20Bulletin%20November%206,%202026.pdf', date: '2026-11-06' },
  mpc: { name: 'CBK Monetary Policy Committee', code: 'CBK', url: 'https://www.centralbank.go.ke/uploads/mpc_press_release/224745454_MPC%20Press%20Release%20-%20Meeting%20of%20October%207%202026.pdf', date: '2026-10-07' },
  mpc2025: { name: 'CBK MPC · June 2025', code: 'CBK', url: 'https://www.centralbank.go.ke/2025/06/10/11353/', date: '2025-06-10' },
  july2025: { name: 'CBK Weekly Bulletin · July 2025', code: 'CBK', url: 'https://www.centralbank.go.ke/uploads/weekly_bulletin/2067935767_Weekly%20CBK%20Bulletin%20July%204,%202025.pdf', date: '2025-07-04' },
  knbs: { name: 'Kenya National Bureau of Statistics', code: 'KNBS', url: 'https://www.knbs.or.ke/reports/', group: kenya },
  cpi: { name: 'KNBS Consumer Price Index', code: 'KNBS', url: 'https://www.knbs.or.ke/reports/consumer-price-indices-and-inflation-rates-october-2026/', date: '2026-10-30' },
  gdp: { name: 'KNBS Quarterly GDP', code: 'KNBS', url: 'https://www.knbs.or.ke/wp-content/uploads/2026/10/Kenya-Quarterly-Gross-Domestic-Product-Second-Quarter-2026.pdf', date: '2026-10' },
  epra: { name: 'Energy & Petroleum Regulatory Authority', code: 'EPRA', url: 'https://www.epra.go.ke/pump-prices', group: kenya },
  fuel: { name: 'EPRA Petroleum Price Review', code: 'EPRA', url: 'https://www.epra.go.ke/maximum-retail-petroleum-prices-kenya-period-15th-november-2026-14th-december-2026', date: '2026-11-14' },
  fuelReport: { name: 'HapaKenya · EPRA November review', code: 'HAPA', url: 'https://hapakenya.com/2026/11/14/epra-retains-same-fuel-prices-for-nov-dec-cycle-after-ksh-4-6b-state-cushion/', date: '2026-11-14' },
  eatta: { name: 'East African Tea Trade Association', code: 'EATTA', url: 'https://eatta.co.ke/', group: kenya },
  tea: { name: 'EATTA Mombasa Auction · Sale 17', code: 'EATTA', url: 'https://eatta.co.ke/documents/Sale%2017%202026%20auction%20report.pdf', date: '2026-04-27' },
  nse: { name: 'Nairobi Securities Exchange', code: 'NSE', url: 'https://www.nse.co.ke/dataservices/market-statistics/', group: kenya },
  nseNotice: { name: 'NSE Daily Price List · Corporate Actions', code: 'NSE', url: 'https://www.nse.co.ke/wp-content/uploads/11-JUN-25.pdf', date: '2025-06-11' },
  nseResults: { name: 'NSE Plc · Interim Results', code: 'NSE', url: 'https://www.nse.co.ke/wp-content/uploads/Nairobi-Securities-Exchange-Plc-Unaudited-Financial-Statements-for-the-6-months-ended-30-June-2026.pdf', date: '2026-08-27' },
  fred: { name: 'Federal Reserve Economic Data', code: 'FRED', url: 'https://fred.stlouisfed.org/series/DGS10', group: global },
  sp500: { name: 'S&P 500 · FRED', code: 'FRED', url: 'https://fred.stlouisfed.org/data/SP500', date: '2026-11-13', group: global },
  dgs10: { name: 'US 10-Year Treasury Yield · FRED', code: 'FRED', url: 'https://fred.stlouisfed.org/data/DGS10', date: '2026-11-12', group: global },
  alpha: { name: 'Alpha Vantage', code: 'AV', url: 'https://www.alphavantage.co/documentation/', group: global },
  mmf: { name: 'CMA Collective Investment Schemes', code: 'CMA', url: 'https://www.cma.or.ke/approved-collective-investment-schemes/' },
}

export const feedSources = ['cbk', 'knbs', 'epra', 'eatta', 'nse', 'fred', 'alpha']
const row = (id, name, value, unit, source, asOf, digits = 2, period = '', delta, changeUnit) => ({ id, name, value, unit, source, asOf, digits, period, delta, changeUnit, url: sources[source].url, origin: 'snapshot', region: sources[source].group || kenya })
export const snapshot = [
  row('usd-kes', 'USD / KES', 129.96, 'KES', 'bulletin', MARKET_DATE, 2, 'Weekly change', 0, '%'),
  row('nse20', 'NSE 20 Index', 4174.67, 'pts', 'bulletin', MARKET_DATE, 2, 'Weekly change', 0.16, '%'),
  row('cbr', 'CBK Policy Rate', 8.75, '%', 'mpc', '2026-10-07', 2, 'Last MPC decision', 0, 'bps'),
  row('cpi', 'Kenya Inflation', 7.3, '%', 'cpi', '2026-10-30', 1, 'October 2026 · YoY', 0.5, 'pp'),
  row('tbill', '91-Day T-Bill', 8.745, '%', 'bulletin', MARKET_DATE, 3, 'Annual auction yield', -0.5, 'bps'),
  row('sp500', 'S&P 500', 7561.67, 'pts', 'sp500', '2026-11-13', 2, 'Daily close', (7561.67 / 7592.4 - 1) * 100, '%'),
  row('dgs10', 'US 10-Year Yield', 5.10, '%', 'dgs10', MARKET_DATE, 2, 'Constant maturity'),
  row('oil', 'Murban Crude', 90.07, 'USD', 'bulletin', MARKET_DATE, 2, 'Weekly change', -4.22, '%'),
  row('reserves', 'FX Reserves', 14.605, 'USD bn', 'bulletin', MARKET_DATE, 3, '5.9 months import cover'),
  row('nasi', 'NSE All Share', 241.56, 'pts', 'bulletin', MARKET_DATE, 2, 'Weekly change', -0.02, '%'),
  row('nse25', 'NSE 25 Index', 6798.63, 'pts', 'bulletin', MARKET_DATE, 2, 'Weekly change', 0.54, '%'),
  row('gdp', 'Real GDP Growth', 5.1, '%', 'gdp', '2026-06-30', 1, 'Q2 2026 · YoY', .2, 'pp'),
  row('petrol', 'Nairobi Petrol Cap', 226.96, 'KES/L', 'fuelReport', '2026-11-15', 2, '15 Nov–14 Dec 2026 · reported cap', 0, '%'),
  row('diesel', 'Nairobi Diesel Cap', 227.76, 'KES/L', 'fuelReport', '2026-11-15', 2, '15 Nov–14 Dec 2026 · reported cap', 0, '%'),
  row('kerosene', 'Nairobi Kerosene Cap', 219.87, 'KES/L', 'fuelReport', '2026-11-15', 2, '15 Nov–14 Dec 2026 · reported cap', 0, '%'),
  row('tea', 'Tea Auction Volume', 8.387866, 'million kg', 'tea', '2026-04-27', 2, 'Mombasa · Sale 17'),
  row('kesonia', 'Overnight Rate (KESONIA)', 8.75, '%', 'bulletin', MARKET_DATE, 2, 'Interbank rate'),
].map((item) => item.id === 'oil' ? { ...item, region: global } : item)

// Dates are trading sessions, not interpolated observations. Figures are transcribed from the CBK bulletins above.
const equityColumns = [
  ['2026-10-16', 4249.24, 240.50, 6828.77, 10.30], ['2026-10-19', 4263.83, 241.68, 6865.94, 4552.46],
  ['2026-10-21', 4250.43, 238.30, 6789.47, 14.71], ['2026-10-22', 4221.67, 228.13, 6757.32, 44.31],
  ['2026-10-23', 4177.40, 234.90, 6638.80, 16.88], ['2026-10-26', 4154.50, 234.60, 6596.50, 42.95],
  ['2026-10-27', 4139.80, 235.80, 6587.50, 16.61], ['2026-10-28', 4135.90, 237.80, 6588.40, 21.68],
  ['2026-10-29', 4111.70, 237.61, 6556.60, 15.06], ['2026-10-30', 4098.26, 238.16, 6556.73, 14.11],
  ['2026-11-02', 4115.84, 237.44, 6582.87, 11.38], ['2026-11-03', 4131.22, 236.85, 6624.98, 1101.69],
  ['2026-11-04', 4137.77, 236.61, 6653.53, 26.55], ['2026-11-05', 4167.97, 241.61, 6762.25, 15.40],
  ['2026-11-06', 4187.52, 239.72, 6733.75, 13.42], ['2026-11-09', 4164.21, 239.14, 6724.66, 23.29],
  ['2026-11-10', 4157.11, 239.04, 6726.74, 36.10], ['2026-11-11', 4160.54, 240.58, 6764.28, 24.05],
  ['2026-11-12', 4174.67, 241.56, 6798.63, 28.55],
]

export const series = {
  nse20: { name: 'NSE 20 Share Index', subtitle: 'Nairobi Securities Exchange', code: 'NSE 20', color: 'mint', digits: 2, columns: equityColumns, index: 1, volume: true, url: bulletin },
  nasi: { name: 'NSE All Share Index', subtitle: 'Nairobi Securities Exchange', code: 'NASI', color: 'violet', digits: 2, columns: equityColumns, index: 2, volume: true, url: bulletin },
  nse25: { name: 'NSE 25 Share Index', subtitle: 'Nairobi Securities Exchange', code: 'NSE 25', color: 'cyan', digits: 2, columns: equityColumns, index: 3, volume: true, url: bulletin },
  'usd-kes': { name: 'US Dollar / Kenyan Shilling', subtitle: 'Central Bank of Kenya reference rate', code: 'USD/KES', color: 'cyan', digits: 2, index: 1, url: bulletin, columns: ['10-30:129.95','11-02:129.94','11-03:129.97','11-04:129.95','11-05:129.96','11-06:129.91','11-09:129.96','11-10:129.96','11-11:129.95','11-12:129.96'].map((item) => { const [date, value] = item.split(':'); return [`2026-${date}`, Number(value)] }) },
  tbill: { name: '91-Day Treasury Bill', subtitle: 'Central Bank of Kenya auction yield', code: '91D T-Bill', color: 'amber', digits: 3, index: 1, url: bulletin, columns: [['2026-04-30',8.04],['2026-05-28',8.388],['2026-06-25',8.828],['2026-07-30',8.788],['2026-09-24',8.778],['2026-10-29',8.75],['2026-11-05',8.75],['2026-11-12',8.745]] },
}
export const cpiSeries = [4.6, 4.5, 4.5, 4.4, 4.3, 4.4, 5.6, 6.7, 6.9, 6.7, 6.6, 6.8, 7.3]
export const marketEvents = [
  { id: 'fuel-review', date: '2026-11-14', region: kenya, area: 'Energy', source: 'fuelReport', title: 'EPRA holds Nairobi fuel caps unchanged', detail: 'HapaKenya reported unchanged maximum retail prices for 15 November to 14 December despite higher landed costs. Nairobi caps are KES 226.96 for super petrol, KES 227.76 for diesel, and KES 219.87 for kerosene per litre.', impact: 'Higher pump caps can lift freight costs and near-term transport CPI. Whether industrial margins compress depends on firms’ pricing power.', icon: 'fuel', color: 'amber' },
  { id: 'bill-auction', date: '2026-11-12', region: kenya, area: 'Rates', source: 'bulletin', title: '91-day Treasury bill yield edges to 8.745%', detail: 'The 12 November auction received KES 69.3 billion in total T-bill bids against KES 28.0 billion offered, across all three tenors.', impact: 'The 91-day auction is a local hurdle rate, not a guaranteed return for an equity or fund investor.', icon: 'bank', color: 'mint' },
  { id: 'oil-retreat', date: '2026-11-12', region: global, area: 'Commodities', source: 'bulletin', title: 'Murban crude retreats to $90.07 per barrel', detail: 'CBK reported crude at $90.07 on 12 November, compared with $94.04 a week earlier.', impact: 'Lower dollar-denominated crude prices can ease Kenya’s import bill. The pass-through to local pumps depends on the EPRA pricing window, taxes and the exchange rate.', icon: 'globe', color: 'cyan' },
  { id: 'october-cpi', date: '2026-10-30', region: kenya, area: 'Inflation', source: 'cpi', title: 'Kenya headline inflation rises to 7.3%', detail: 'Transport prices rose 17.1% year on year. Food and non-alcoholic beverage prices rose 10.2%.', impact: 'Higher headline inflation can narrow the space for rate cuts, but policy also depends on core CPI and expectations.', icon: 'chart', color: 'violet' },
  { id: 'mpc-hold', date: '2026-10-07', region: kenya, area: 'Policy', source: 'mpc', title: 'CBK holds the policy rate at 8.75%', detail: 'The MPC stated the existing stance was appropriate for anchored inflation expectations and exchange-rate stability.', impact: 'A pause preserves domestic carry, all else equal. External dollar and commodity shocks can overwhelm that channel.', icon: 'bank', color: 'mint' },
  { id: 'nse-interim-results', date: '2026-08-27', region: kenya, area: 'Corporate disclosure', source: 'nseResults', title: 'NSE Plc reports first-half results', detail: 'The board approved the unaudited six-month statements on 27 August. The exchange reported KES 736.9 million in profit after tax and did not declare an interim dividend.', impact: 'A large Safaricom block trade boosted period turnover. Separate block trades from regular-market volume before inferring a sustained liquidity improvement.', icon: 'chart', color: 'cyan' },
  { id: 'nse-notice', date: '2025-06-11', region: kenya, area: 'Corporate action', source: 'nseNotice', title: 'NSE records Safaricom final dividend notice', detail: 'The daily price list recorded a KES 0.65 final dividend announced 9 May 2025, with books closing 31 July 2025.', impact: 'Use a total-return series for dividend event studies; unadjusted prices can drop on the ex-date without an equivalent economic loss.', icon: 'chart', color: 'cyan' },
]

export const historicalStudies = [
  { id: 'mpc-hold', title: 'October 2026 · Policy pause', category: 'Policy', date: '2026-10-07', source: 'mpc', baseline: '8.75% CBR', observed: '0 bps decision', detail: 'The MPC held the CBR amid elevated global energy prices. The 6.8% September headline CPI it cited remained within the target band. Use the statement timing for an event window; the bundled record does not establish a causal equity return.' },
  { id: 'crude', title: 'November 2026 · Cheaper crude, stable KES', category: 'Energy', date: MARKET_DATE, source: 'bulletin', baseline: '$94.04 / bbl · 5 Nov', observed: '$90.07 / bbl · 12 Nov', detail: 'USD/KES was 129.96 on both dates even as oil fell 4.22%. Offset by flows and positioning, an oil move is not a one-for-one FX signal.' },
  { id: 'mpc-cut', title: 'June 2025 · CBK cuts by 25 bps', category: 'Policy', date: '2025-06-10', source: 'mpc2025', baseline: '10.00% CBR', observed: '9.75% CBR', detail: 'Lower short-term rates can reduce discount rates and borrowing costs, but weak growth can drive both the decision and equity valuations. Compare equities to a benchmark over the same trading window before attributing a return.' },
  { id: 'nse-rally', title: 'July 2025 · NSE 20 weekly rally', category: 'Equities', date: '2025-07-03', source: 'july2025', baseline: '2,342.91 · 26 Jun', observed: '2,473.79 · +5.59%', detail: 'Price index change over the week, as published by CBK. It excludes dividends and is not assigned to a single macro release.' },
]

export const prompts = [
  { icon: 'trend', agent: 'macro', text: 'What’s driving USD/KES?' },
  { icon: 'fuel', agent: 'macro', text: 'How do fuel prices affect NSE stocks?' },
  { icon: 'bank', agent: 'quant', text: 'Compare T-bills and money market funds' },
]

export const assets = [
  { symbol: 'SCOM', name: 'Safaricom', price: 29.8, change: 0.68, sector: 'Telecom' },
  { symbol: 'EQTY', name: 'Equity Group', price: 62.5, change: 1.13, sector: 'Financials' },
  { symbol: 'KCB', name: 'KCB Group', price: 64.25, change: -0.77, sector: 'Financials' },
  { symbol: 'EABL', name: 'East African Breweries', price: 241, change: 0.42, sector: 'Consumer' },
  { symbol: 'BAT', name: 'BAT Kenya', price: 428, change: -0.35, sector: 'Consumer' },
  { symbol: 'KEGN', name: 'KenGen', price: 8.79, change: 1.62, sector: 'Utilities' },
]
export const fundScenarios = [{ name: 'CIC Money Market Fund', rate: 10.2 }, { name: 'NCBA Money Market Fund', rate: 10.4 }, { name: 'Sanlam Money Market Fund', rate: 10.6 }]
