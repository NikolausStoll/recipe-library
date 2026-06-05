/**
 * OpenAI chat.completions.create helpers.
 * Some models reject custom temperature; only default (1) is allowed.
 * Add model ids to NO_CUSTOM_TEMPERATURE_MODELS as you discover them.
 */

/** Model id substrings that must not receive a custom temperature param. */
const NO_CUSTOM_TEMPERATURE_MODELS = ['gpt-5-nano', 'gpt-5-mini']

/**
 * @param {string|null|undefined} model
 * @returns {boolean}
 */
export function modelSupportsCustomTemperature(model) {
  if (!model || typeof model !== 'string') return true
  const m = model.toLowerCase().trim()
  return !NO_CUSTOM_TEMPERATURE_MODELS.some((id) => m.includes(id))
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
