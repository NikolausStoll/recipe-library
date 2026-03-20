import { Router } from 'express'
import { listExtractUsageForAdmin } from '../services/extractUsageAdminService.js'

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

export default router
