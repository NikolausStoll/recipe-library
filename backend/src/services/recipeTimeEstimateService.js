/**
 * OpenAI estimate for prep and cook times (separate from vision extract / URL normalize).
 */

import OpenAI from 'openai'

const DEFAULT_MODEL = process.env.OPENAI_TIME_ESTIMATE_MODEL || 'gpt-4o-mini'
const TEMPERATURE = Math.min(0.3, Math.max(0, Number(process.env.OPENAI_TIME_ESTIMATE_TEMPERATURE) || 0.2))

const TIME_ESTIMATE_PROMPT = `
You estimate practical prep and cook times for a recipe.

Return only valid JSON matching the provided JSON schema.

Context:
Source times may exist but are often optimistic. Use them only as weak hints. Always provide your own estimate for a normal home cook.

Definitions:
- prepTimeMinutes = active work: washing, peeling, cutting, chopping, grating, measuring, mixing, seasoning, shaping, assembling, coating, filling pans, preparing sauces/herbs.
- cookTimeMinutes = mostly passive elapsed time: baking, roasting, simmering, boiling, steaming, chilling, resting, marinating.
- If active work happens while food cooks, count active work as prep and heat/rest time as cook. Do not double-count parallel time.

Method:
1. Cook time
- Use explicit bake/simmer/boil/roast/rest/chill durations from steps.
- For ranges, use the upper practical value rounded to nearest 5 minutes.
  Example: 20–25 min → 25 min.
- Add sequential cooking phases.
- For clearly parallel phases, use the longer phase.

2. Prep time
Start with:
- very simple: 5 min
- normal: 10 min
- many ingredients/actions: 15 min
- labor-intensive: 20+ min

Add practical effort:
- wash/peel/cut 1–3 vegetables: +5 min
- wash/peel/cut 4–6 vegetables: +10 min
- many/bulky vegetables: +15 min
- mince/chop herbs, garlic, onion, aromatics: +3–8 min
- grating/shredding/thin slicing/mandoline: +5–15 min
- stuffing/rolling/stacking/shaping/individual portions: +10–20 min
- simple sauce/dressing/oil: +3–5 min
- multiple bowls/components: +5–10 min
- opening/measuring pantry items: +1–3 min total

Minimums:
- multiple fresh ingredients: usually ≥10 min prep
- peeling/slicing/chopping: usually ≥15 min prep
- repeated assembly: usually ≥20 min prep
- use 5 min prep only for truly minimal recipes

Rounding:
- Round prepTimeMinutes and cookTimeMinutes to nearest 5 minutes.
- Use stable values: 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 60.
- Avoid precise values like 13 or 27.

Confidence:
- prepTimeConfidence:
  - 0.8–0.95 clear ingredients/prep
  - 0.6–0.8 partly ambiguous
  - 0.4–0.6 sparse/unclear
- cookTimeConfidence:
  - 0.85–0.95 explicit durations
  - 0.6–0.8 method clear but duration missing
  - 0.4–0.6 unclear

Rules:
- Do not copy source times blindly.
- Do not assume professional speed.
- Do not underestimate repetitive prep.
- Be realistic, stable, and practical, not optimistic.`

const TIME_ESTIMATE_JSON_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['prepTimeMinutes', 'prepTimeConfidence', 'cookTimeMinutes', 'cookTimeConfidence'],
  properties: {
    prepTimeMinutes: { type: ['number', 'null'] },
    prepTimeConfidence: { type: 'number', minimum: 0, maximum: 1 },
    cookTimeMinutes: { type: ['number', 'null'] },
    cookTimeConfidence: { type: 'number', minimum: 0, maximum: 1 },
  },
}

function clampConfidence(n) {
  if (typeof n !== 'number' || Number.isNaN(n)) return null
  return Math.min(1, Math.max(0, n))
}

function clampMinutes(n) {
  if (n == null || typeof n !== 'number' || Number.isNaN(n)) return null
  const r = Math.round(n)
  return r < 0 ? 0 : r
}

