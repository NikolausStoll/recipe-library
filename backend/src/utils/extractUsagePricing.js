/**
 * OpenAI pricing for ai_token_usage cost estimates (USD per 1M tokens).
 * GPT-4o mini: $0.15 input / $0.60 output per 1M
 * GPT-4.1 mini: $0.40 input / $1.60 output per 1M
 */

const PRICING_USD_PER_1M = {
  'gpt-4o-mini': { input: 0.15, output: 0.6 },
  'gpt-4.1-mini': { input: 0.4, output: 1.6 },
}

/**
 * Map API model string to a known pricing key (handles dated variants).
 * @param {string|null|undefined} model
 * @returns {keyof typeof PRICING_USD_PER_1M | null}
 */
export function resolvePricingKey(model) {
  if (!model || typeof model !== 'string') return null
  const m = model.toLowerCase().trim()
  if (m.includes('gpt-4.1') && m.includes('mini')) return 'gpt-4.1-mini'
  if (m.includes('gpt-4o') && m.includes('mini')) return 'gpt-4o-mini'
  if (PRICING_USD_PER_1M[m]) return m
  return null
}

/**
 * Estimated USD cost for one completion request.
 * @returns {number|null}
 */
export function computeRequestCostUsd(promptTokens, completionTokens, model) {
  const key = resolvePricingKey(model)
  if (!key) return null
  const rates = PRICING_USD_PER_1M[key]
  const pt = Math.max(0, Number(promptTokens) || 0)
  const ct = Math.max(0, Number(completionTokens) || 0)
  return (pt / 1_000_000) * rates.input + (ct / 1_000_000) * rates.output
}

/**
 * Same cost expressed in US cents (1 USD = 100 cents). May be fractional (e.g. 0.045).
 * @returns {number|null}
 */
export function computeRequestCostCents(promptTokens, completionTokens, model) {
  const usd = computeRequestCostUsd(promptTokens, completionTokens, model)
  if (usd == null) return null
  return Math.round(usd * 100 * 1e6) / 1e6
}
