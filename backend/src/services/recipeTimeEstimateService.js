/**
 * OpenAI estimate for prep and cook times (separate from vision extract / URL normalize).
 */

import OpenAI from 'openai'

const DEFAULT_MODEL = process.env.OPENAI_TIME_ESTIMATE_MODEL || 'gpt-4o-mini'
const TEMPERATURE = Math.min(0.3, Math.max(0, Number(process.env.OPENAI_TIME_ESTIMATE_TEMPERATURE) || 0.2))

const TIME_ESTIMATE_PROMPT = `
You estimate practical preparation and cooking times for a recipe.

Return only valid JSON matching the provided JSON schema.

Context:
The recipe may contain existing time values from the source, but source times are often optimistic. Use them only as weak hints. Always provide your own practical household estimate.

Goal:
Estimate times for a normal home cook, not a professional chef.
The result is an editable default in a recipe app, so prefer stable, practical estimates over optimistic recipe-site times.

Definitions:
- prepTimeMinutes = active work before and during cooking:
  washing, peeling, cutting, slicing, chopping, grating, measuring, mixing, seasoning, shaping, assembling, coating, filling pans, preparing sauces, cleaning herbs.
- cookTimeMinutes = mostly passive elapsed cooking/resting time:
  baking, roasting, simmering, boiling, steaming, chilling, resting, marinating, pressure cooking.
- If active work happens while something cooks, count the active work as prepTime and the elapsed heat time as cookTime. Do not double-count the same minutes unless the recipe clearly requires separate active and passive phases.

Estimation method:
Use this fixed approach.

1. Identify explicit cooking durations from steps.
- Add oven/stovetop/simmer/bake/rest/chill durations to cookTimeMinutes.
- For ranges, use the midpoint rounded to the nearest 5 minutes.
  Example: 20 to 25 minutes → 25 minutes.
- If multiple cooking phases happen sequentially, add them.
- If phases clearly happen in parallel, use the longer phase instead of adding both.

2. Estimate prep work from ingredients and steps.
Start with a base prep time:
- very simple recipe: 5 minutes
- normal recipe: 10 minutes
- many ingredients or several prep actions: 15 minutes
- labor-intensive recipe: 20+ minutes

Then adjust using this rubric:
- washing/peeling/cutting 1–3 vegetables: +5 minutes
- washing/peeling/cutting 4–6 vegetables: +10 minutes
- washing/peeling/cutting many/bulky vegetables: +15 minutes
- finely chopping/mincing herbs, garlic, onion, or aromatics: +3 to 8 minutes
- grating/shredding/slicing with care: +5 to 15 minutes
- very thin slicing, mandoline work, stuffing, rolling, stacking, shaping, assembling individual portions: +10 to 20 minutes
- mixing a simple sauce/dressing/oil: +3 to 5 minutes
- preparing multiple bowls/components: +5 to 10 minutes
- handling many small repeated items, e.g. muffin cups, stacks, dumplings, cookies: +10 to 20 minutes
- opening cans/jars or measuring pantry items: usually +1 to 3 minutes total, not each

3. Apply practical minimums.
- A recipe with multiple fresh ingredients is rarely under 10 minutes prep.
- A recipe with peeling/slicing/chopping is rarely under 15 minutes prep.
- A recipe with many repeated assemblies is rarely under 20 minutes prep.
- Do not output 5 minutes prep unless the recipe is truly minimal.

4. Round consistently.
- Round prepTimeMinutes and cookTimeMinutes to the nearest 5 minutes.
- Minimum non-zero time is 5 minutes.
- Prefer stable rounded values like 10, 15, 20, 25, 30, 35, 40, 45.
- Do not output overly precise values like 13 or 27.

5. Confidence.
- prepTimeConfidence:
  - 0.8–0.95 if ingredients and prep steps are clear
  - 0.6–0.8 if some prep is ambiguous
  - 0.4–0.6 if the recipe is sparse or unclear
- cookTimeConfidence:
  - 0.85–0.95 if explicit cook durations are present
  - 0.6–0.8 if cooking method is clear but duration is missing
  - 0.4–0.6 if cooking is unclear

Important:
- Do not copy existing source times blindly.
- Do not assume unusually fast knife skills.
- Do not underestimate repetitive prep.
- Be realistic, but not exaggerated.
- If unsure, choose the more practical household estimate.`

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
