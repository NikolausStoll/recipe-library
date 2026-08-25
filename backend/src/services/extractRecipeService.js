/**
 * Extract structured recipe from one or more recipe-text images using OpenAI vision.
 * Uses a fixed prompt and JSON schema; logs token usage to ai_token_usage table.
 */

import OpenAI from 'openai'
import { getDb } from '../db/index.js'
import {
  formatCategoryListForPrompt,
  CANONICAL_INGREDIENT_CATEGORY_ENUM,
} from '../constants/ingredientCategories.js'
import { buildIngredientParsingPromptBlock } from '../constants/ingredientParsingPrompt.js'

const EXTRACT_PROMPT_BODY = `You are a recipe extractor. The user will provide one or more images containing recipe text.

Rules:
- Extract only information that is actually visible in the image.
- Do not guess missing or unclear values when extracting visible data.
- If a value is not clearly visible, use null.
- If something is missing, cut off, or uncertain, add an entry to warnings and/or missingFields.

Extraction fidelity:
- Treat the image as the source of truth.
- Extract visible recipe text as faithfully as possible.
- Do not paraphrase, summarize, rewrite, improve, or editorialize visible text.
- Preserve the original wording, sentence structure, tone, and level of detail whenever the text is readable.
- Do not omit readable words, phrases, clauses, warnings, explanations, timings, or serving advice.
- Do not replace readable wording with shorter or more elegant wording.
- Use context only to resolve obvious character or word recognition errors.

Partial text reconstruction:
- If a sentence is mostly readable but one or a few words are obscured, damaged, or cut off, reconstruct the missing words using the visible context.
- Reconstruction is allowed only when the missing text is strongly implied by the surrounding sentence and recipe context.
- Prefer the smallest possible reconstruction: replace missing words or short phrases, not whole sentences or paragraphs.
- Preserve all readable text exactly; only reconstruct the missing part.
- Do not rewrite or stylistically improve the reconstructed sentence.
- Do not use "..." when a short missing word or phrase can be confidently reconstructed.
- If a larger passage is unreadable or the intended wording is uncertain, do not invent the content. Preserve the readable portion and add a warning.
- A seemingly truncated word or phrase may be a damaged or occluded word rather than an intentional ellipsis; resolve it when the intended wording is strongly supported by context.

Structural normalization is allowed where required by the JSON schema, but the underlying visible meaning must remain unchanged.

- Ingredient section headings may contain serving information.
- If a heading includes serving or people information, extract that information into recipe.servings as well.
- Preserve the visible heading text in ingredientsSections.heading.

- Use amount as the lower value and amountMax as the upper value for ranges.
- For exact amounts, set amountMax equal to amount.

Step extraction:
- Preserve the visible wording as closely as possible.
- Do not paraphrase or summarize steps.
- Do not omit visible clauses or sentences.
- Keep all visible instructions, warnings, explanations, timings, and serving instructions.
- Preserve the original step order and numbering.
- Keep actions together when they belong to the same source step.
- Do not merge separate numbered steps.
- Do not split a numbered step unless the source structure clearly requires it.
- A step should represent the source text shown in the image, not a rewritten interpretation of what the cook should do.

- Do not invent servings or title if they are not visible in the image.
- If preparation time or cooking time in minutes is explicitly stated on the image, set recipe.prepTimeMinutes and/or recipe.cookTimeMinutes; otherwise use null.

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
- Confidence reflects transcription certainty, not plausibility of inferred content.
- Do not increase confidence because missing or damaged text can be guessed from context.

- Return JSON only. No markdown, no explanations, no code fences.

Use the exact keys above. If the image has multiple pages, merge the content into one coherent recipe.`

const ORIGINAL_LANGUAGE_INSTRUCTION =
  'Preserve the original language of the recipe.'

const GERMAN_OUTPUT_INSTRUCTION =
  'The user requested German output; translate the extracted recipe fields according to the additional translation mode below.'

export const EXTRACT_PROMPT =
  EXTRACT_PROMPT_BODY + ORIGINAL_LANGUAGE_INSTRUCTION

