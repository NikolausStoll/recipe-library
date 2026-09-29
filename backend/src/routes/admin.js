import { Router } from 'express'
import { listExtractUsageForAdmin } from '../services/extractUsageAdminService.js'
import {
  isObservatoryConfigured,
  runObservatoryBackfill,
} from '../services/observatoryBackfillService.js'

const router = Router()

/**
 * GET /api/admin/extract-usage – list ai_token_usage rows with recipe title and estimated cost (USD / cents).
 */
router.get('/extract-usage', (req, res) => {
  try {
    const rows = listExtractUsageForAdmin()
    res.json({ rows })
  } catch (e) {
    console.error('admin extract-usage failed:', e)
    res.status(500).json({ error: 'Failed to load extract usage' })
  }
})

/**
 * @param {unknown} value
 * @param {boolean} [fallback]
 */
function parseBool(value, fallback = false) {
  if (value == null) return fallback
  if (typeof value === 'boolean') return value
  const s = String(value).trim().toLowerCase()
  if (s === 'true' || s === '1' || s === 'yes') return true
  if (s === 'false' || s === '0' || s === 'no') return false
  return fallback
}

/**
 * @param {unknown} value
 * @returns {number|undefined}
 */
function parseOptionalInt(value) {
  if (value == null || value === '') return undefined
  const n = Number(value)
  return Number.isFinite(n) ? Math.trunc(n) : undefined
}

/**
 * POST /api/admin/observatory-backfill – sync historical ai_token_usage into AI Usage Observatory.
 * Body/query: dryRun, limit, since, batchSize, delayMs.
 * Idempotent via deterministic eventId (UUID v5). Same exposure as other /api/admin routes.
 */
router.post('/observatory-backfill', async (req, res) => {
  try {
    const src = { ...req.query, ...(req.body && typeof req.body === 'object' ? req.body : {}) }
    const dryRun = parseBool(src.dryRun, false)

    if (!dryRun && !isObservatoryConfigured()) {
      return res.status(503).json({
        error:
          'AI Observatory is not configured. Set AI_OBSERVATORY_URL and AI_OBSERVATORY_API_KEY (add-on: ai_observatory_url / ai_observatory_api_key).',
      })
    }

    const stats = await runObservatoryBackfill({
      dryRun,
      limit: parseOptionalInt(src.limit),
      since: src.since != null && String(src.since).trim() !== '' ? String(src.since).trim() : null,
      batchSize: parseOptionalInt(src.batchSize),
      delayMs: parseOptionalInt(src.delayMs),
    })
    res.json(stats)
  } catch (e) {
    const status = e?.statusCode && Number.isInteger(e.statusCode) ? e.statusCode : 500
    console.error('admin observatory-backfill failed:', e)
    res.status(status).json({
      error: e instanceof Error ? e.message : 'Observatory backfill failed',
    })
  }
})

export default router
