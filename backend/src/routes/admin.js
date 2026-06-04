import { Router } from 'express'
import { listExtractUsageForAdmin } from '../services/extractUsageAdminService.js'
import cupGramReferencesRoutes from './adminCupGramReferences.js'

const router = Router()

router.use('/cup-gram-references', cupGramReferencesRoutes)

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
