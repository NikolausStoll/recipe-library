import { Router } from 'express'
import multer from 'multer'
import path from 'path'
import fs from 'fs'
import sharp from 'sharp'
import * as recipeService from '../services/recipeService.js'
import { extractRecipeFromImages, logExtractUsage } from '../services/extractRecipeService.js'
import { prepareTextImage, writeResizedWebp } from '../services/imageProcessingService.js'
import { cropPerspective, cropPerspectiveBuffer } from '../services/cropPerspectiveService.js'
import { estimateRecipeNutrition } from '../services/nutritionService.js'
import { buildThumbnailPath } from '../utils/uploadPaths.js'

const router = Router()
const uploadDirRaw = process.env.UPLOAD_DIR || path.join(process.cwd(), 'data', 'uploads')
const baseUploadDir = path.isAbsolute(uploadDirRaw) ? uploadDirRaw : path.resolve(process.cwd(), uploadDirRaw)
const recipeUploadDir = path.join(baseUploadDir, 'recipe')
const maxDimension = Number(process.env.IMAGE_MAX_DIMENSION) || 2400
const quality = Number(process.env.IMAGE_QUALITY) || 80

/** Resolve image_path (e.g. /uploads/recipe/x.webp or /uploads/x.webp) to absolute file path. */
function resolveRecipeImagePath(imagePath) {
  if (!imagePath || typeof imagePath !== 'string') return null
  const relative = imagePath.replace(/^\/uploads\/?/, '')
  return path.join(baseUploadDir, relative)
}

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
 * POST /api/recipes/:id/estimate-nutrition – estimate nutrition values via AI.
 */
router.post('/:id/estimate-nutrition', async (req, res) => {
  const { id } = req.params
  try {
    const estimation = await estimateRecipeNutrition(id)
    res.json(estimation)
  } catch (e) {
    console.error('Failed to estimate nutrition:', e)
    res.status(500).json({ error: e instanceof Error ? e.message : 'Failed to estimate nutrition' })
  }
})

/**
 * POST /api/recipes/:id/cook – record that the recipe was cooked today.
 */
router.post('/:id/cook', (req, res) => {
  try {
    const history = recipeService.addRecipeHistoryEntry(req.params.id)
    res.json({ history })
  } catch (e) {
    console.error('Failed to add recipe history:', e)
    res.status(500).json({ error: e instanceof Error ? e.message : 'Failed to record cooking history' })
  }
})

/**
 * GET /api/recipes/:id/history – list cooking dates.
 */
router.get('/:id/history', (req, res) => {
  try {
    const history = recipeService.listRecipeHistory(req.params.id)
    res.json({ history })
  } catch (e) {
    console.error('Failed to fetch recipe history:', e)
    res.status(500).json({ error: e instanceof Error ? e.message : 'Failed to load cooking history' })
  }
})

/**
 * GET /api/recipes/with-ingredients – list recipes with flattened ingredients for client filtering.
 */
