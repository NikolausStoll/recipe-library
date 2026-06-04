import { Router } from 'express'
import {
  listCupGramReferences,
  createCupGramReference,
  updateCupGramReference,
  deleteCupGramReference,
} from '../services/cupGramReferenceService.js'

const router = Router()

function validateBody(body, { partial = false } = {}) {
  const errors = []
  if (!partial || body.ingredient !== undefined) {
    const ingredient = String(body.ingredient ?? '').trim()
    if (!ingredient) errors.push('ingredient is required')
  }
  if (!partial || body.cups !== undefined) {
    const cups = Number(body.cups)
    if (!Number.isFinite(cups) || cups <= 0) errors.push('cups must be a positive number')
  }
  if (!partial || body.grams !== undefined) {
    const grams = Number(body.grams)
    if (!Number.isFinite(grams) || grams <= 0) errors.push('grams must be a positive number')
  }
  return errors
}

router.get('/', (req, res) => {
  try {
    res.json({ references: listCupGramReferences() })
  } catch (e) {
    console.error('admin cup-gram-references list failed:', e)
    res.status(500).json({ error: 'Failed to load cup gram references' })
  }
})

router.post('/', (req, res) => {
  const errors = validateBody(req.body ?? {})
  if (errors.length) return res.status(400).json({ error: errors.join('; ') })
  try {
    const row = createCupGramReference(req.body)
    res.status(201).json(row)
  } catch (e) {
    console.error('admin cup-gram-references create failed:', e)
    res.status(500).json({ error: 'Failed to create reference' })
  }
})

router.put('/:id', (req, res) => {
  const id = Number(req.params.id)
  if (!Number.isFinite(id) || id <= 0) return res.status(400).json({ error: 'Invalid id' })
  const errors = validateBody(req.body ?? {}, { partial: true })
  if (errors.length) return res.status(400).json({ error: errors.join('; ') })
  try {
    const row = updateCupGramReference(id, req.body ?? {})
    if (!row) return res.status(404).json({ error: 'Reference not found' })
    res.json(row)
  } catch (e) {
    console.error('admin cup-gram-references update failed:', e)
    res.status(500).json({ error: 'Failed to update reference' })
  }
})

router.delete('/:id', (req, res) => {
  const id = Number(req.params.id)
  if (!Number.isFinite(id) || id <= 0) return res.status(400).json({ error: 'Invalid id' })
  try {
    if (!deleteCupGramReference(id)) return res.status(404).json({ error: 'Reference not found' })
    res.status(204).send()
  } catch (e) {
    console.error('admin cup-gram-references delete failed:', e)
    res.status(500).json({ error: 'Failed to delete reference' })
  }
})

export default router
