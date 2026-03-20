/**
 * Admin read access for ai_token_usage with recipe title join.
 */

import { getDb } from '../db/index.js'
import { computeRequestCostCents, computeRequestCostUsd, resolvePricingKey } from '../utils/extractUsagePricing.js'

export function listExtractUsageForAdmin() {
  const db = getDb()
  const rows = db
    .prepare(
      `
    SELECT e.id,
           e.recipe_id,
           e.prompt_tokens,
           e.completion_tokens,
           e.total_tokens,
           e.response_json,
           e.request_json,
           e.model,
           e.usage_kind,
           e.created_at,
           r.title AS recipe_title
    FROM ai_token_usage e
    LEFT JOIN recipes r ON r.id = e.recipe_id
    ORDER BY e.id DESC
  `
    )
    .all()

  return rows.map((row) => {
    const pricing_key = resolvePricingKey(row.model)
    const cost_usd = computeRequestCostUsd(row.prompt_tokens, row.completion_tokens, row.model)
    const cost_cents = computeRequestCostCents(row.prompt_tokens, row.completion_tokens, row.model)
    return {
      id: row.id,
      recipe_id: row.recipe_id,
      recipe_title: row.recipe_title ?? null,
      prompt_tokens: row.prompt_tokens,
      completion_tokens: row.completion_tokens,
      total_tokens: row.total_tokens,
      response_json: row.response_json,
      request_json: row.request_json ?? null,
      model: row.model,
      usage_kind: row.usage_kind,
      created_at: row.created_at,
      pricing_key,
      cost_usd,
      cost_cents,
    }
  })
}
