export const num = (value, digits = 2) => Number.isFinite(value) ? value.toLocaleString('en-KE', { minimumFractionDigits: digits, maximumFractionDigits: digits }) : '—'
export const money = (value, digits = 2) => `KES ${num(value, digits)}`
export function dateLabel(date, options = { day: 'numeric', month: 'short', year: 'numeric' }) {
  const value = new Date(date)
  const period = typeof date === 'string' && /^\d{4}-\d{2}$/.test(date) ? { month: 'short', year: 'numeric' } : options
  return Number.isNaN(value.getTime()) ? '—' : new Intl.DateTimeFormat('en-GB', { ...period, timeZone: 'Africa/Nairobi' }).format(value)
}
export function changeLabel(value, suffix = '%', digits = suffix === '%' ? 2 : 1) {
  if (!Number.isFinite(value)) return '—'
  const sign = value > 0 ? '+' : value < 0 ? '−' : ''
  return `${sign}${num(Math.abs(value), suffix === 'bps' && Number.isInteger(value) ? 0 : digits)}${suffix === '%' ? '%' : ` ${suffix}`}`
}
export const tone = (value) => value > 0 ? 'positive' : value < 0 ? 'negative' : 'neutral'
export function displayValue(row) {
  return `${num(row.value, row.digits ?? 2)}${row.unit === '%' ? '%' : row.unit === 'pts' || row.unit === 'KES' ? '' : ` ${row.unit}`}`
}
export function isDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const parsed = new Date(value)
  return !Number.isNaN(+parsed) && parsed.toISOString().slice(0, 10) === value
}
export function csv(rows) {
  return rows.map((r) => r.map((v) => {
    const text = String(v ?? '')
    return `"${(typeof v !== 'number' && /^[\s]*[=+\-@\t\r]/.test(text) ? `'${text}` : text).replaceAll('"', '""')}"`
  }).join(',')).join('\r\n')
}
export function download(name, data, type = 'application/json') {
  const url = URL.createObjectURL(new Blob([data], { type }))
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1500)
}
