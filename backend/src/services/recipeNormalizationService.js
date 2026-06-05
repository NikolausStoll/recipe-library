/**
 * LLM normalization for raw URL-scraped recipes (recipeUrlExtractService output).
 * Pure transformation: no DB, no nutrition. Uses same JSON shape as vision extract (RECIPE_JSON_SCHEMA).
 */

import OpenAI from 'openai'
import { RECIPE_JSON_SCHEMA } from './extractRecipeService.js'
import { formatCategoryListForPrompt } from '../constants/ingredientCategories.js'
import { buildOpenAiChatTemperature } from '../utils/openaiChatParams.js'
// Cup-to-gram conversion moved to cupConversionService (post-normalization stage).
// TODO: Remove the "Cup conversion:" prompt block below once normalization prompt is updated.

const PRIMARY_MODEL = process.env.OPENAI_NORMALIZE_MODEL_PRIMARY || 'gpt-4o-mini'
const TEMPERATURE = Math.min(0.3, Math.max(0, Number(process.env.OPENAI_NORMALIZE_TEMPERATURE) || 0.2))

/** User-requested instructions; schema uses `amount` / `amountMax` (not amountMin). */
function buildNormalizationPrompt() {
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
- For single amounts, amountMax must equal amount. Do not use null for amountMax unless amount itself is null.
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
- Translate tsp → TL.
- Translate tbsp → EL.
- Keep cup/cups as unit "cup".
- Do not translate cup/cups to "Tasse".
- Do not convert cup/cups to grams or milliliters.
- Never convert tbsp/tsp/EL/TL to grams or ml.
- tablespoon/tbsp always becomes unit: "EL" with the same amount.
- teaspoon/tsp always becomes unit: "TL" with the same amount.
- Do not convert small spoon amounts like tahini, dijon, salt, garlic powder, oil, vinegar, spices, or similar into grams/ml.
- Count-based whole ingredients usually keep their count and unit = null.
- Do not use generic units like "piece" or "Stück".
- Use specific culinary count units when they are part of the source and meaningful in German:
  - clove/cloves garlic → Zehe/Zehen Knoblauch
  - pinch/pinches salt/spices → Prise/Prisen
  - dash/dashes spices/seasoning → Prise/Prisen, if appropriate
  - sprig/sprigs herbs → Zweig/Zweige
  - handful/handfuls → Handvoll
  - bunch/bunches herbs/greens → Bund
  - slice/slices → Scheibe/Scheiben
- Use "Handvoll" only when the source explicitly says handful/handfuls.
- Do not convert these specific culinary count units to grams.
- Do not estimate piece-to-gram conversions for vegetables, fruit, eggs, onions, garlic cloves, herb sprigs, pinches, handfuls, or similar count-based ingredients.

Cup handling:
- This normalization step must not convert cup-based ingredients.
- Keep cup amounts as cup.
- Keep cup ranges as cup ranges.
- Do not estimate grams or ml for cup ingredients in this step.
- Cup conversion is handled by a separate pipeline step after normalization.

Examples:
- "1/2 red onion" → amount: 0.5, amountMax: 0.5, unit: null, ingredient: "rote Zwiebel"
- "2 carrots" → amount: 2, amountMax: 2, unit: null, ingredient: "Karotten"
- "3 eggs" → amount: 3, amountMax: 3, unit: null, ingredient: "Eier"
- "2 cloves garlic" → amount: 2, amountMax: 2, unit: "Zehen", ingredient: "Knoblauch"
- "1 pinch salt" → amount: 1, amountMax: 1, unit: "Prise", ingredient: "Salz"
- "dash of pepper" → amount: 1, amountMax: 1, unit: "Prise", ingredient: "Pfeffer"
- "12 sprigs thyme" → amount: 12, amountMax: 12, unit: "Zweige", ingredient: "Thymian"
- "1 handful spinach" → amount: 1, amountMax: 1, unit: "Handvoll", ingredient: "Spinat"
- "1 cup milk" → amount: 1, amountMax: 1, unit: "cup", ingredient: "Milch"
- "1/4 cup olive oil" → amount: 0.25, amountMax: 0.25, unit: "cup", ingredient: "Olivenöl"
- "3 cups tortellini (cooked)" → amount: 3, amountMax: 3, unit: "cup", ingredient: "Tortellini", additionalInfo: "gekocht"
- "1-2 cups sweet potato (roasted)" → amount: 1, amountMax: 2, unit: "cup", ingredient: "Süßkartoffel", additionalInfo: "geröstet"
- "1 tbsp tahini" → amount: 1, amountMax: 1, unit: "EL", ingredient: "Tahini"; do not convert to grams
- "1 tsp dijon" → amount: 1, amountMax: 1, unit: "TL", ingredient: "Dijon-Senf"; do not convert to grams
- "1 tsp salt" → amount: 1, amountMax: 1, unit: "TL", ingredient: "Salz"; do not convert to grams

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

  const systemPrompt = buildNormalizationPrompt()

  const response = await client.chat.completions.create({
    model,
    ...buildOpenAiChatTemperature(model, TEMPERATURE),
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
