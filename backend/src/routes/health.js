import { Router } from 'express'
import { getHealth } from '../services/health.js'

const router = Router()

router.get('/', (req, res) => {
  const port = req.app.get('port')
  res.json(getHealth(port))
})

export default router
