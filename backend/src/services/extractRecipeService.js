/**
 * Extract structured recipe from one or more recipe-text images using OpenAI vision.
 * Uses a fixed prompt and JSON schema; logs token usage to extract_usage table.
 */

import OpenAI from 'openai'
import { getDb } from '../db/index.js'
import {
  formatCategoryListForPrompt,
  CANONICAL_INGREDIENT_CATEGORY_ENUM,
} from '../constants/ingredientCategories.js'

export const EXTRACT_PROMPT = `You are a recipe extractor. The user will provide one or more images containing recipe text.

Rules:
- Extract only information that is actually visible in the image.
- Do not guess missing or unclear values when extracting visible data.
- If a value is not clearly visible, use null.
- If something is missing, cut off, or uncertain, add an entry to warnings and/or missingFields.

- Keep ingredient names clean and normalized, but preserve the visible ingredient line in originalText.
- Put preparation notes, alternatives, ranges, and qualifiers into additionalInfo.

- Ingredient section headings may contain serving information.
- If a heading includes serving or people information, extract that information into recipe.servings as well.
- Preserve the visible heading text in ingredientsSections.heading.

- Use amount as the lower value and amountMax as the upper value for ranges.
- For exact amounts, set amountMax equal to amount.

- Keep step texts concise but faithful to the visible text.
- Group closely related actions into one step when they belong to the same preparation phase and happen consecutively.
- Do not create a separate step for every single verb.
- Prefer fewer, more useful cooking steps over overly atomic action splitting.
- Split steps only when there is a meaningful change in phase, tool, vessel, timing, or cooking process.
- Keep ingredient prep for the same component together in one step where reasonable.
- A step should represent a practical unit a cook would perform, not a grammatical clause.

- Do not invent metadata that must come directly from the image (e.g. servings, times, titles).

- Extract tips, hints, or variations into the tips array if they are clearly separate from steps or introText.

Ingredient categorization:

For each ingredient, assign exactly one category from this list:
${formatCategoryListForPrompt()}

Rules for categorization:
- Use only these categories. Do not invent new ones.
- Choose the most practical category based on the ingredient name.
- Always return exactly one category per ingredient.
- If uncertain, use "other".

- If extraction is only partly reliable, set status to "partial".
- If almost nothing reliable can be extracted, set status to "failed" and recipe to null.

- Confidence must be a number between 0 and 1 representing overall extraction quality.

- Return JSON only. No markdown, no explanations, no code fences.

Use the exact keys above. If the image has multiple pages, merge the content into one coherent recipe. Preserve the original language of the recipe.`

export const RECIPE_JSON_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['status', 'confidence', 'warnings', 'missingFields', 'recipe'],
  properties: {
    status: { type: 'string', enum: ['success', 'partial', 'failed'], description: 'Overall extraction result' },
    confidence: { type: 'number', minimum: 0, maximum: 1, description: 'Overall extraction confidence' },
    warnings: { type: 'array', items: { type: 'string' }, description: 'Uncertainties or extraction problems' },
    missingFields: { type: 'array', items: { type: 'string' }, description: 'Fields that are missing, unclear, or not visible' },

    recipe: {
      type: ['object', 'null'],
      additionalProperties: false,
      required: ['title', 'subtitle', 'introText', 'language', 'servings', 'ingredientsSections', 'steps', 'tips'],
      properties: {
        title: { type: ['string', 'null'] },
        subtitle: { type: ['string', 'null'] },
        introText: { type: ['string', 'null'] },
        language: { type: ['string', 'null'] },

        servings: {
          type: ['object', 'null'],
          additionalProperties: false,
          required: ['value', 'unitText'],
          properties: {
            value: { type: ['number', 'null'] },
            unitText: { type: ['string', 'null'] },
          },
        },

        ingredientsSections: {
          type: 'array',
          items: {
            type: 'object',
            additionalProperties: false,
            required: ['heading', 'items'],
            properties: {
              heading: { type: ['string', 'null'] },
              items: {
                type: 'array',
                items: {
                  type: 'object',
                  additionalProperties: false,
                  required: ['originalText', 'amount', 'amountMax', 'unit', 'ingredient', 'additionalInfo', 'category'],
                  properties: {
                    originalText: { type: ['string', 'null'] },
                    amount: { type: ['number', 'null'] },
                    amountMax: { type: ['number', 'null'] },
                    unit: { type: ['string', 'null'], description: 'Unit of the ingredient, e.g. "g", "ml", "pcs", "pinch".' },
                    ingredient: { type: ['string', 'null'] },
                    additionalInfo: { type: ['string', 'null'] },
                    category: { type: ['string', 'null'], enum: CANONICAL_INGREDIENT_CATEGORY_ENUM },
                  },
                },
              },
            },
          },
        },

        steps: {
          type: 'array',
          items: {
            type: 'object',
            additionalProperties: false,
            required: ['index', 'text'],
            properties: {
              index: { type: 'integer', minimum: 1 },
              text: { type: ['string', 'null'] },
            },
          },
        },

        tips: {
          type: 'array',
          items: { type: 'string' },
          description: 'Tips, notes, variations, or cooking advice not part of steps',
        },
      },
    },
  },
}

