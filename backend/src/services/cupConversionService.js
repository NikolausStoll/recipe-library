/**
 * Cup conversion stage: runs after normalization/vision extract on cup-unit ingredient rows only.
 * Prompt tuning is a separate follow-up; this module owns structure, schemas, and merge logic.
 */

import OpenAI from 'openai'
import { buildOpenAiChatTemperature } from '../utils/openaiChatParams.js'

const DEFAULT_MODEL =
  process.env.AI_CUP_CONVERSION_MODEL ||
  process.env.OPENAI_NORMALIZE_MODEL_PRIMARY ||
  'gpt-4o-mini'
const TEMPERATURE = Math.min(
  0.3,
  Math.max(0, Number(process.env.AI_CUP_CONVERSION_TEMPERATURE) ?? 0.1),
)
const ENABLED =
  process.env.AI_CUP_CONVERSION_ENABLED !== 'false' &&
  process.env.AI_CUP_CONVERSION_ENABLED !== '0'

/** Cup unit variants used in structured recipes (case-insensitive match). */
export const CUP_UNIT_VARIANTS = ['cup', 'cups', 'tasse', 'tassen']

/**
 * @param {string | null | undefined} unit
 * @returns {boolean}
 */
export function isCupUnit(unit) {
  if (unit == null || String(unit).trim() === '') return false
  return CUP_UNIT_VARIANTS.includes(String(unit).trim().toLowerCase())
}

/**
 * @param {string | null | undefined} unit
 * @returns {string | null}
 */
export function normalizeCupUnit(unit) {
  if (!isCupUnit(unit)) return unit ?? null
  const lower = String(unit).trim().toLowerCase()
  if (lower === 'cup' || lower === 'cups') return 'cup'
  if (lower === 'tasse' || lower === 'tassen') return 'Tasse'
  return String(unit).trim()
}

/**
 * @param {number} sectionIndex
 * @param {number} itemIndex
 * @returns {string}
 */
export function cupIngredientId(sectionIndex, itemIndex) {
  return `${sectionIndex}:${itemIndex}`
}

/**
 * @param {object} envelope – { status, confidence, warnings, missingFields, recipe }
 * @returns {{ id: string, sectionIndex: number, itemIndex: number, row: object }[]}
 */
export function extractCupIngredientRows(envelope) {
  const sections = envelope?.recipe?.ingredientsSections
  if (!Array.isArray(sections)) return []

  const rows = []
  for (let sectionIndex = 0; sectionIndex < sections.length; sectionIndex++) {
    const items = Array.isArray(sections[sectionIndex]?.items) ? sections[sectionIndex].items : []
    for (let itemIndex = 0; itemIndex < items.length; itemIndex++) {
      const row = items[itemIndex]
      if (isCupUnit(row?.unit)) {
        rows.push({
          id: cupIngredientId(sectionIndex, itemIndex),
          sectionIndex,
          itemIndex,
          row,
        })
      }
    }
  }
  return rows
}

/**
 * @param {object} envelope
 * @returns {{ ingredients: object[] } | null}
 */
export function buildCupConversionRequest(envelope) {
  const cupRows = extractCupIngredientRows(envelope)
  if (!cupRows.length) return null

  return {
    ingredients: cupRows.map(({ id, row }) => ({
      id,
      amount: row.amount ?? null,
      amountMax: row.amountMax ?? null,
      unit: row.unit ?? null,
      ingredient: row.ingredient ?? '',
      additionalInfo: row.additionalInfo ?? null,
    })),
  }
}

export const CUP_CONVERSION_RESPONSE_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['items'],
  properties: {
    items: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['id', 'action', 'amount', 'amountMax', 'unit', 'confidence'],
        properties: {
          id: { type: 'string' },
          action: { type: 'string', enum: ['convert', 'keep'] },
          amount: { type: ['number', 'null'] },
          amountMax: { type: ['number', 'null'] },
          unit: { type: ['string', 'null'] },
          confidence: { type: 'number', minimum: 0, maximum: 1 },
        },
      },
    },
  },
}

/** Placeholder prompt — final tuning is a separate task. */
const CUP_CONVERSION_PROMPT = `
You convert cup-measured ingredients to grams or milliliters using reasonable culinary estimates.

Return JSON only.

Rules:
- Return exactly one item per input id.
- Use action "convert" when conversion is plausible; otherwise "keep".
- For "convert", return amount, amountMax, and unit ("g" or "ml").
- Never add, remove, or rename ids.
- Match by core ingredient, ignoring non-density descriptors like organic, baby, vegan, brand names, or quality labels when appropriate.
- Do not ignore density/preparation descriptors like cooked, uncooked, dry, drained, sliced, chopped, grated, packed, loose, or frozen; use them to choose or adjust the conversion.
- Liquids convert to ml, usually 1 cup ≈ 240 ml.
- Solids convert to g using reasonable culinary estimates.
- Do not use 240 g per cup as a generic fallback for solids.
- Round to practical kitchen values, usually nearest 5 g/ml; avoid 97 g or 118 ml; never round non-zero to 0.`