export const GERMAN_TRANSLATION_ADDON = `Additional translation mode:

The user requested German output.

These rules apply when German output is requested.

Set recipe.language to "de".

Translate:
- recipe.introText
- ingredientsSections.heading when present
- ingredient
- additionalInfo
- steps
- tips

Do not translate:
- recipe.title, unless it is clearly descriptive and not a proper recipe name
- ingredient originalText

German ingredient fields:
- originalText: keep the exact visible source line, unchanged, in the source language.
- ingredient: always provide a clean German ingredient name.
- additionalInfo: translated preparation notes, alternatives, or modifiers only.

Ingredient sections:
- Preserve section order and ingredient order.
- If a section heading is null, keep it null.
- Translate non-null headings naturally and keep them short.

German translation style:
- Use natural German recipe language for home cooks.
- Use informal "du" only when directly addressing the cook.
- Do not use formal "Sie".
- Preserve meaning and cooking intent.
- Do not translate word-for-word if it sounds unnatural.
- It is okay if German text becomes slightly longer for clarity.
- Keep concise, but not at the cost of awkward wording.
- Avoid literal translations of English food terms when they sound awkward.
- Translate cooking terms contextually, e.g. "broil" as "kurz unter dem Grill bräunen", or similar when appropriate.
- For serving/enjoy instructions, use natural German recipe phrasing.
- Prefer natural phrases such as:
  - "Mit ... servieren."
  - "Zum Servieren ... darübergeben."
  - "Nach Belieben mit ... garnieren."
  - "Nach Belieben noch etwas ... hinzufügen."
- Translate "as desired" naturally as "nach Belieben".

Important:
- Preserve ingredient originalText exactly.
- Do not return both translated and original versions of steps or tips.
- Tips do not have an originalText field.

Example:
"Enjoy with more thyme and flaky salt as desired."
→ "Zum Servieren nach Belieben noch etwas Thymian und Meersalzflocken darübergeben."`

/**
 * @param {boolean} [translateToGerman=false]
 * @returns {string}
 */
export function buildImageExtractionPrompt(translateToGerman = false) {
  const parsingBlock = buildIngredientParsingPromptBlock({
    unitLanguage: translateToGerman ? 'de' : 'en',
    includeAmountMaxRule: true,
    germanIngredientNames: translateToGerman,
  })

  const finalLanguageInstruction = translateToGerman
    ? GERMAN_OUTPUT_INSTRUCTION
    : ORIGINAL_LANGUAGE_INSTRUCTION

  const base = EXTRACT_PROMPT_BODY + parsingBlock + finalLanguageInstruction

  if (translateToGerman) {
    return `${base}\n\n${GERMAN_TRANSLATION_ADDON}`
  }

  return base
}

/**
 * @param {boolean} [translateToGerman=false]
 * @returns {string}
 */
export function buildImageExtractionUserMessage(translateToGerman = false) {
  if (translateToGerman) {
    return (
      'Extract the recipe from the following image(s). ' +
      'Translate the extracted fields to German according to the system instructions. ' +
      'Keep ingredient originalText unchanged. ' +
      'Return valid JSON matching the schema.'
    )
  }

  return 'Extract the recipe from the following image(s). Return valid JSON matching the schema.'
}

/**
 * @param {unknown} value
 * @returns {boolean}
 */
export function parseTranslateToGerman(value) {
  return value === true || value === 'true'
}

