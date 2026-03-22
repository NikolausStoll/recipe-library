/**
 * LLM-based practical health score for an already structured recipe (separate from OCR/URL extraction).
 * Not medical advice; rough everyday estimate only.
 * Failures throw — there is no fallback estimate.
 */

import OpenAI from 'openai'
import { getRecipeById } from './recipeService.js'

const DEFAULT_MODEL = process.env.OPENAI_HEALTH_SCORE_MODEL || 'gpt-4o-mini'
const TEMPERATURE = Math.min(0.3, Math.max(0, Number(process.env.OPENAI_HEALTH_SCORE_TEMPERATURE) || 0.2))

const HEALTH_SCORE_PROMPT = `You estimate a simple health score for a recipe.

Return only valid JSON.

Context:
The input is already a structured recipe. The result should be a practical health estimate for everyday use, not a medical assessment.

Your task:
- Estimate a health score from 0 to 100
- Give a short practical summary
- List positives
- List concerns
- Provide a few useful improvement tips

Scoring guidance:
- Higher score for vegetables, legumes, whole grains, balanced protein, healthy fats, and low processing
- Lower score for high sugar, high saturated fat, very salty ingredients, highly processed ingredients, and low nutrient density
- Base the score mainly on ingredient composition and overall recipe balance
- Use nutrition data if provided
- Use servings only as a secondary signal if available
- Do not depend on servings to produce a useful score
- Ignore steps unless they clearly indicate a health-relevant cooking method (for example deep frying)
- Use common-sense cooking and nutrition assumptions
- Be pragmatic, not overly strict
- Do not pretend the score is exact
- If information is incomplete, still provide the best reasonable estimate

Rules:
- Keep the tone practical and helpful
- Do not give medical advice
- Do not invent hidden ingredients
- Base the score primarily on visible ingredients and optional nutrition data
- Tips should be realistic and easy to apply
- Prefer 2 to 4 improvement tips
- confidence must be between 0 and 1

Output must match the JSON schema exactly.`

const HEALTH_SCORE_JSON_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['healthScore', 'summary', 'positives', 'concerns', 'improvementTips', 'confidence'],
  properties: {
    healthScore: { type: 'number', minimum: 0, maximum: 100 },
    summary: { type: 'string' },
    positives: { type: 'array', items: { type: 'string' } },
    concerns: { type: 'array', items: { type: 'string' } },
    improvementTips: { type: 'array', items: { type: 'string' } },
    confidence: { type: 'number', minimum: 0, maximum: 1 },
  },
}

/**
 * Thrown when a health score call fails after the request (optional tokenUsage for logging).
 */
export class HealthScoreEstimateError extends Error {
  /**
   * @param {string} message
   * @param {{ model?: string|null, tokenUsage?: object|null }} [meta]
   */
  constructor(message, meta = {}) {
    super(message)
    this.name = 'HealthScoreEstimateError'
    this.model = meta.model ?? null
    this.tokenUsage = meta.tokenUsage ?? null
  }
}

/**
 * Build a compact JSON-serializable payload from a full recipe row (e.g. getRecipeById).
 * @param {object} recipe
 */
export function buildHealthScorePayload(recipe) {
  if (!recipe || typeof recipe !== 'object') {
    return {}
  }
  const hasNutrition =
    recipe.nutrition_kcal != null ||
    recipe.nutrition_protein != null ||
    recipe.nutrition_carbs != null ||
    recipe.nutrition_fat != null

  return {
    title: recipe.title ?? null,
    subtitle: recipe.subtitle ?? null,
    servings: recipe.servings ?? recipe.servings_value ?? null,
    servings_unit_text: recipe.servings_unit_text ?? null,
    language: recipe.language ?? null,
    ingredients: Array.isArray(recipe.ingredients)
      ? recipe.ingredients.map((ing) => ({
          amount: ing.amount ?? null,
          amount_max: ing.amount_max ?? null,
          unit: ing.unit ?? null,
          ingredient: ing.ingredient ?? ing.name ?? null,
          category: ing.category ?? null,
          additional_info: ing.additional_info ?? null,
          original_text: ing.original_text ?? null,
          section_heading: ing.section_heading ?? null,
        }))
      : [],
    nutrition: hasNutrition
      ? {
          kcal: recipe.nutrition_kcal ?? null,
          protein: recipe.nutrition_protein ?? null,
          carbs: recipe.nutrition_carbs ?? null,
          fat: recipe.nutrition_fat ?? null,
        }
      : null,
  }
}

