import { Router } from 'express'
import healthRoutes from './health.js'
import recipesRoutes from './recipes.js'
import uploadRoutes from './upload.js'
import sourcesRoutes from './sources.js'
import adminRoutes from './admin.js'

const router = Router()

router.use('/health', healthRoutes)
router.use('/admin', adminRoutes)
router.use('/recipes', recipesRoutes)
router.use('/upload', uploadRoutes)
router.use('/sources', sourcesRoutes)

export default router