export const RECIPE_JSON_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['status', 'confidence', 'warnings', 'missingFields', 'recipe'],
  properties: {
    status: {
      type: 'string',
      enum: ['success', 'partial', 'failed'],
      description: 'Overall extraction result',
    },
    confidence: {
      type: 'number',
      minimum: 0,
      maximum: 1,
      description: 'Overall extraction confidence',
    },
    warnings: {
      type: 'array',
      items: { type: 'string' },
      description: 'Uncertainties or extraction problems',
    },
    missingFields: {
      type: 'array',
      items: { type: 'string' },
      description: 'Fields that are missing, unclear, or not visible',
    },

    recipe: {
      type: ['object', 'null'],
      additionalProperties: false,
      required: [
        'title',
        'subtitle',
        'introText',
        'language',
        'servings',
        'prepTimeMinutes',
        'cookTimeMinutes',
        'ingredientsSections',
        'steps',
        'tips',
      ],
      properties: {
        title: { type: ['string', 'null'] },
        subtitle: { type: ['string', 'null'] },
        introText: { type: ['string', 'null'] },
        language: { type: ['string', 'null'] },

        prepTimeMinutes: {
          type: ['number', 'null'],
          description:
            'Preparation time in minutes if explicitly visible; otherwise null',
        },
        cookTimeMinutes: {
          type: ['number', 'null'],
          description:
            'Cooking time in minutes if explicitly visible; otherwise null',
        },

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
                  required: [
                    'originalText',
                    'amount',
                    'amountMax',
                    'unit',
                    'ingredient',
                    'additionalInfo',
                    'category',
                  ],
                  properties: {
                    originalText: { type: ['string', 'null'] },
                    amount: { type: ['number', 'null'] },
                    amountMax: { type: ['number', 'null'] },
                    unit: {
                      type: ['string', 'null'],
                      description:
                        'Unit of the ingredient, e.g. "g", "ml", "TL", "EL", "cup", "Prise", "Handvoll", "Schuss", "Zehen".',
                    },
                    ingredient: { type: ['string', 'null'] },
                    additionalInfo: { type: ['string', 'null'] },
                    category: {
                      type: ['string', 'null'],
                      enum: CANONICAL_INGREDIENT_CATEGORY_ENUM,
                    },
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
          description:
            'Tips, notes, variations, or cooking advice not part of steps',
        },
      },
    },
  },
}

/**
 * @param {Buffer[]} imageBuffers - One or more images (recipe text)
 * @param {{ translateToGerman?: boolean }} [options]
 * @returns {Promise<{ recipe: { status: string, confidence: number, warnings: string[], missingFields: string[], recipe: object|null }, usage?: { prompt_tokens: number, completion_tokens: number, total_tokens: number } }>}
 */
export async function extractRecipeFromImages(imageBuffers, options = {}) {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) throw new Error('OPENAI_API_KEY is not set')

  const translateToGerman = options.translateToGerman === true
  const systemPrompt = buildImageExtractionPrompt(translateToGerman)
  const userMessage = buildImageExtractionUserMessage(translateToGerman)

  const client = new OpenAI({ apiKey })

  const imageContents = imageBuffers.map((buf) => ({
    type: 'image_url',
    image_url: {
      url: `data:image/webp;base64,${buf.toString('base64')}`,
      detail: process.env.OPENAI_EXTRACT_DETAIL || 'high',
    },
  }))

  const response = await client.chat.completions.create({
    model: process.env.OPENAI_EXTRACT_MODEL || 'gpt-4.1-mini',
    messages: [
      { role: 'system', content: systemPrompt },
      {
        role: 'user',
        content: [
          { type: 'text', text: userMessage },
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

  if (!choice?.message?.content) {
    throw new Error('No content in OpenAI response')
  }

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
 * Log token usage and optional JSON payloads for any OpenAI call (vision extract, URL normalize, health score, …).
 * @param {number|null|undefined} recipeId
 * @param {{ prompt_tokens?: number, completion_tokens?: number, total_tokens?: number }|null|undefined} usage
 * @param {unknown} responseJson
 * @param {{ model?: string|null, usage_kind?: string|null, request_json?: string|null }} [meta]
 */
export function logAiTokenUsage(recipeId, usage, responseJson = null, meta = {}) {
  if (!usage && responseJson == null) return

  const db = getDb()
  const now = new Date().toISOString().slice(0, 19).replace('T', ' ')

  const responseStr =
    responseJson != null
      ? typeof responseJson === 'string'
        ? responseJson
        : JSON.stringify(responseJson)
      : null

  const requestStr =
    meta.request_json != null && String(meta.request_json).trim() !== ''
      ? typeof meta.request_json === 'string'
        ? meta.request_json
        : JSON.stringify(meta.request_json)
      : null

  const model = meta.model != null ? String(meta.model) : null
  const usage_kind = meta.usage_kind != null ? String(meta.usage_kind) : null

  db.prepare(`
    INSERT INTO ai_token_usage (
      recipe_id,
      prompt_tokens,
      completion_tokens,
      total_tokens,
      response_json,
      request_json,
      model,
      usage_kind,
      created_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    recipeId,
    usage?.prompt_tokens ?? null,
    usage?.completion_tokens ?? null,
    usage?.total_tokens ?? null,
    responseStr,
    requestStr,
    model,
    usage_kind,
    now,
  )
}