/**
 * LLM normalization for raw URL-scraped recipes (recipeUrlExtractService output).
 * Pure transformation: no DB, no nutrition. Uses same JSON shape as vision extract (RECIPE_JSON_SCHEMA).
 */

import OpenAI from 'openai'
import { RECIPE_JSON_SCHEMA } from './extractRecipeService.js'
import { formatCategoryListForPrompt } from '../constants/ingredientCategories.js'

const PRIMARY_MODEL = process.env.OPENAI_NORMALIZE_MODEL_PRIMARY || 'gpt-4o-mini'
const FALLBACK_MODEL = process.env.OPENAI_NORMALIZE_MODEL_FALLBACK || 'gpt-4.1-mini'
const TEMPERATURE = Math.min(0.3, Math.max(0, Number(process.env.OPENAI_NORMALIZE_TEMPERATURE) || 0.2))

/** User-requested instructions; schema uses `amount` / `amountMax` (not amountMin). */
const NORMALIZATION_PROMPT = `You transform raw recipe data into a structured recipe format.

Return only valid JSON.

Context:
The input comes from a web scraper. It may contain inconsistencies, mixed formats, or incomplete data.

Your task:
- Clean and structure the recipe
- Normalize ingredient lines

Unit handling and conversion:

- Translate units to German:
  - tsp → TL
  - tbsp → EL
  - cup → Tasse (if not converted)
- Do not keep English units

- Do not convert:
  - tablespoon / tbsp / EL
  - teaspoon / tsp / TL

- Convert "cup" only when appropriate:
  - Use ml for liquids (water, milk, oil, broth, etc.)
  - Use grams (g) for solid ingredients (rice, flour, sugar, vegetables, grains, legumes, etc.)

- Do not invent gram or ml conversions for count-based ingredients unless there is a strong and common household standard
- If an ingredient is given as a count or fraction, prefer keeping the count instead of converting to grams
- For count-based ingredients, set unit to null
- Do not use generic units like "piece" or "Stück"

Examples of count-based ingredients:
- 1 onion
- 1/2 red onion
- 2 carrots
- 3 eggs
- 1 clove garlic

- Important:
  - Never convert solid ingredients to ml
  - Never convert everything to ml
  - Do not estimate piece-to-gram conversions for vegetables, fruit, eggs, onions, garlic cloves, or similar count-based ingredients
  - If unsure whether an ingredient is solid or liquid, keep the original unit instead of guessing
  - Use plausible household approximations

- Approximation guidance:
  - 1 cup ≈ 240 ml for liquids
  - Use reasonable gram approximations for solids

Sanity checks:

- A cup is a substantial household volume and must never become unrealistically small values like 1 g or 1 ml
- Do not treat cup volume and gram weight as interchangeable 1:1
- Solid ingredients measured in cups should usually be converted to grams, not ml
- Liquid ingredients measured in cups should usually be converted to ml
- Do not convert tbsp / tsp into ml; keep them as EL / TL
- Count-based ingredients should stay count-based unless the source already gives a weight or volume
- Solid ingredients measured in cups should NOT equal 240g for a cup or 120 for half a cup

Examples:

Good:
- "1 cup milk" → about 240 ml
- "1 cup jasmine rice" → a plausible gram value
- "1 cup carrots and peas" → a plausible gram value
- "1 tbsp oil" → 1 EL
- "1 tsp salt" → 1 TL
- "1/2 red onion" → amount: 0.5, unit: null, ingredient: "rote Zwiebel"
- "2 carrots" → amount: 2, unit: null, ingredient: "Karotten"

Bad:
- "1 cup jasmine rice" → 1 g
- "1 cup jasmine rice" → 240 g
- "1 cup carrots and peas" → 240 ml
- "1 tbsp oil" → 15 ml
- "1 tsp salt" → 5 ml
- "1/2 red onion" → 75 g Zwiebel
- "2 carrots" → 150 g Karotten
- "3 eggs" → 180 g Eier
- "1 clove garlic" → 5 g Knoblauch
- "1 onion" → unit: "Stück"

Translation:

- Translate the following fields to German:
  - description
  - ingredients
  - steps

- Do not translate:
  - title
  - originalText

Ingredient categorization:

For each ingredient, assign exactly one category from this list:
${formatCategoryListForPrompt()}

Rules for categorization:
- Use only these categories. Do not invent new ones.
- Choose the most practical category based on the ingredient name.
- Always return exactly one category per ingredient.
- If uncertain, use "other".

Rules:
- Do not invent ingredients or steps
- If something is unclear, keep it close to the original
- Preserve meaning over strict normalization
- If conversion is uncertain, keep the original unit
- Use structured data as the primary source
- Use original text only as fallback context

Ingredient parsing:

Extract:
- amount
- amountMax (use a range if needed; amountMax equals amount for single values)
- unit (translated to German, or null for count-based ingredients)
- ingredient (clean German name)
- additionalInfo (translated, includes preparation or alternatives)
- originalText
- category (one of the allowed categories above)

Steps:
- Keep order
- Keep concise

Return JSON only. No markdown, no explanations, no code fences.`

