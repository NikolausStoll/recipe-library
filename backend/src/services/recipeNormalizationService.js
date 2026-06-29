/**
 * LLM normalization for raw URL-scraped recipes (recipeUrlExtractService output).
 * Pure transformation: no DB, no nutrition. Uses same JSON shape as vision extract (RECIPE_JSON_SCHEMA).
 */

import OpenAI from 'openai'
import { RECIPE_JSON_SCHEMA } from './extractRecipeService.js'
import { formatCategoryListForPrompt } from '../constants/ingredientCategories.js'
import { buildIngredientParsingPromptBlock } from '../constants/ingredientParsingPrompt.js'
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
- Ingredients are provided as ingredient_sections. Each section has a heading and lines.

Tasks:
- Clean and structure the recipe.
- Normalize ingredient lines.
- Preserve ingredient section structure.
- Do not invent ingredients or steps.
- If unclear, stay close to the original.
- When rules conflict, preserve original meaning and avoid unsafe conversions over aggressive normalization.

Translation:
- Translate recipe.description to German.
- Translate ingredient section headings to German when present.
- Translate ingredients to German:
  - ingredient
  - additionalInfo
- Translate steps to German.
- Translate notes/tips to German.
- Do not translate recipe.title.
- Do not translate ingredient originalText.
- Do not include original untranslated notes/tips in the final recipe.

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

Ingredient sections:
- Preserve section order.
- Preserve ingredient order within each section.
- If a section heading is null, keep it null.
- If a section heading is present, translate it naturally and keep it short.
- Examples:
  - "dressing" → "Dressing"
  - "herb oil" → "Kräuteröl"
  - "for serving" → "Zum Servieren"

${buildIngredientParsingPromptBlock({ unitLanguage: 'de', includeCupHandling: true })}

Allowed categories:
${formatCategoryListForPrompt()}

Categorization:
- Use exactly one category.
- Use only the allowed categories.
- Choose the most practical category from the ingredient name.
- If uncertain, use "other".

Steps:
- The scraper already provides clustered steps. Return **exactly one output step per input step** (same count, same order).
- Do not split one input step into multiple steps, even when it contains several sentences or alternatives.
- Do not merge multiple input steps into one step.
- Translate the **entire** step text to German, including short phrases like "Now assemble." → e.g. "Jetzt alles zusammenstellen."
- Do not leave English words or fragments in step text.
- Use natural German recipe language for home cooks.
- Use informal "du" only when directly addressing the cook.
- Do not use formal "Sie".
- Preserve meaning and cooking intent.
- Do not translate word-for-word if it sounds unnatural.
- Keep concise, but not at the cost of awkward wording or by splitting steps.

Notes/Tips:
- If input contains notes, map them to recipe.tips.
- Translate notes/tips to natural German.
- recipe.tips must contain German text only.
- Do not include original English notes/tips in recipe.tips.
- Do not include both translated and original versions.
- Do not duplicate notes.
- For N input notes, usually return at most N tips unless distinct notes are clearly combined or split for clarity.
- originalText preservation applies only to ingredient items, never to notes/tips.
- Notes/tips do not have an originalText field.
- Preserve meaning.
- Keep notes concise but natural.

Notes/Tips example:
Input note:
"Make the tortellini and sweet potatoes ahead of time so they have enough time to cool before adding to the salad."

Output tip:
"Bereite Tortellini und Süßkartoffeln im Voraus zu, damit sie genug Zeit zum Abkühlen haben, bevor du sie zum Salat gibst."

