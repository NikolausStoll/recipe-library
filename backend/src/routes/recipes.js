import { Router } from 'express'
import multer from 'multer'
import path from 'path'
import fs from 'fs'
import sharp from 'sharp'
import * as recipeService from '../services/recipeService.js'
import { extractRecipeFromImages, logExtractUsage } from '../services/extractRecipeService.js'
import { prepareTextImage } from '../services/imageProcessingService.js'
import { cropPerspective, cropPerspectiveBuffer } from '../services/cropPerspectiveService.js'

const router = Router()
const uploadDirRaw = process.env.UPLOAD_DIR || path.join(process.cwd(), 'data', 'uploads')
const uploadDir = path.isAbsolute(uploadDirRaw) ? uploadDirRaw : path.resolve(process.cwd(), uploadDirRaw)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = /^image\/(jpeg|jpg|png|gif|webp)$/i
    if (allowed.test(file.mimetype)) cb(null, true)
    else cb(new Error('Only image files (JPEG, PNG, GIF, WebP) are allowed'))
  },
})

/**
 * GET /api/recipes – list all recipes (no ingredients/steps).
 */
router.get('/', (req, res) => {
  try {
    const recipes = recipeService.listRecipes()
    res.json(recipes)
  } catch (e) {
    console.error(e)
    res.status(500).json({ error: 'Failed to list recipes' })
  }
})

/**
 * GET /api/recipes/:id – get one recipe with ingredients and steps.
 */
router.get('/:id', (req, res) => {
  const recipe = recipeService.getRecipeById(req.params.id)
  if (!recipe) return res.status(404).json({ error: 'Recipe not found' })
  res.json(recipe)
})

/**
 * POST /api/recipes – create recipe. Body: title (required), optional recipe fields, ingredients[], recipe_steps[].
 */
router.post('/', (req, res) => {
  const body = req.body || {}
  if (!body.title || String(body.title).trim() === '') {
    return res.status(400).json({ error: 'title is required' })
  }
  try {
    const recipe = recipeService.createRecipe(body)
    res.status(201).json(recipe)
  } catch (e) {
    console.error(e)
    res.status(500).json({ error: 'Failed to create recipe' })
  }
})

/**
 * PUT /api/recipes/:id – update recipe. Body: optional recipe fields, ingredients[], recipe_steps[] (replace).
 */
router.put('/:id', (req, res) => {
  const body = req.body || {}
  if (body.title !== undefined && String(body.title).trim() === '') {
    return res.status(400).json({ error: 'title must not be empty' })
  }
  try {
    const recipe = recipeService.updateRecipe(req.params.id, body)
    if (!recipe) return res.status(404).json({ error: 'Recipe not found' })
    res.json(recipe)
  } catch (e) {
    console.error(e)
    res.status(500).json({ error: 'Failed to update recipe' })
  }
})

/**
 * DELETE /api/recipes/:id – delete recipe (cascades to ingredients and steps).
 */
router.delete('/:id', (req, res) => {
  try {
    const deleted = recipeService.deleteRecipe(req.params.id)
    if (!deleted) return res.status(404).json({ error: 'Recipe not found' })
    res.status(204).send()
  } catch (e) {
    console.error(e)
    res.status(500).json({ error: 'Failed to delete recipe' })
  }
})

/**
 * POST /api/recipes/:id/crop-perspective – Perspective crop with 4 user-defined points.
 * Body: { points: [ {x, y}, {x, y}, {x, y}, {x, y} ] } in original image coordinates.
 * Overwrites the recipe image file. Returns { recipe, url } (url has ?v= for cache bust).
 */
router.post('/:id/crop-perspective', async (req, res) => {
  const id = req.params.id
  const recipe = recipeService.getRecipeById(id)
  if (!recipe) return res.status(404).json({ error: 'Recipe not found' })
  if (!recipe.image_path) return res.status(400).json({ error: 'Recipe has no image to crop' })
  const points = req.body?.points
  if (!Array.isArray(points) || points.length !== 4) {
    return res.status(400).json({ error: 'Exactly 4 points {x, y} required' })
  }
  const filename = path.basename(recipe.image_path)
  const filepath = path.join(uploadDir, filename)
  if (!fs.existsSync(filepath)) {
    return res.status(404).json({ error: 'Image file not found' })
  }
  try {
    await cropPerspective(filepath, filepath, points)
    const url = `${recipe.image_path}?v=${Date.now()}`
    res.json({ recipe, url })
  } catch (e) {
    console.error('Crop perspective failed:', e)
    res.status(500).json({ error: e.message || 'Crop failed' })
  }
})