/**
 * Normalize client-provided estimate (replay after user confirms overwriting original times).
 * @param {object} body
 * @returns {{ prepTimeMinutes: number|null, prepTimeConfidence: number, cookTimeMinutes: number|null, cookTimeConfidence: number, model: null, tokenUsage: null }|null}
 */
export function normalizeEstimatePayload(body) {
  if (!body || typeof body !== 'object') return null
  const prepTimeMinutes = clampMinutes(body.prepTimeMinutes)
  const cookTimeMinutes = clampMinutes(body.cookTimeMinutes)
  let prepTimeConfidence = clampConfidence(body.prepTimeConfidence)
  let cookTimeConfidence = clampConfidence(body.cookTimeConfidence)
  if (prepTimeConfidence == null) prepTimeConfidence = 0
  if (cookTimeConfidence == null) cookTimeConfidence = 0
  return {
    prepTimeMinutes,
    prepTimeConfidence,
    cookTimeMinutes,
    cookTimeConfidence,
    model: null,
    tokenUsage: null,
  }
}

/**
 * Build LLM input payload from a full recipe (e.g. getRecipeById).
 * @param {object} recipe
 */
export function buildTimeEstimateInput(recipe) {
  const ingredients = Array.isArray(recipe.ingredients)
    ? recipe.ingredients.map((ing) => ({
        text:
          [ing.amount, ing.unit, ing.ingredient ?? ing.name].filter((x) => x != null && String(x).trim() !== '').join(' ') ||
          ing.original_text ||
          '',
      }))
    : []
  const steps = Array.isArray(recipe.recipe_steps)
    ? recipe.recipe_steps.map((s) => ({ text: s.instruction ?? '' }))
    : []

  return {
    existingPrepTimeMinutes: recipe.prep_time_min != null ? Number(recipe.prep_time_min) : null,
    existingCookTimeMinutes: recipe.cook_time_min != null ? Number(recipe.cook_time_min) : null,
    ingredients,
    steps,
  }
}

/**
 * @param {object} recipe – full recipe row from getRecipeById
 * @returns {Promise<{ prepTimeMinutes: number|null, prepTimeConfidence: number, cookTimeMinutes: number|null, cookTimeConfidence: number, model: string, tokenUsage: object|null }>}
 */
export async function estimateRecipePrepCookTimes(recipe) {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY is not set')
  }

  const input = buildTimeEstimateInput(recipe)
  const client = new OpenAI({ apiKey })
  const model = process.env.OPENAI_TIME_ESTIMATE_MODEL || DEFAULT_MODEL

  const response = await client.chat.completions.create({
    model,
    temperature: TEMPERATURE,
    messages: [
      { role: 'system', content: TIME_ESTIMATE_PROMPT },
      {
        role: 'user',
        content: `Input JSON:\n${JSON.stringify(input)}`,
      },
    ],
    response_format: {
      type: 'json_schema',
      json_schema: {
        name: 'recipe_time_estimate',
        strict: true,
        schema: TIME_ESTIMATE_JSON_SCHEMA,
      },
    },
  })

  const content = response.choices?.[0]?.message?.content
  if (!content) {
    throw new Error('No content returned from model')
  }

  let parsed
  try {
    parsed = JSON.parse(content)
  } catch (e) {
    throw new Error('Invalid JSON from model')
  }

  const prepTimeMinutes = clampMinutes(parsed.prepTimeMinutes)
  const cookTimeMinutes = clampMinutes(parsed.cookTimeMinutes)
  const prepTimeConfidence = clampConfidence(parsed.prepTimeConfidence)
  const cookTimeConfidence = clampConfidence(parsed.cookTimeConfidence)

  if (prepTimeConfidence == null || cookTimeConfidence == null) {
    throw new Error('Could not normalize model output')
  }

  const tokenUsage = response.usage
    ? {
        prompt_tokens: response.usage.prompt_tokens,
        completion_tokens: response.usage.completion_tokens,
        total_tokens: response.usage.total_tokens,
      }
    : null

  return {
    prepTimeMinutes,
    prepTimeConfidence,
    cookTimeMinutes,
    cookTimeConfidence,
    model,
    tokenUsage,
  }
}
