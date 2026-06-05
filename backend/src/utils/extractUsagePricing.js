/**
 * OpenAI pricing for ai_token_usage cost estimates (USD per 1M tokens).
 * Rates: input (non-cached prompt), cachedInput (for future use), output.
 * Cost estimates use input + output only until cached token counts are logged.
 */

/** @type {Record<string, { input: number, cachedInput: number, output: number }>} */
export const PRICING_USD_PER_1M = {
  'gpt-5.5': { input: 5.0, cachedInput: 0.5, output: 30.0 },
  'gpt-5.4': { input: 2.5, cachedInput: 0.25, output: 15.0 },
  'gpt-5.4-mini': { input: 0.75, cachedInput: 0.075, output: 4.5 },
  'gpt-5.4-nano': { input: 0.2, cachedInput: 0.02, output: 1.25 },
  'gpt-5.2': { input: 1.75, cachedInput: 0.175, output: 14.0 },
  'gpt-5.1': { input: 1.25, cachedInput: 0.125, output: 10.0 },
  'gpt-5': { input: 1.25, cachedInput: 0.125, output: 10.0 },
  'gpt-5-mini': { input: 0.25, cachedInput: 0.025, output: 2.0 },
  'gpt-5-nano': { input: 0.05, cachedInput: 0.005, output: 0.4 },
  'gpt-4.1': { input: 2.0, cachedInput: 0.5, output: 8.0 },
  'gpt-4.1-mini': { input: 0.4, cachedInput: 0.1, output: 1.6 },
  'gpt-4.1-nano': { input: 0.1, cachedInput: 0.025, output: 0.4 },
  'gpt-4o': { input: 2.5, cachedInput: 1.25, output: 10.0 },
  'gpt-4o-mini': { input: 0.15, cachedInput: 0.075, output: 0.6 },
}

/** Most specific model id first (avoids gpt-5 matching gpt-5.4, etc.). */
const MODEL_MATCH_ORDER = [
  'gpt-5.4-nano',
  'gpt-5.4-mini',
  'gpt-5.4',
  'gpt-5.5',
  'gpt-5.2',
  'gpt-5.1',
  'gpt-5-nano',
  'gpt-5-mini',
  'gpt-4.1-nano',
  'gpt-4.1-mini',
  'gpt-4.1',
  'gpt-4o-mini',
  'gpt-4o',
  'gpt-5',
]

/**
 * Map API model string to a known pricing key (handles dated variants like gpt-4o-mini-2024-07-18).
 * @param {string|null|undefined} model
 * @returns {keyof typeof PRICING_USD_PER_1M | null}
 */
export function resolvePricingKey(model) {
  if (!model || typeof model !== 'string') return null
  const m = model.toLowerCase().trim()
  if (PRICING_USD_PER_1M[m]) return m
  for (const key of MODEL_MATCH_ORDER) {
    if (m.includes(key)) return key
  }
  return null
}

/**
 * Estimated USD cost for one completion request (non-cached input tokens).
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