/**
 * POST /api/recipes/:id/extract-from-images – Step 2: extract recipe text from image(s) via OpenAI.
 * Body: multipart form with "images" (one or more files) and optional "points" (JSON array: for each image, null or [ {x,y}, {x,y}, {x,y}, {x,y} ] in original coords). If points[i] has 4 points, that image is perspective-cropped, then scaled; then send to AI.
 * Returns { recipe, usage?: { ... } }. Token usage is logged to extract_usage.
 */
router.post('/:id/extract-from-images', (req, res, next) => {
  upload.array('images', 10)(req, res, (err) => {
    if (err) return res.status(400).json({ error: err.message || 'Upload failed' })
    next()
  })
}, async (req, res) => {
  const id = req.params.id
  const recipe = recipeService.getRecipeById(id)
  if (!recipe) return res.status(404).json({ error: 'Recipe not found' })
  const files = req.files || []
  if (files.length === 0) return res.status(400).json({ error: 'No images provided; use field name "images"' })
  let pointsPerImage = []
  if (req.body?.points) {
    try {
      pointsPerImage = JSON.parse(req.body.points)
      if (!Array.isArray(pointsPerImage) || pointsPerImage.length !== files.length) {
        pointsPerImage = []
      }
    } catch {
      pointsPerImage = []
    }
  }
  try {
    // Order: Resize -> Crop -> Send. Points from frontend are in original image coords; convert to resized coords before crop.
    const buffers = await Promise.all(
      files.map(async (f, i) => {
        const origMeta = await sharp(f.buffer).metadata()
        const origW = origMeta.width || 0
        const origH = origMeta.height || 0
        let buf = await prepareTextImage(f.buffer)
        const pts = pointsPerImage[i]
        if (Array.isArray(pts) && pts.length === 4 && origW > 0 && origH > 0) {
          const resizedMeta = await sharp(buf).metadata()
          const rw = resizedMeta.width || 0
          const rh = resizedMeta.height || 0
          if (rw > 0 && rh > 0) {
            const converted = pts.map((p) => ({
              x: Math.round((Number(p.x) * rw) / origW),
              y: Math.round((Number(p.y) * rh) / origH),
            }))
            buf = await cropPerspectiveBuffer(buf, converted, 'png')
          }
        }
        return buf
      })
    )
    const totalBytes = buffers.reduce((s, b) => s + b.length, 0)
    const metas = await Promise.all(buffers.map((b) => sharp(b).metadata()))
    const sizeFmt = (bytes) => (bytes < 1024 * 1024 ? `${(bytes / 1024).toFixed(1)} KB` : `${(bytes / 1024 / 1024).toFixed(2)} MB`)
    console.log(
      '[extract-from-images] Sent to AI:',
      buffers.map((b, i) => {
        const m = metas[i]
        const px = m?.width != null && m?.height != null ? `${m.width}×${m.height} px` : '?×? px'
        return `image ${i + 1}: ${px}, ${sizeFmt(b.length)}`
      }).join('; '),
      '| total:',
      sizeFmt(totalBytes)
    )
    const { recipe: parsedRecipe, usage } = await extractRecipeFromImages(buffers)
    const updated = recipeService.setRecipeParsedRecipe(id, parsedRecipe, { updateTitle: true })
    if (usage || parsedRecipe) logExtractUsage(id, usage, parsedRecipe)
    res.json({ recipe: updated, usage: usage || null })
  } catch (e) {
    console.error('Extract from images failed:', e)
    try {
      const { getDb } = await import('../db/index.js')
      getDb().prepare(`UPDATE recipes SET extract_status = 'failed', updated_at = ? WHERE id = ?`).run(new Date().toISOString().slice(0, 19).replace('T', ' '), id)
    } catch (_) {}
    res.status(500).json({ error: e.message || 'Extract failed' })
  }
})

export default router