function collectIngredientItems(parsed) {
  const inner = parsed?.recipe
  if (!inner?.ingredientsSections || !Array.isArray(inner.ingredientsSections)) return []
  const items = []
  for (const sec of inner.ingredientsSections) {
    if (sec?.items && Array.isArray(sec.items)) items.push(...sec.items)
  }
  return items
}

/**
 * Heuristic quality check for retry with fallback model.
 * @param {object} result - Parsed LLM output { status, confidence, warnings, missingFields, recipe }
 * @param {object} raw - RawRecipeFromUrl shape from recipeUrlExtractService
 * @returns {boolean}
 */
export function isLowQuality(result, raw) {
  if (!result || typeof result !== 'object') return true
  const inner = result.recipe
  if (result.status === 'failed' || inner == null) return true

  const items = collectIngredientItems(result)
  const steps = Array.isArray(inner.steps) ? inner.steps : []

  if (items.length === 0) return true
  if (steps.length === 0) return true

  const nullIngredientCount = items.filter((i) => {
    if (!i || i.ingredient == null) return true
    return String(i.ingredient).trim() === ''
  }).length
  if (items.length > 0 && nullIngredientCount / items.length > 0.4) return true

  const rawHasServings = raw?.servings_raw != null && String(raw.servings_raw).trim() !== ''
  const servings = inner.servings
  const servingsEmpty =
    servings == null ||
    (servings.value == null &&
      (servings.unitText == null || String(servings.unitText).trim() === ''))
  if (rawHasServings && servingsEmpty) return true

  let nullFields = 0
  let totalFields = 0
  for (const it of items) {
    for (const k of ['amount', 'amountMax', 'unit', 'ingredient', 'originalText']) {
      totalFields += 1
      const v = it?.[k]
      if (v == null || (typeof v === 'string' && v.trim() === '')) nullFields += 1
    }
  }
  if (totalFields > 0 && nullFields / totalFields > 0.55) return true

  return false
}

/**
 * @param {object} rawRecipe - RawRecipeFromUrl (title, description, ingredient_lines, steps, …)
 * @param {string} model
 * @returns {Promise<{ recipe: object, usage?: { prompt_tokens: number, completion_tokens: number, total_tokens: number }, request_json: string }>}
 */
async function callLLM(rawRecipe, model) {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) throw new Error('OPENAI_API_KEY is not set')

  const client = new OpenAI({ apiKey })
  // Do not send time fields or image URLs to the model (they are stored directly on the recipe row).
  const payloadForModel = {
    title: rawRecipe?.title ?? null,
    description: rawRecipe?.description ?? null,
    servings_raw: rawRecipe?.servings_raw ?? null,
    ingredient_lines: Array.isArray(rawRecipe?.ingredient_lines) ? rawRecipe.ingredient_lines : [],
    steps: Array.isArray(rawRecipe?.steps) ? rawRecipe.steps : [],
  }
  /** Serialized input JSON sent to the model (stored in extract_usage.request_json). */
  const userPayload = JSON.stringify(payloadForModel, null, 0)

  const response = await client.chat.completions.create({
    model,
    temperature: TEMPERATURE,
    messages: [
      { role: 'system', content: NORMALIZATION_PROMPT },
      {
        role: 'user',
        content: `Raw recipe JSON (from web scraper):\n${userPayload}\n\nReturn valid JSON matching the recipe extraction schema exactly.`,
      },
    ],
    response_format: {
      type: 'json_schema',
      json_schema: {
        name: 'recipe_normalize',
        strict: true,
        schema: RECIPE_JSON_SCHEMA,
      },
    },
  })

  const choice = response.choices?.[0]
  if (!choice?.message?.content) throw new Error('No content in OpenAI response')
  const recipe = JSON.parse(choice.message.content)
  const usage = response.usage
    ? {
        prompt_tokens: response.usage.prompt_tokens,
        completion_tokens: response.usage.completion_tokens,
        total_tokens: response.usage.total_tokens,
      }
    : undefined
  return { recipe, usage, request_json: userPayload }
}

/**
 * Normalize URL-scraped raw recipe via LLM (primary model, optional fallback).
 * @param {object} rawRecipe - Same shape as extractRecipeFromUrl().recipe
 * @returns {Promise<{ recipe: object, usage?: object, model: string, attempts: Array<{ recipe: object, usage?: object, model: string, request_json: string }> }>}
 */
export async function normalizeRecipeWithLLM(rawRecipe) {
  const raw = rawRecipe && typeof rawRecipe === 'object' ? rawRecipe : {}

  const attempts = []
  const first = await callLLM(raw, PRIMARY_MODEL)
  let { recipe, usage } = first
  attempts.push({ recipe: first.recipe, usage: first.usage, model: PRIMARY_MODEL, request_json: first.request_json })

  if (isLowQuality(recipe, raw)) {
    const second = await callLLM(raw, FALLBACK_MODEL)
    recipe = second.recipe
    usage = second.usage
    attempts.push({
      recipe: second.recipe,
      usage: second.usage,
      model: FALLBACK_MODEL,
      request_json: second.request_json,
    })
  }

  const last = attempts[attempts.length - 1]
  return { recipe: last.recipe, usage: last.usage, model: last.model, attempts }
}
