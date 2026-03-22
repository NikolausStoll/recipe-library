/**
 * AI recipe tagging from structured recipe data only (no OCR/URL extraction here).
 */

import OpenAI from 'openai'
import { ALL_ALLOWED_TAGS } from '../constants/recipeTags.js'
import { sanitizeRecipeTags } from './recipeTagValidation.js'

const DEFAULT_MODEL = process.env.OPENAI_RECIPE_TAG_MODEL || 'gpt-4o-mini'
const TEMPERATURE = Math.min(0.3, Math.max(0, Number(process.env.OPENAI_RECIPE_TAG_TEMPERATURE) || 0.2))

const TAG_PROMPT = `Select tags for this recipe.

Return only valid JSON.

Context:
The input is a structured recipe with title, ingredients, and optional additional data.

Your task:
- Assign relevant tags to the recipe
- Choose only from the allowed tags
- Follow the group rules strictly
- Prefer fewer, high-quality tags over many weak ones

Rules:

You must select:
- Exactly 1 meal type

You may select:
- Up to 1 cuisine
- 1 to 2 dish types
- Up to 1 diet tag
- Up to 2 context tags

Do not invent tags.
Use only the allowed tags.

If uncertain, choose the most practical and common-sense option.
If nothing fits well, use "other" (only for cuisine).

---

Meal type (choose exactly 1):
- breakfast
- lunch
- dinner
- snack
- dessert

---

Cuisine (max 1):
- italian
- asian
- american
- mediterranean
- greek
- spanish
- french
- mexican
- scandinavian
- middle_eastern
- other

---

Dish type (1–2):
- pasta
- ramen
- soup
- salad
- burger
- sandwich
- bread
- baked
- dessert
- breakfast
- main
- side
- drink

---

Diet (max 1):
- vegetarian
- vegan
- meat
- fish

---

Context (max 2):
- quick
- easy
- comfort_food
- family

---

Examples:

- Pancakes → breakfast, sweet → breakfast + breakfast
- Tiramisu → dessert → dessert + dessert
- Spaghetti Bolognese → dinner, pasta → dinner + pasta + italian + meat
- Smoothie → breakfast, drink → breakfast + drink
- Shepherd’s Pie → dinner, baked → dinner + baked + main
- Sandwich → lunch → lunch + sandwich
- Salad with chicken → lunch → lunch + salad + meat

---

Output shape:
{ "tags": string[] }`

const TAG_JSON_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['tags'],
  properties: {
    tags: {
      type: 'array',
      items: { type: 'string', enum: ALL_ALLOWED_TAGS },
    },
  },
}

/**
 * Minimal payload for the model (no raw URLs, no full book text).
 * @param {object} recipe – e.g. getRecipeById result
 */
export function buildRecipeTaggingPayload(recipe) {
  const ingredients = Array.isArray(recipe.ingredients)
    ? recipe.ingredients.map((ing) => ({
        line:
          [ing.amount, ing.unit, ing.ingredient ?? ing.name].filter((x) => x != null && String(x).trim() !== '').join(' ') ||
          ing.original_text ||
          '',
        category: ing.category ?? null,
      }))
    : []
  const steps = Array.isArray(recipe.recipe_steps)
    ? recipe.recipe_steps.map((s) => ({ text: s.instruction ?? '' }))
    : []
  const tips = Array.isArray(recipe.tips) ? recipe.tips : []

  return {
    title: recipe.title ?? '',
    subtitle: recipe.subtitle ?? null,
    language: recipe.language ?? null,
    description: recipe.description ? String(recipe.description).slice(0, 2000) : null,
    prep_time_min: recipe.prep_time_min ?? null,
    cook_time_min: recipe.cook_time_min ?? null,
    servings: recipe.servings_value ?? recipe.servings ?? null,
    servings_unit: recipe.servings_unit_text ?? null,
    ingredients,
    steps,
    tips,
  }
}

/**
 * @param {object} recipe – full recipe from getRecipeById
 * @returns {Promise<{ tags: string[], warnings: string[], fallbacks: object, model: string|null, tokenUsage: object|null, requestPayload: object, rawTags: unknown[] }>}
 */
export async function generateRecipeTags(recipe) {
  const title = recipe?.title != null ? String(recipe.title) : ''
  const requestPayload = buildRecipeTaggingPayload(recipe)
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    const sanitized = sanitizeRecipeTags([], { title })
    return {
      tags: sanitized.tags,
      warnings: [...sanitized.warnings, 'OPENAI_API_KEY is not set'],
      fallbacks: sanitized.fallbacks,
      model: null,
      tokenUsage: null,
      requestPayload,
      rawTags: [],
    }
  }

  try {
    const client = new OpenAI({ apiKey })
    const model = process.env.OPENAI_RECIPE_TAG_MODEL || DEFAULT_MODEL

    const response = await client.chat.completions.create({
      model,
      temperature: TEMPERATURE,
      messages: [
        { role: 'system', content: TAG_PROMPT },
        {
          role: 'user',
          content: `Recipe JSON:\n${JSON.stringify(requestPayload)}`,
        },
      ],
      response_format: {
        type: 'json_schema',
        json_schema: {
          name: 'recipe_tags',
          strict: true,
          schema: TAG_JSON_SCHEMA,
        },
      },
    })

    const content = response.choices?.[0]?.message?.content
    const tokenUsage = response.usage
      ? {
          prompt_tokens: response.usage.prompt_tokens,
          completion_tokens: response.usage.completion_tokens,
          total_tokens: response.usage.total_tokens,
        }
      : null

    if (!content) {
      const sanitized = sanitizeRecipeTags([], { title })
      return {
        tags: sanitized.tags,
        warnings: [...sanitized.warnings, 'No content returned from model'],
        fallbacks: sanitized.fallbacks,
        model,
        tokenUsage,
        requestPayload,
        rawTags: [],
      }
    }

    let parsed
    try {
      parsed = JSON.parse(content)
    } catch {
      const sanitized = sanitizeRecipeTags([], { title })
      return {
        tags: sanitized.tags,
        warnings: [...sanitized.warnings, 'Invalid JSON from model'],
        fallbacks: sanitized.fallbacks,
        model,
        tokenUsage,
        requestPayload,
        rawTags: [],
      }
    }

    const rawTags = Array.isArray(parsed?.tags) ? parsed.tags : []
    const sanitized = sanitizeRecipeTags(rawTags, { title })
    return {
      tags: sanitized.tags,
      warnings: sanitized.warnings,
      fallbacks: sanitized.fallbacks,
      model,
      tokenUsage,
      requestPayload,
      rawTags,
    }
  } catch (e) {
    console.error('generateRecipeTags failed:', e)
    const sanitized = sanitizeRecipeTags([], { title })
    return {
      tags: sanitized.tags,
      warnings: [
        ...sanitized.warnings,
        e instanceof Error ? e.message : 'Tag generation failed',
      ],
      fallbacks: sanitized.fallbacks,
      model: null,
      tokenUsage: null,
      requestPayload,
      rawTags: [],
    }
  }
}
