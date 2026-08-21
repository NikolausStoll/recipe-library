/**
 * OpenAI chat.completions.create helpers.
 * Reasoning models reject custom temperature; only the default (1) is allowed.
 * Keep the check family-based so dated snapshots and newly released variants
 * do not require a code change.
 */

/**
 * @param {string|null|undefined} model
 * @returns {boolean}
 */
export function modelSupportsCustomTemperature(model) {
  if (!model || typeof model !== 'string') return true
  const m = model.toLowerCase().trim()
  return !/^(?:gpt-5(?:[.-]|$)|o[1-9](?:[.-]|$))/.test(m)
}

/**
 * @param {number|string|null|undefined} temperature
 * @param {number} [max=0.3]
 * @returns {number}
 */
export function clampOpenAiTemperature(temperature, max = 0.3) {
  return Math.min(max, Math.max(0, Number(temperature) || 0))
}

/**
 * Spread into chat.completions.create. Omits temperature when the model only accepts the default.
 * @param {string} model
 * @param {number|string|null|undefined} temperature
 * @param {{ max?: number }} [options]
 * @returns {{ temperature?: number }}
 */
export function buildOpenAiChatTemperature(model, temperature, options = {}) {
  if (!modelSupportsCustomTemperature(model)) return {}
  return { temperature: clampOpenAiTemperature(temperature, options.max ?? 0.3) }
}