/**
 * @param {Buffer[]} imageBuffers - One or more images (recipe text)
 * @returns {Promise<{ recipe: { status: string, confidence: number, warnings: string[], missingFields: string[], recipe: object|null }, usage?: { prompt_tokens: number, completion_tokens: number, total_tokens: number } }>}
 */
export async function extractRecipeFromImages(imageBuffers) {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) throw new Error('OPENAI_API_KEY is not set')

  const client = new OpenAI({ apiKey })
  const imageContents = imageBuffers.map((buf) => ({
    type: 'image_url',
    image_url: { 
      url: `data:image/webp;base64,${buf.toString('base64')}`, 
      detail: process.env.OPENAI_EXTRACT_DETAIL || 'high'
    },
  }))

  const response = await client.chat.completions.create({
    model: process.env.OPENAI_EXTRACT_MODEL || 'gpt-4.1-mini',
    messages: [
      { role: 'system', content: EXTRACT_PROMPT },
      {
        role: 'user',
        content: [
          { type: 'text', text: 'Extract the recipe from the following image(s). Return valid JSON matching the schema.' },
          ...imageContents,
        ],
      },
    ],
    response_format: {
      type: 'json_schema',
      json_schema: {
        name: 'recipe',
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
  return { recipe, usage }
}

/**
 * Log token usage and optional full JSON response for an extract run to extract_usage table (for debugging).
 * @param {number|null|undefined} recipeId
 * @param {{ prompt_tokens?: number, completion_tokens?: number, total_tokens?: number }|null|undefined} usage
 * @param {unknown} responseJson
 * @param {{ model?: string|null, extract_kind?: string|null, request_json?: string|null }} [meta] - request_json: input JSON sent to the model (URL normalize); null for vision
 */
export function logExtractUsage(recipeId, usage, responseJson = null, meta = {}) {
  if (!usage && !responseJson) return
  const db = getDb()
  const now = new Date().toISOString().slice(0, 19).replace('T', ' ')
  const responseStr = responseJson != null ? (typeof responseJson === 'string' ? responseJson : JSON.stringify(responseJson)) : null
  const requestStr =
    meta.request_json != null && String(meta.request_json).trim() !== ''
      ? typeof meta.request_json === 'string'
        ? meta.request_json
        : JSON.stringify(meta.request_json)
      : null
  const model = meta.model != null ? String(meta.model) : null
  const extract_kind = meta.extract_kind != null ? String(meta.extract_kind) : null
  db.prepare(`
    INSERT INTO extract_usage (recipe_id, prompt_tokens, completion_tokens, total_tokens, response_json, request_json, model, extract_kind, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    recipeId,
    usage?.prompt_tokens ?? null,
    usage?.completion_tokens ?? null,
    usage?.total_tokens ?? null,
    responseStr,
    requestStr,
    model,
    extract_kind,
    now
  )
}
