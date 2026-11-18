export const baseline = Object.freeze({ cpiFuel: 0.045, fxFuel: 0.035, fxRate: -0.38, equityRate: -1.15, equityFuel: -0.12 })
export const agentDefaults = Object.freeze({ scope: '', detail: 'Standard' })
export function validateSettings(input) {
  const model = Object.fromEntries(Object.keys(baseline).map((key) => {
    const value = input?.model?.[key]
    if (typeof value !== 'number' || !Number.isFinite(value) || Math.abs(value) > 5) throw new Error(`Enter a coefficient between −5 and 5 for ${key}.`)
    return [key, value]
  }))
  const detail = input?.agent?.detail
  if (!['Concise', 'Standard', 'Detailed'].includes(detail)) throw new Error('Choose a supported research depth.')
  const scope = input?.agent?.scope
  if (typeof scope !== 'string' || scope.length > 500) throw new Error('Research guidance can be at most 500 characters.')
  return { model, agent: { scope: scope.trim(), detail } }
}
export function shockImpact(fuelPercent, rateBps, usdPercent, model = baseline) {
  const fx = model.fxFuel * fuelPercent + model.fxRate * rateBps / 100 + 0.62 * usdPercent
  return [model.cpiFuel * fuelPercent + 0.018 * fx, fx, model.equityRate * rateBps / 100 + model.equityFuel * fuelPercent - 0.32 * fx]
}
export const simpleBenchmark = (rate, days) => rate * days / 365
export const compoundedBenchmark = (rate, days) => (Math.pow(1 + rate / 100, days / 365) - 1) * 100
export function taxEstimate(mode, inputs) {
  if (!['capital', 'excise', 'legacy'].includes(mode)) throw new Error('Select a tax calculation.')
  const fields = mode === 'capital' ? ['proceeds','cost','expenses'] : ['value']
  if (fields.some((key) => inputs[key] === undefined || inputs[key] === '' || !Number.isFinite(Number(inputs[key])) || Number(inputs[key]) < 0 || Number(inputs[key]) > 1e12)) throw new Error('Enter valid non-negative amounts (up to KES 1 trillion).')
  const base = mode === 'capital' ? Number(inputs.proceeds) - Number(inputs.cost) - Number(inputs.expenses) : Number(inputs.value)
  const rate = { capital: 0.15, excise: 0.10, legacy: 0.03 }[mode]
  return { base, rate, tax: Math.round(Math.max(0, base) * rate * 100) / 100 }
}