/**
 * @param {object} envelope
 * @param {object} response – { items: object[] }
 * @param {string[]} expectedIds
 * @returns {{ envelope: object, warnings: string[], partial: boolean }}
 */
export function mergeCupConversionResponse(envelope, response, expectedIds) {
  const warnings = []
  const items = Array.isArray(response?.items) ? response.items : []
  const itemMap = new Map()
  for (const item of items) {
    if (item?.id != null) itemMap.set(String(item.id), item)
  }

  const missingIds = expectedIds.filter((id) => !itemMap.has(id))
  if (missingIds.length > 0) {
    warnings.push('Cup conversion partially failed; some cup units were kept unchanged.')
  }

  const sections = envelope?.recipe?.ingredientsSections
  if (!Array.isArray(sections)) {
    return { envelope, warnings, partial: missingIds.length > 0 }
  }

  const newSections = sections.map((section, sectionIndex) => {
    const rowItems = Array.isArray(section?.items) ? section.items : []
    const newItems = rowItems.map((row, itemIndex) => {
      const id = cupIngredientId(sectionIndex, itemIndex)
      const conv = itemMap.get(id)
      if (!conv || conv.action === 'keep') return row
      if (conv.action === 'convert') {
        return {
          ...row,
          amount: conv.amount ?? row.amount,
          amountMax: conv.amountMax ?? row.amountMax,
          unit: conv.unit ?? row.unit,
          // ingredient, additionalInfo, originalText, category are never touched
        }
      }
      return row
    })
    return { ...section, items: newItems }
  })

  return {
    envelope: {
      ...envelope,
      recipe: {
        ...envelope.recipe,
        ingredientsSections: newSections,
      },
    },
    warnings,
    partial: missingIds.length > 0,
  }
}

/**
 * @param {object} requestPayload
 * @param {string} [model]
 * @returns {Promise<{ response: object, usage?: object, model: string, request_json: string }>}
 */
async function callCupConversionLLM(requestPayload, model = DEFAULT_MODEL) {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) throw new Error('OPENAI_API_KEY is not set')

  const client = new OpenAI({ apiKey })
  const request_json = JSON.stringify(requestPayload)

  const completion = await client.chat.completions.create({
    model,
    ...buildOpenAiChatTemperature(model, TEMPERATURE),
    messages: [
      { role: 'system', content: CUP_CONVERSION_PROMPT },
      {
        role: 'user',
        content: `Cup conversion request JSON:\n${request_json}\n\nReturn valid JSON matching the cup conversion response schema exactly.`,
      },
    ],
    response_format: {
      type: 'json_schema',
      json_schema: {
        name: 'cup_conversion',
        strict: true,
        schema: CUP_CONVERSION_RESPONSE_SCHEMA,
      },
    },
  })

  const content = completion.choices?.[0]?.message?.content
  if (!content) throw new Error('No content in cup conversion response')

  const response = JSON.parse(content)
  const usage = completion.usage
    ? {
        prompt_tokens: completion.usage.prompt_tokens,
        completion_tokens: completion.usage.completion_tokens,
        total_tokens: completion.usage.total_tokens,
      }
    : undefined

  return { response, usage, model, request_json }
}

/**
 * @param {object} envelope – structured recipe envelope from normalization or vision extract
 * @param {{ callLLM?: typeof callCupConversionLLM }} [deps] – injectable for tests
 * @returns {Promise<{
 *   envelope: object,
 *   warnings: string[],
 *   skipped: boolean,
 *   attempt: { response: object, usage?: object, model: string, request_json: string } | null,
 *   meta: { cupRowCount: number, converted: boolean }
 * }>}
 */
export async function convertCupIngredients(envelope, deps = {}) {
  const callLLM = deps.callLLM ?? callCupConversionLLM
  const base = envelope && typeof envelope === 'object' ? envelope : {}
  const warnings = []
  const cupRows = extractCupIngredientRows(base)

  if (!cupRows.length) {
    return {
      envelope: base,
      warnings: ['No cup ingredients found; cup conversion skipped.'],
      skipped: true,
      attempt: null,
      meta: { cupRowCount: 0, converted: false },
    }
  }

  if (!ENABLED) {
    return {
      envelope: base,
      warnings: ['Cup conversion is disabled; cup units were kept unchanged.'],
      skipped: true,
      attempt: null,
      meta: { cupRowCount: cupRows.length, converted: false },
    }
  }

  const requestPayload = buildCupConversionRequest(base)
  const expectedIds = cupRows.map((r) => r.id)

  try {
    const attempt = await callLLM(requestPayload)
    const { envelope: merged, warnings: mergeWarnings, partial } = mergeCupConversionResponse(
      base,
      attempt.response,
      expectedIds,
    )
    warnings.push(...mergeWarnings)
    return {
      envelope: merged,
      warnings,
      skipped: false,
      attempt,
      meta: { cupRowCount: cupRows.length, converted: !partial },
    }
  } catch (e) {
    console.error('convertCupIngredients failed:', e)
    warnings.push('Cup conversion failed; cup units were kept unchanged.')
    return {
      envelope: base,
      warnings,
      skipped: false,
      attempt: null,
      meta: { cupRowCount: cupRows.length, converted: false },
    }
  }
}
