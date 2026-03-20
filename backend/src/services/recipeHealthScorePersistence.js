/**
 * Persist LLM health score estimates in recipe_health_scores (one row per recipe).
 * Model and token counts are stored in ai_token_usage only (see logAiTokenUsage).
 * Only successful estimates are stored (no fallback rows).
 */

import { getDb } from '../db/index.js'

function safeJsonParse(str, fallback) {
  if (str == null || str === '') return fallback
  try {
    return JSON.parse(str)
  } catch {
    return fallback
  }
}

/**
 * Upsert the latest health score result for a recipe (successful estimate only).
 * @param {number} recipeId
 * @param {object} result – { estimate, model, tokenUsage }
 */
export function upsertRecipeHealthScore(recipeId, result) {
  const id = Number(recipeId)
  if (!Number.isFinite(id) || id <= 0) return

  const est = result?.estimate ?? {}
  const positivesJson = JSON.stringify(Array.isArray(est.positives) ? est.positives : [])
  const concernsJson = JSON.stringify(Array.isArray(est.concerns) ? est.concerns : [])
  const tipsJson = JSON.stringify(Array.isArray(est.improvementTips) ? est.improvementTips : [])

  const db = getDb()
  db.prepare(
    `
    INSERT INTO recipe_health_scores (
      recipe_id, health_score, confidence, summary, positives_json, concerns_json, improvement_tips_json,
      updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
    ON CONFLICT(recipe_id) DO UPDATE SET
      health_score = excluded.health_score,
      confidence = excluded.confidence,
      summary = excluded.summary,
      positives_json = excluded.positives_json,
      concerns_json = excluded.concerns_json,
      improvement_tips_json = excluded.improvement_tips_json,
      updated_at = datetime('now')
  `,
  ).run(
    id,
    est.healthScore ?? null,
    est.confidence ?? null,
    est.summary ?? null,
    positivesJson,
    concernsJson,
    tipsJson,
  )
}

/**
 * Map DB row to API response shape for GET (estimate fields only).
 * @param {object|null|undefined} row
 */
export function rowToHealthScoreResponse(row) {
  if (!row) return null

  const positives = safeJsonParse(row.positives_json, [])
  const concerns = safeJsonParse(row.concerns_json, [])
  const improvementTips = safeJsonParse(row.improvement_tips_json, [])

  const estimate = {
    healthScore: row.health_score ?? null,
    summary: row.summary ?? null,
    positives: Array.isArray(positives) ? positives : [],
    concerns: Array.isArray(concerns) ? concerns : [],
    improvementTips: Array.isArray(improvementTips) ? improvementTips : [],
    confidence: row.confidence ?? null,
  }

  return {
    estimate,
    model: null,
    tokenUsage: null,
  }
}

/**
 * @param {number|string} recipeId
 */
export function getRecipeHealthScoreByRecipeId(recipeId) {
  const db = getDb()
  const row = db.prepare('SELECT * FROM recipe_health_scores WHERE recipe_id = ?').get(Number(recipeId))
  return rowToHealthScoreResponse(row)
}
