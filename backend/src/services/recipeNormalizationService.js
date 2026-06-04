/**
 * LLM normalization for raw URL-scraped recipes (recipeUrlExtractService output).
 * Pure transformation: no DB, no nutrition. Uses same JSON shape as vision extract (RECIPE_JSON_SCHEMA).
 */

import OpenAI from 'openai'
import { RECIPE_JSON_SCHEMA } from './extractRecipeService.js'
import { formatCategoryListForPrompt } from '../constants/ingredientCategories.js'
import {
  rawRecipeContainsCup,
  formatCupGramReferencesForPrompt,
} from './cupGramReferenceService.js'

const PRIMARY_MODEL = process.env.OPENAI_NORMALIZE_MODEL_PRIMARY || 'gpt-4o-mini'
const TEMPERATURE = Math.min(0.3, Math.max(0, Number(process.env.OPENAI_NORMALIZE_TEMPERATURE) || 0.2))

/** User-requested instructions; schema uses `amount` / `amountMax` (not amountMin). */
function buildNormalizationPrompt({ includeCupReferences = false } = {}) {
  const cupSection = includeCupReferences ? formatCupGramReferencesForPrompt() : ''
  return `
You transform scraped recipe data into structured recipe JSON following the provided JSON schema.

Return JSON only. No markdown, comments, or code fences.

Input context:
- Data comes from a web scraper.
- It may be incomplete, inconsistent, mixed-language, or partially duplicated.
- Prefer structured data. Use original text only as fallback/context.

Tasks:
- Clean and structure the recipe.
- Normalize ingredient lines.
- Do not invent ingredients or steps.
- If unclear, stay close to the original.
- When rules conflict, preserve original meaning and avoid unsafe conversions over aggressive normalization.

Translation:
- Translate recipe.description to German.
- Translate ingredients to German:
  - ingredient
  - additionalInfo
- Translate steps to German.
- Do not translate recipe.title.
- Do not translate originalText.

Translation style:
- Use natural German recipe language for home cooks.
- Use informal "du" only when directly addressing the cook.
- Do not use formal "Sie".
- Preserve meaning and cooking intent.
- Do not translate word-for-word if it sounds unnatural.
- It is okay if German text becomes longer for clarity.
- Keep concise, but not at the cost of awkward wording.
- Avoid literal translations of English food terms when they sound awkward.
- Translate cooking terms contextually, e.g. "broil" as "kurz unter dem Grill bräunen", or similar when appropriate.
- For serving/enjoy instructions, use natural German recipe phrasing.
- Do not translate "Enjoy with..." literally as "Genießen mit...".
- Prefer phrases like:
  - "Mit ... servieren."
  - "Zum Servieren ... darübergeben."
  - "Nach Belieben mit ... garnieren."
  - "Nach Belieben noch etwas ... hinzufügen."
- Translate "as desired" naturally as "nach Belieben", not mechanically at the end if another wording sounds better.

Translation example:
"Enjoy with more thyme and flaky salt as desired."
→ "Zum Servieren nach Belieben noch etwas Thymian und Meersalzflocken darübergeben."

Times:
- Set recipe.prepTimeMinutes = null.
- Set recipe.cookTimeMinutes = null.
- Page times are stored separately; do not infer times here.

Ingredient fields follow the provided JSON schema.

Ingredient parsing:
- amountMax equals amount for single values.
- unit is German or null.
- ingredient is a clean German name.
- additionalInfo contains translated preparation notes, alternatives, or modifiers.
- originalText preserves the source line.
- category must be exactly one allowed category.

Allowed categories:
${formatCategoryListForPrompt()}

Categorization:
- Use exactly one category.
- Use only the allowed categories.
- Choose the most practical category from the ingredient name.
- If uncertain, use "other".

Units:
- Translate tsp → TL, tbsp → EL, cup → Tasse if not converted.
- Do not keep English units.
- Do not convert tbsp/tsp/EL/TL to ml.
- Count-based whole ingredients usually keep their count and unit = null.
- Do not use generic units like "piece" or "Stück".
- Use specific culinary count units when they are part of the source and meaningful in German:
  - clove/cloves garlic → Zehe/Zehen Knoblauch
  - pinch/pinches salt/spices → Prise/Prisen
  - sprig/sprigs herbs → Zweig/Zweige
  - handful/handfuls → Handvoll
  - bunch/bunches herbs/greens → Bund
  - slice/slices → Scheibe/Scheiben
- Do not convert these specific culinary count units to grams.
- Do not estimate piece-to-gram conversions for vegetables, fruit, eggs, onions, garlic cloves, herb sprigs, pinches, handfuls, or similar count-based ingredients.

Cup conversion:
- Liquids in cups → ml, usually 1 cup ≈ 240 ml.
- Solid ingredients in cups → grams when plausible.
- Never convert solid ingredients to ml.
- Never use 240 g per cup as a generic fallback for solids.
- Never treat cup volume and gram weight as 1:1.
- Use reasonable gram approximations for common solid ingredients, preferring curated references when available.
- If conversion is highly uncertain or strongly preparation-dependent, keep unit as "Tasse".

${cupSection}

Examples:
- "1/2 red onion" → amount: 0.5, unit: null, ingredient: "rote Zwiebel"
- "2 carrots" → amount: 2, unit: null, ingredient: "Karotten"
- "3 eggs" → amount: 3, unit: null, ingredient: "Eier"
- "2 cloves garlic" → amount: 2, unit: "Zehen", ingredient: "Knoblauch"
- "1 pinch salt" → amount: 1, unit: "Prise", ingredient: "Salz"
- "12 sprigs thyme" → amount: 12, unit: "Zweige", ingredient: "Thymian"
- "1 handful spinach" → amount: 1, unit: "Handvoll", ingredient: "Spinat"
- "1 cup milk" → about 240 ml
- "1 cup jasmine rice" → plausible grams, not 1 g, not generic 240 g
- "1 cup carrots and peas" → plausible grams, not ml
- "1 tbsp oil" → 1 EL
- "1 tsp salt" → 1 TL

Steps:
- Translate to natural German recipe language for home cooks.
- Use informal "du" only when directly addressing the cook.
- Do not use formal "Sie".
- Preserve meaning and cooking intent.
- Do not translate word-for-word if it sounds unnatural.
- Keep order.
- Keep concise, but not at the cost of awkward wording.`
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
  /** Serialized input JSON sent to the model (stored in ai_token_usage.request_json). */
  const userPayload = JSON.stringify(payloadForModel, null, 0)

  const includeCupReferences = rawRecipeContainsCup(rawRecipe)
  const systemPrompt = buildNormalizationPrompt({ includeCupReferences })

  const response = await client.chat.completions.create({
    model,
    temperature: TEMPERATURE,
    messages: [
      { role: 'system', content: systemPrompt },
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
 * Normalize URL-scraped raw recipe via LLM (`OPENAI_NORMALIZE_MODEL_PRIMARY`).
 * @param {object} rawRecipe - Same shape as extractRecipeFromUrl().recipe
 * @returns {Promise<{ recipe: object, usage?: object, model: string, attempts: Array<{ recipe: object, usage?: object, model: string, request_json: string }> }>}
 */
export async function normalizeRecipeWithLLM(rawRecipe) {
  const raw = rawRecipe && typeof rawRecipe === 'object' ? rawRecipe : {}

  const first = await callLLM(raw, PRIMARY_MODEL)
  const attempts = [
    {
      recipe: first.recipe,
      usage: first.usage,
      model: PRIMARY_MODEL,
      request_json: first.request_json,
    },
  ]

  return {
    recipe: first.recipe,
    usage: first.usage,
    model: PRIMARY_MODEL,
    attempts,
  }
}