Do not also output the English input note.`
}

/**
 * @typedef {{ heading: string | null, lines: string[] }} NormalizationIngredientSection
 */

/**
 * Canonical ingredient_sections for the normalization LLM (never duplicates ingredient_lines).
 * @param {object} rawRecipe
 * @returns {NormalizationIngredientSection[]}
 */
export function buildCanonicalIngredientSections(rawRecipe) {
  const sections = Array.isArray(rawRecipe?.ingredient_sections) ? rawRecipe.ingredient_sections : []
  const lines = Array.isArray(rawRecipe?.ingredient_lines) ? rawRecipe.ingredient_lines : []

  /** @type {NormalizationIngredientSection[]} */
  const fromSections = []
  for (const section of sections) {
    if (!section || !Array.isArray(section.lines)) continue
    const cleanedLines = section.lines
      .map((line) => (typeof line === 'string' ? line.replace(/\s+/g, ' ').trim() : ''))
      .filter(Boolean)
    if (!cleanedLines.length) continue
    const heading =
      section.heading != null && String(section.heading).trim()
        ? String(section.heading).replace(/\s+/g, ' ').trim()
        : null
    fromSections.push({ heading, lines: cleanedLines })
  }

  if (fromSections.length > 0) return fromSections

  const cleanedLines = lines
    .map((line) => (typeof line === 'string' ? line.replace(/\s+/g, ' ').trim() : ''))
    .filter(Boolean)
  if (cleanedLines.length > 0) return [{ heading: null, lines: cleanedLines }]

  return [{ heading: null, lines: [] }]
}

/**
 * Payload sent to the normalization LLM (no duplicate ingredient sources).
 * @param {object} rawRecipe
 */
export function buildNormalizationPayloadForModel(rawRecipe) {
  return {
    title: rawRecipe?.title ?? null,
    description: rawRecipe?.description ?? null,
    servings_raw: rawRecipe?.servings_raw ?? null,
    ingredient_sections: buildCanonicalIngredientSections(rawRecipe),
    steps: Array.isArray(rawRecipe?.steps) ? rawRecipe.steps : [],
    notes: Array.isArray(rawRecipe?.notes) ? rawRecipe.notes : [],
  }
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
  // Do not send time fields, image URLs, or duplicate ingredient sources to the model.
  const payloadForModel = buildNormalizationPayloadForModel(rawRecipe)
  const stepCount = Array.isArray(payloadForModel.steps) ? payloadForModel.steps.length : 0
  /** Serialized input JSON sent to the model (stored in ai_token_usage.request_json). */
  const userPayload = JSON.stringify(payloadForModel, null, 0)

  const systemPrompt = buildNormalizationPrompt()
  const stepConstraint =
    stepCount > 0
      ? `\n\nImportant: The input has ${stepCount} step(s). Return exactly ${stepCount} step(s) in recipe.steps — one translated German step per input step, same order. Do not split or merge steps.`
      : ''

  const response = await client.chat.completions.create({
    model,
    ...buildOpenAiChatTemperature(model, TEMPERATURE),
    messages: [
      { role: 'system', content: systemPrompt },
      {
        role: 'user',
        content: `Raw recipe JSON (from web scraper):\n${userPayload}\n\nReturn valid JSON matching the recipe extraction schema exactly.${stepConstraint}`,
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
 * Remove tips that exactly match raw scraper notes (untranslated echoes) and dedupe tips.
 * @param {object} structured – normalization envelope
 * @param {object} rawRecipe – scraped raw recipe
 */
export function sanitizeNormalizedTips(structured, rawRecipe) {
  if (!structured?.recipe) return structured

  const rawNotes = Array.isArray(rawRecipe?.notes) ? rawRecipe.notes : []
  const rawNoteKeys = new Set(
    rawNotes.map((note) => String(note).trim()).filter(Boolean)
  )

  const tips = Array.isArray(structured.recipe.tips) ? structured.recipe.tips : []
  const seen = new Set()
  /** @type {string[]} */
  const cleaned = []

  for (const tip of tips) {
    const trimmed = String(tip).trim()
    if (!trimmed) continue
    if (rawNoteKeys.has(trimmed)) continue
    if (seen.has(trimmed)) continue
    seen.add(trimmed)
    cleaned.push(trimmed)
  }

  structured.recipe.tips = cleaned
  return structured
}

/**
 * Append scraped notes to normalized tips when the LLM omitted them entirely.
 * @param {object} structured – normalization envelope
 * @param {object} rawRecipe – scraped raw recipe
 */
export function mergeScrapedNotesIntoEnvelope(structured, rawRecipe) {
  if (!structured?.recipe || !Array.isArray(rawRecipe?.notes) || !rawRecipe.notes.length) return structured

  const tips = Array.isArray(structured.recipe.tips) ? structured.recipe.tips : []
  if (tips.length > 0) return structured

  const merged = []
  const seen = new Set()
  for (const note of rawRecipe.notes) {
    const text = String(note).trim()
    if (!text || seen.has(text)) continue
    seen.add(text)
    merged.push(text)
  }
  structured.recipe.tips = merged
  return structured
}

/**
 * Sanitize echoed raw notes from tips, then merge only when the LLM omitted all tips.
 * @param {object} structured – normalization envelope
 * @param {object} rawRecipe – scraped raw recipe
 */
export function finalizeNormalizedTips(structured, rawRecipe) {
  sanitizeNormalizedTips(structured, rawRecipe)
  mergeScrapedNotesIntoEnvelope(structured, rawRecipe)
  return structured
}

function rawStepsFromRecipe(rawRecipe) {
  return (Array.isArray(rawRecipe?.steps) ? rawRecipe.steps : [])
    .map((step) => String(step).replace(/\s+/g, ' ').trim())
    .filter(Boolean)
}

function normalizedStepsFromEnvelope(structured) {
  return (Array.isArray(structured?.recipe?.steps) ? structured.recipe.steps : [])
    .map((step) => String(step?.text ?? '').replace(/\s+/g, ' ').trim())
    .filter(Boolean)
}

/** True when normalized step likely starts the next raw English step (boundary for re-merge). */
function normalizedStepMatchesRawStart(normalizedText, rawStep) {
  const norm = normalizedText.toLowerCase()
  const raw = rawStep.toLowerCase()
  if (norm.startsWith(raw.slice(0, Math.min(14, raw.length)))) return true

  const boundaryPairs = [
    ['alternatively', 'alternativ'],
    ['in the meantime', 'in der zwischenzeit'],
    ['cook the', 'koche'],
    ['cook ', 'koche '],
    ['prepare the', 'bereite'],
    ['now assemble', 'jetzt'],
  ]
  return boundaryPairs.some(([en, de]) => raw.includes(en) && norm.includes(de))
}

/**
 * When the LLM splits clustered scraper steps, merge normalized steps back to match raw step count.
 * Uses the next raw step text as a boundary marker.
 */
export function realignNormalizedSteps(structured, rawRecipe) {
  if (!structured?.recipe) return structured

  const rawSteps = rawStepsFromRecipe(rawRecipe)
  const normalizedSteps = normalizedStepsFromEnvelope(structured)
  if (rawSteps.length === 0 || normalizedSteps.length <= rawSteps.length) return structured

  const buckets = []
  let normIndex = 0

  for (let rawIndex = 0; rawIndex < rawSteps.length; rawIndex++) {
    const parts = []
    if (normIndex >= normalizedSteps.length) break

    do {
      parts.push(normalizedSteps[normIndex])
      normIndex++
      if (rawIndex === rawSteps.length - 1) break
      if (normIndex >= normalizedSteps.length) break
    } while (!normalizedStepMatchesRawStart(normalizedSteps[normIndex], rawSteps[rawIndex + 1]))

    buckets.push(parts.join(' '))
  }

  if (normIndex < normalizedSteps.length && buckets.length > 0) {
    buckets[buckets.length - 1] += ` ${normalizedSteps.slice(normIndex).join(' ')}`
  }

  structured.recipe.steps = buckets.map((text, index) => ({
    index: index + 1,
    text,
  }))
  return structured
}

export function finalizeNormalizedSteps(structured, rawRecipe) {
  return realignNormalizedSteps(structured, rawRecipe)
}

export function finalizeNormalizedRecipe(structured, rawRecipe) {
  finalizeNormalizedTips(structured, rawRecipe)
  finalizeNormalizedSteps(structured, rawRecipe)
  return structured
}

/**
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