function clamp(n, min, max) {
  if (typeof n !== 'number' || Number.isNaN(n)) return null
  return Math.min(max, Math.max(min, n))
}

function asStringArray(v) {
  if (!Array.isArray(v)) return []
  return v.map((x) => (x == null ? '' : String(x).trim())).filter(Boolean)
}

/**
 * Normalize parsed model output; returns null if unusable.
 * @param {object} raw
 */
export function sanitizeHealthScoreResult(raw) {
  if (!raw || typeof raw !== 'object') return null
  const healthScore = clamp(raw.healthScore, 0, 100)
  const confidence = clamp(raw.confidence, 0, 1)
  const summary = raw.summary != null && String(raw.summary).trim() !== '' ? String(raw.summary).trim() : null
  if (healthScore == null || confidence == null || summary == null) return null
  return {
    healthScore,
    summary,
    positives: asStringArray(raw.positives),
    concerns: asStringArray(raw.concerns),
    improvementTips: asStringArray(raw.improvementTips),
    confidence,
  }
}

function usageFromResponse(usage) {
  if (!usage) return null
  return {
    prompt_tokens: usage.prompt_tokens,
    completion_tokens: usage.completion_tokens,
    total_tokens: usage.total_tokens,
  }
}

/**
 * Call OpenAI and return a sanitized health estimate. Throws on any failure (no fallback).
 * @param {object} recipe – structured recipe (same shape as buildHealthScorePayload output is fine)
 * @returns {Promise<{ estimate: object, model: string, tokenUsage: object|null, requestPayload: object }>}
 */
export async function estimateRecipeHealthScore(recipe) {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY is not set')
  }

  const payload = buildHealthScorePayload(recipe)
  const client = new OpenAI({ apiKey })
  const model = process.env.OPENAI_HEALTH_SCORE_MODEL || DEFAULT_MODEL

  try {
    const response = await client.chat.completions.create({
      model,
      temperature: TEMPERATURE,
      messages: [
        { role: 'system', content: HEALTH_SCORE_PROMPT },
        {
          role: 'user',
          content: `Structured recipe JSON:\n${JSON.stringify(payload)}`,
        },
      ],
      response_format: {
        type: 'json_schema',
        json_schema: {
          name: 'recipe_health_score',
          strict: true,
          schema: HEALTH_SCORE_JSON_SCHEMA,
        },
      },
    })

    const choice = response.choices?.[0]
    const content = choice?.message?.content
    const tokenUsage = usageFromResponse(response.usage)

    if (!content) {
      console.warn('[health-score] Empty OpenAI response')
      throw new HealthScoreEstimateError('No content returned from model', { model, tokenUsage })
    }

    let parsed
    try {
      parsed = JSON.parse(content)
    } catch (e) {
      console.warn('[health-score] JSON parse failed:', e)
      throw new HealthScoreEstimateError('Invalid JSON from model', { model, tokenUsage })
    }

    const sanitized = sanitizeHealthScoreResult(parsed)
    if (!sanitized) {
      console.warn('[health-score] Sanitization failed for:', parsed)
      throw new HealthScoreEstimateError('Could not normalize model output', { model, tokenUsage })
    }

    return {
      estimate: sanitized,
      model,
      tokenUsage,
      requestPayload: payload,
    }
  } catch (e) {
    if (e instanceof HealthScoreEstimateError) throw e
    console.error('[health-score] OpenAI error:', e)
    const msg = e instanceof Error ? e.message : 'Health score request failed'
    throw new HealthScoreEstimateError(msg, { model })
  }
}

/**
 * Load recipe by id and estimate health score (caller persists on success only).
 * @param {number|string} id
 */
export async function estimateRecipeHealthScoreById(id) {
  const recipe = getRecipeById(Number(id))
  if (!recipe) {
    throw new Error('Recipe not found')
  }
  return estimateRecipeHealthScore(recipe)
}