router.get('/with-ingredients', (req, res) => {
  try {
    const recipes = recipeService.listRecipesWithIngredients()
    res.json(recipes)
  } catch (e) {
    console.error(e)
    res.status(500).json({ error: 'Failed to list recipes with ingredients' })
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
    // Handle image deletion: if image_path is explicitly null, delete the old image file
    if (body.image_path === null) {
      const existingRecipe = recipeService.getRecipeById(req.params.id)
      if (existingRecipe?.image_path) {
        const oldFilepath = resolveRecipeImagePath(existingRecipe.image_path)
        if (oldFilepath && fs.existsSync(oldFilepath)) {
          try {
            fs.unlinkSync(oldFilepath)
          } catch (err) {
            console.error('Failed to delete old image file:', err)
          }
        }
        const oldThumbPath = resolveRecipeImagePath(buildThumbnailPath(existingRecipe.image_path))
        if (oldThumbPath && fs.existsSync(oldThumbPath)) {
          try {
            fs.unlinkSync(oldThumbPath)
          } catch (err) {
            console.error('Failed to delete old thumbnail file:', err)
          }
        }
      }
    }

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
  const filepath = resolveRecipeImagePath(recipe.image_path)
  if (!filepath || !fs.existsSync(filepath)) {
    return res.status(404).json({ error: 'Image file not found' })
  }
  try {
    await cropPerspective(filepath, filepath, points)
    try {
      const thumbImagePath = buildThumbnailPath(recipe.image_path)
      if (thumbImagePath) {
        const thumbFullPath = resolveRecipeImagePath(thumbImagePath)
        if (thumbFullPath) {
          const buffer = await fs.promises.readFile(filepath)
          await writeResizedWebp(buffer, thumbFullPath, 600, quality)
        }
      }
    } catch (thumbErr) {
      console.error('Failed to refresh thumbnail after cropping:', thumbErr)
    }
    const url = `${recipe.image_path}?v=${Date.now()}`
    res.json({ recipe, url })
  } catch (e) {
    console.error('Crop perspective failed:', e)
    res.status(500).json({ error: e.message || 'Crop failed' })
  }
})

/**
 * POST /api/recipes/:id/image – Upload or update recipe image.
 * Body: multipart "image" (file), optional "points" (JSON array of 4 {x,y} for 4-point crop).
 * Crop if 4 points, then resize only down (longest side <= IMAGE_MAX_DIMENSION), save as WebP in data/uploads/recipe.
 * Returns { recipe, url }.
 */
router.post('/:id/image', (req, res, next) => {
  upload.single('image')(req, res, (err) => {
    if (err) return res.status(400).json({ error: err.message || 'Upload failed' })
    next()
  })
}, async (req, res) => {
  const id = req.params.id
  const recipe = recipeService.getRecipeById(id)
  if (!recipe) return res.status(404).json({ error: 'Recipe not found' })
  if (!req.file) return res.status(400).json({ error: 'No image file provided' })

  let buf = req.file.buffer
  let points = req.body?.points
  if (typeof points === 'string') {
    try {
      points = JSON.parse(points)
    } catch {
      points = undefined
    }
  }
  if (Array.isArray(points) && points.length === 4) {
    const ext = req.file.mimetype === 'image/png' ? 'png' : req.file.mimetype === 'image/webp' ? 'webp' : 'jpg'
    buf = await cropPerspectiveBuffer(buf, points, ext)
  }

  if (!fs.existsSync(recipeUploadDir)) {
    fs.mkdirSync(recipeUploadDir, { recursive: true })
  }

  const timestamp = Date.now()
  const filename = `recipe-${id}-${timestamp}.webp`
  const filepath = path.join(recipeUploadDir, filename)
  const thumbFilename = `${path.basename(filename, path.extname(filename))}_thumb.webp`
  const thumbFilepath = path.join(recipeUploadDir, thumbFilename)

  try {
    await writeResizedWebp(buf, filepath, maxDimension, quality)
    await writeResizedWebp(buf, thumbFilepath, 600, quality)
  } catch (e) {
    console.error('Image upload failed:', e)
    try {
      if (fs.existsSync(filepath)) fs.unlinkSync(filepath)
    } catch {}
    try {
      if (fs.existsSync(thumbFilepath)) fs.unlinkSync(thumbFilepath)
    } catch {}
    return res.status(500).json({ error: e.message || 'Image upload failed' })
  }

  if (recipe.image_path) {
    const oldFilepath = resolveRecipeImagePath(recipe.image_path)
    if (oldFilepath && fs.existsSync(oldFilepath)) {
      try {
        fs.unlinkSync(oldFilepath)
      } catch (err) {
        console.error('Failed to delete old recipe image:', err)
      }
    }
    const oldThumbPath = resolveRecipeImagePath(buildThumbnailPath(recipe.image_path))
    if (oldThumbPath && fs.existsSync(oldThumbPath)) {
      try {
        fs.unlinkSync(oldThumbPath)
      } catch (err) {
        console.error('Failed to delete old recipe thumbnail:', err)
      }
    }
  }

  const imagePath = `/uploads/recipe/${filename}`
  const updated = recipeService.updateRecipe(id, { image_path: imagePath })
  const thumbUrl = `/uploads/recipe/${thumbFilename}`
  res.json({ recipe: updated, url: imagePath, thumbUrl })
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
