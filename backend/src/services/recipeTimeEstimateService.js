/**
 * OpenAI estimate for prep and cook times (separate from vision extract / URL normalize).
 */

import OpenAI from 'openai'

const DEFAULT_MODEL = process.env.OPENAI_TIME_ESTIMATE_MODEL || 'gpt-4o-mini'
const TEMPERATURE = Math.min(0.3, Math.max(0, Number(process.env.OPENAI_TIME_ESTIMATE_TEMPERATURE) || 0.2))

const TIME_ESTIMATE_PROMPT = `You estimate realistic preparation and cooking times for a recipe.

Return only valid JSON.

Context:
The recipe may already contain time values, but you should always provide your own practical estimate.
These estimates are used as editable default values in the app.

Rules:
- Always estimate prepTimeMinutes and cookTimeMinutes
- Do not copy existing values blindly
- Use the recipe data to make a realistic estimate
- Assume a home cook / amateur cook, not a professional chef
- Do not assume unusually fast knife skills or kitchen speed
- Be realistic about repetitive prep work (for example peeling, chopping, washing, grating, mixing)

Guidelines:
- prepTime = active work such as washing, peeling, cutting, measuring, mixing, shaping, frying, assembling
- cookTime = mostly passive time such as baking, simmering, boiling, resting, chilling
- If a recipe includes a large amount of ingredients or labor-intensive prep, increase prep time accordingly
- Do not underestimate prep time for bulky ingredients
- Example: peeling and preparing 1 kg of potatoes takes several minutes, not 1 minute
- Use practical household estimates, not idealized best-case timing
- Be pragmatic, not overly precise

Output must match the JSON schema exactly (prepTimeConfidence and cookTimeConfidence between 0 and 1).`

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
