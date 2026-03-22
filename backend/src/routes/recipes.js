import { Router } from 'express'
import multer from 'multer'
import path from 'path'
import fs from 'fs'
import sharp from 'sharp'
import * as recipeService from '../services/recipeService.js'
import { extractRecipeFromImages, logAiTokenUsage } from '../services/extractRecipeService.js'
import { prepareTextImage, writeResizedWebp } from '../services/imageProcessingService.js'
import { cropPerspective, cropPerspectiveBuffer } from '../services/cropPerspectiveService.js'
import { estimateRecipeNutrition } from '../services/nutritionService.js'
import {
  estimateRecipeHealthScore,
  estimateRecipeHealthScoreById,
  HealthScoreEstimateError,
  buildHealthScorePayload,
} from '../services/recipeHealthScoreService.js'
import { upsertRecipeHealthScore } from '../services/recipeHealthScorePersistence.js'
import { extractRecipeFromUrl } from '../services/recipeUrlExtractService.js'
import { normalizeRecipeWithLLM } from '../services/recipeNormalizationService.js'
import {
  estimateRecipePrepCookTimes,
  normalizeEstimatePayload,
  buildTimeEstimateInput,
} from '../services/recipeTimeEstimateService.js'
import { generateRecipeTags } from '../services/recipeTagGenerationService.js'
import { replaceRecipeTags } from '../services/recipeTagPersistence.js'
import { ALL_ALLOWED_TAGS } from '../constants/recipeTags.js'
import {
  MEAL_TYPES,
  CUISINE_TYPES,
  DISH_TYPES,
  DIET_TYPES,
  CONTEXT_TYPES,
} from '../constants/recipeTags.js'
import { buildThumbnailPath } from '../utils/uploadPaths.js'
import {
  savePendingUploadBuffer,
  deleteUploadedFileIfExists,
  extForPerspectiveCrop,
} from '../utils/pendingImageUpload.js'

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
 * GET /api/recipes/tag-options – controlled tag vocabulary for UI / validation (no AI).
 */
router.get('/tag-options', (req, res) => {
  try {
    res.json({
      groups: {
        meal_type: [...MEAL_TYPES],
        cuisine: [...CUISINE_TYPES],
        dish_type: [...DISH_TYPES],
        diet: [...DIET_TYPES],
        context: [...CONTEXT_TYPES],
      },
      all_allowed: ALL_ALLOWED_TAGS,
    })
  } catch (e) {
    console.error(e)
    res.status(500).json({ error: 'Failed to load tag options' })
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
 * POST /api/recipes/:id/estimate-health-score – practical health score for a saved recipe; result is stored in recipe_health_scores.
 */
router.post('/:id/estimate-health-score', async (req, res) => {
  const id = Number(req.params.id)
  if (!Number.isFinite(id) || id <= 0) {
    return res.status(400).json({ error: 'id must be a positive number' })
  }
  try {
    const result = await estimateRecipeHealthScoreById(id)
    upsertRecipeHealthScore(id, result)
    logAiTokenUsage(id, result.tokenUsage, result.estimate, {
      model: result.model,
      usage_kind: 'health_score',
      request_json: result.requestPayload,
    })
    res.json(result)
  } catch (e) {
    if (e instanceof Error && e.message === 'Recipe not found') {
      return res.status(404).json({ error: 'Recipe not found' })
    }
    if (e instanceof HealthScoreEstimateError && e.tokenUsage) {
      const row = recipeService.getRecipeById(id)
      const requestPayload = row ? buildHealthScorePayload(row) : null
      logAiTokenUsage(id, e.tokenUsage, { error: e.message }, {
        model: e.model,
        usage_kind: 'health_score',
        request_json: requestPayload,
      })
    }
    const msg = e instanceof Error ? e.message : 'Failed to estimate health score'
    const status = msg === 'OPENAI_API_KEY is not set' ? 503 : 502
    console.error('estimate-health-score failed:', e)
    res.status(status).json({ error: msg })
  }
})

/**
 * POST /api/recipes/:id/estimate-times – prep/cook minutes via gpt-4o-mini (separate from vision extract).
 * First call runs the LLM and applies estimates for non-original fields; original fields stay until confirmed via a follow-up request with `use_client_estimate` + `estimate` + `replace_*`.
 */
router.post('/:id/estimate-times', async (req, res) => {
  const id = Number(req.params.id)
  if (!Number.isFinite(id) || id <= 0) {
    return res.status(400).json({ error: 'id must be a positive number' })
  }
  const replacePrep = req.body?.replace_prep_if_original === true
  const replaceCook = req.body?.replace_cook_if_original === true
  const applyPrep = req.body?.apply_prep !== false
  const applyCook = req.body?.apply_cook !== false
  const useClientEstimate = req.body?.use_client_estimate === true

  try {
    const recipe = recipeService.getRecipeById(id)
    if (!recipe) {
      return res.status(404).json({ error: 'Recipe not found' })
    }

    let estimate
    if (useClientEstimate) {
      estimate = normalizeEstimatePayload(req.body?.estimate)
      if (!estimate) {
        return res.status(400).json({ error: 'estimate object is required when use_client_estimate is true' })
      }
    } else {
      estimate = await estimateRecipePrepCookTimes(recipe)
      const logged = {
        prepTimeMinutes: estimate.prepTimeMinutes,
        prepTimeConfidence: estimate.prepTimeConfidence,
        cookTimeMinutes: estimate.cookTimeMinutes,
        cookTimeConfidence: estimate.cookTimeConfidence,
      }
      logAiTokenUsage(id, estimate.tokenUsage, logged, {
        model: estimate.model,
        usage_kind: 'recipe_time_estimate',
        request_json: buildTimeEstimateInput(recipe),
      })
    }

    recipeService.applyRecipeTimeEstimate(id, estimate, {
      replace_prep_if_original: replacePrep,
      replace_cook_if_original: replaceCook,
      apply_prep: applyPrep,
      apply_cook: applyCook,
    })

    const after = recipeService.getRecipeById(id)
    const conflAfter = recipeService.recipeTimeReplaceConflicts(after)
    const logPayload = {
      prepTimeMinutes: estimate.prepTimeMinutes,
      prepTimeConfidence: estimate.prepTimeConfidence,
      cookTimeMinutes: estimate.cookTimeMinutes,
      cookTimeConfidence: estimate.cookTimeConfidence,
    }

    const pendingOriginalReplace = {}
    if (conflAfter.prep && estimate.prepTimeMinutes != null) {
      pendingOriginalReplace.prep = {
        current: after.prep_time_min,
        suggested: estimate.prepTimeMinutes,
        confidence: estimate.prepTimeConfidence,
      }
    }
    if (conflAfter.cook && estimate.cookTimeMinutes != null) {
      pendingOriginalReplace.cook = {
        current: after.cook_time_min,
        suggested: estimate.cookTimeMinutes,
        confidence: estimate.cookTimeConfidence,
      }
    }

    res.json({
      recipe: after,
      estimate: logPayload,
      pendingOriginalReplace:
        Object.keys(pendingOriginalReplace).length > 0 ? pendingOriginalReplace : null,
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Failed to estimate times'
    const status = msg === 'OPENAI_API_KEY is not set' ? 503 : 502
    console.error('estimate-times failed:', e)
    res.status(status).json({ error: msg })
  }
})

/**
 * POST /api/recipes/:id/generate-tags – AI tags from structured recipe data (separate from vision/URL extract). Persists validated tags.
 */
router.post('/:id/generate-tags', async (req, res) => {
  const id = Number(req.params.id)
  if (!Number.isFinite(id) || id <= 0) {
    return res.status(400).json({ error: 'id must be a positive number' })
  }
  try {
    const recipe = recipeService.getRecipeById(id)
    if (!recipe) {
      return res.status(404).json({ error: 'Recipe not found' })
    }
    const result = await generateRecipeTags(recipe)
    replaceRecipeTags(id, result.tags)
    logAiTokenUsage(id, result.tokenUsage, { tags: result.tags, warnings: result.warnings }, {
      model: result.model,
      usage_kind: 'recipe_tag',
      request_json: result.requestPayload != null ? JSON.stringify(result.requestPayload) : null,
    })
    const after = recipeService.getRecipeById(id)
    res.json({
      recipe: after,
      tags: result.tags,
      warnings: result.warnings,
      fallbacks: result.fallbacks,
    })
  } catch (e) {
    console.error('generate-tags failed:', e)
    res.status(500).json({ error: e instanceof Error ? e.message : 'Failed to generate tags' })
  }
})

/**
 * POST /api/recipes/estimate-health-score – health score from a structured recipe object in the body (no DB id).
 * Body: { recipe: object } — same general shape as GET /api/recipes/:id (title, ingredients, recipe_steps, tips, nutrition_*, …).
 */
router.post('/estimate-health-score', async (req, res) => {
  const recipe = req.body?.recipe
  if (!recipe || typeof recipe !== 'object' || Array.isArray(recipe)) {
    return res.status(400).json({ error: 'Body must include a recipe object: { recipe: { ... } }' })
  }
  try {
    const result = await estimateRecipeHealthScore(recipe)
    res.json(result)
  } catch (e) {
    if (e instanceof HealthScoreEstimateError && e.tokenUsage) {
      logAiTokenUsage(null, e.tokenUsage, { error: e.message }, {
        model: e.model,
        usage_kind: 'health_score',
        request_json: buildHealthScorePayload(recipe),
      })
    }
    const msg = e instanceof Error ? e.message : 'Failed to estimate health score'
    const status = msg === 'OPENAI_API_KEY is not set' ? 503 : 502
    console.error('estimate-health-score (body) failed:', e)
    res.status(status).json({ error: msg })
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
    const favoriteOnly =
      req.query.favorite === '1' ||
      req.query.favorite === 'true' ||
      req.query.favorite === 1 ||
      req.query.favorite === true

    const recipes = recipeService.listRecipesWithIngredients({ favoriteOnly })
    res.json(recipes)
  } catch (e) {
    console.error(e)
    res.status(500).json({ error: 'Failed to list recipes with ingredients' })
  }
})

/**
 * POST /api/recipes/:id/favorite – mark/unmark recipe as favorite.
 * Body: { favorite: boolean }
 */
router.post('/:id/favorite', (req, res) => {
  const id = Number(req.params.id)
  const favoriteRaw = req.body?.favorite
  const favorite =
    favoriteRaw === true ||
    favoriteRaw === 1 ||
    favoriteRaw === '1' ||
    favoriteRaw === 'true'

  if (!Number.isFinite(id) || id <= 0) {
    return res.status(400).json({ error: 'id must be a positive number' })
  }
  try {
    const updated = recipeService.setRecipeFavorite(id, favorite)
    res.json({ recipe: updated })
  } catch (e) {
    console.error('setRecipeFavorite failed:', e)
    res.status(500).json({ error: e instanceof Error ? e.message : 'Failed to set favorite' })
  }
})

/**
 * POST /api/recipes/extract-from-url – fetch HTML, extract raw recipe (JSON-LD first, HTML heuristics as fallback).
 * Body: { url: string, normalize?: boolean }. If normalize is true, runs LLM normalization after scrape (requires OPENAI_API_KEY).
 * Returns { source, warnings, fetched_url, recipe } and when normalize: { structured, normalize_model, normalize_usage }.
 */
router.post('/extract-from-url', async (req, res) => {
  const rawUrl = req.body?.url
  const url = rawUrl != null ? String(rawUrl).trim() : ''
  if (!url) {
    return res.status(400).json({ error: 'url is required' })
  }
  const wantNormalize = req.body?.normalize === true || req.body?.normalize === 'true'
  try {
    const result = await extractRecipeFromUrl(url)
    if (!wantNormalize) {
      return res.json(result)
    }
    if (!process.env.OPENAI_API_KEY) {
      return res.status(400).json({
        error: 'normalize requires OPENAI_API_KEY',
        ...result,
      })
    }
    try {
      const { recipe: structured, usage: normalize_usage, model: normalize_model } =
        await normalizeRecipeWithLLM(result.recipe)
      return res.json({
        ...result,
        structured,
        normalize_model,
        normalize_usage: normalize_usage ?? null,
      })
    } catch (normErr) {
      console.error('normalize-from-url failed:', normErr)
      return res.status(500).json({
        error: normErr instanceof Error ? normErr.message : 'Normalization failed',
        ...result,
      })
    }
  } catch (e) {
    console.error('extract-from-url failed:', e)
    res.status(500).json({ error: e instanceof Error ? e.message : 'Extraction failed' })
  }
})

/**
 * POST /api/recipes/import-from-url – scrape URL, normalize with OpenAI, create draft recipe, log each LLM call to ai_token_usage.
 * Body: { url: string }. Returns { recipe, scrape: { source, warnings, fetched_url } }.
 */
router.post('/import-from-url', async (req, res) => {
  const rawUrl = req.body?.url
  const url = rawUrl != null ? String(rawUrl).trim() : ''
  if (!url) {
    return res.status(400).json({ error: 'url is required' })
  }
  if (!process.env.OPENAI_API_KEY) {
    return res.status(400).json({ error: 'OPENAI_API_KEY is required for URL import' })
  }

  let createdId = null
  try {
    const scraped = await extractRecipeFromUrl(url)
    const draftTitle = scraped.recipe?.title?.trim() || 'Imported recipe'
    const draft = recipeService.createRecipe({
      title: draftTitle,
      import_method: 'url',
      description: scraped.fetched_url ? `Imported from ${scraped.fetched_url}` : null,
    })
    createdId = draft.id

    // Store time and image URL metadata directly on the recipe row (not sent to the LLM).
    const imageUrls = Array.isArray(scraped.recipe?.image_urls) ? scraped.recipe.image_urls : []
    const prepMin = scraped.recipe?.prep_time_min ?? null
    const cookMin = scraped.recipe?.cook_time_min ?? null
    recipeService.updateRecipe(createdId, {
      prep_time_min: prepMin,
      cook_time_min: cookMin,
      prep_time_source: prepMin != null && Number.isFinite(Number(prepMin)) ? 'original' : null,
      cook_time_source: cookMin != null && Number.isFinite(Number(cookMin)) ? 'original' : null,
      prep_time_confidence: null,
      cook_time_confidence: null,
      image_urls_json: JSON.stringify(imageUrls),
    })

    const { recipe: structured, attempts } = await normalizeRecipeWithLLM(scraped.recipe)
    if (structured?.recipe && typeof structured.recipe === 'object') {
      structured.recipe.prepTimeMinutes = null
      structured.recipe.cookTimeMinutes = null
    }
    for (const a of attempts) {
      if (a.usage || a.recipe) {
        logAiTokenUsage(createdId, a.usage, a.recipe, {
          model: a.model,
          usage_kind: 'url_recipe_normalize',
          request_json: a.request_json,
        })
      }
    }

    const updated = recipeService.setRecipeParsedRecipe(createdId, structured, { updateTitle: true })
    res.status(201).json({
      recipe: updated,
      scrape: {
        source: scraped.source,
        warnings: scraped.warnings,
        fetched_url: scraped.fetched_url,
      },
    })
  } catch (e) {
    if (createdId != null) {
      try {
        recipeService.deleteRecipe(createdId)
      } catch (_) {}
    }
    console.error('import-from-url failed:', e)
    res.status(500).json({ error: e instanceof Error ? e.message : 'Import failed' })
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
 * POST /api/recipes/:id/crop-perspective – Perspective crop and/or finalize deferred upload.
 * - Processed WebP: Body { points: [ 4× {x,y} ] } — overwrites file, refreshes thumbnail.
 * - Raw pending upload: Body { points?: [ 4× {x,y} ] } — omit points to resize full frame only; then WebP + thumbnail, clears pending.
 * Returns { recipe, url } (url has ?v= for cache bust).
 */
router.post('/:id/crop-perspective', async (req, res) => {
  const id = req.params.id
  const recipe = recipeService.getRecipeById(id)
  if (!recipe) return res.status(404).json({ error: 'Recipe not found' })
  if (!recipe.image_path) return res.status(400).json({ error: 'Recipe has no image to crop' })
  const points = req.body?.points
  const pending = recipe.image_processing_pending === true

  if (pending) {
    const filepath = resolveRecipeImagePath(recipe.image_path)
    if (!filepath || !fs.existsSync(filepath)) {
      return res.status(404).json({ error: 'Image file not found' })
    }
    try {
      const buf = await fs.promises.readFile(filepath)
      const extRaw = path.extname(filepath).replace(/^\./, '') || 'jpg'
      const extCrop = extForPerspectiveCrop(extRaw)
      let workBuf = buf
      if (Array.isArray(points) && points.length === 4) {
        workBuf = await cropPerspectiveBuffer(buf, points, extCrop)
      } else if (points != null && !Array.isArray(points)) {
        return res.status(400).json({ error: 'points must be an array of 4 {x,y} or omitted' })
      } else if (Array.isArray(points) && points.length > 0 && points.length !== 4) {
        return res.status(400).json({ error: 'Provide exactly 4 points or omit for full-frame resize' })
      }

      if (!fs.existsSync(recipeUploadDir)) {
        fs.mkdirSync(recipeUploadDir, { recursive: true })
      }
      const timestamp = Date.now()
      const filename = `recipe-${id}-${timestamp}.webp`
      const filepathOut = path.join(recipeUploadDir, filename)
      const thumbFilename = `${path.basename(filename, path.extname(filename))}_thumb.webp`
      const thumbFilepath = path.join(recipeUploadDir, thumbFilename)

      await writeResizedWebp(workBuf, filepathOut, maxDimension, quality)
      await writeResizedWebp(workBuf, thumbFilepath, 600, quality)

      deleteUploadedFileIfExists(recipe.image_path)

      const imagePath = `/uploads/recipe/${filename}`
      const updated = recipeService.setRecipeImagePathAndPending(id, {
        image_path: imagePath,
        image_processing_pending: false,
      })
      const url = `${imagePath}?v=${Date.now()}`
      return res.json({ recipe: updated, url })
    } catch (e) {
      console.error('Finalize pending recipe image failed:', e)
      return res.status(500).json({ error: e.message || 'Crop failed' })
    }
  }

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
    const updated = recipeService.getRecipeById(id)
    res.json({ recipe: updated, url })
  } catch (e) {
    console.error('Crop perspective failed:', e)
    res.status(500).json({ error: e.message || 'Crop failed' })
  }
})

/**
 * POST /api/recipes/:id/image – Upload or update recipe image.
 * Multipart: "image" (file), optional "points" (JSON 4× {x,y}), optional "processImageLater" (true = store raw, defer WebP/resize).
 * Returns { recipe, url, thumbUrl? }.
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

  const processLater =
    req.body?.processImageLater === 'true' ||
    req.body?.processImageLater === '1' ||
    req.body?.processImageLater === true

  if (processLater) {
    if (recipe.image_path) {
      deleteUploadedFileIfExists(recipe.image_path)
      const oldThumb = buildThumbnailPath(recipe.image_path)
      if (oldThumb) deleteUploadedFileIfExists(oldThumb)
    }
    try {
      const { url } = savePendingUploadBuffer('recipe', Number(id), req.file.buffer, req.file.mimetype)
      const updated = recipeService.setRecipeImagePathAndPending(id, {
        image_path: url,
        image_processing_pending: true,
      })
      return res.json({ recipe: updated, url, thumbUrl: null })
    } catch (e) {
      console.error('Deferred recipe image upload failed:', e)
      return res.status(500).json({ error: e.message || 'Image upload failed' })
    }
  }

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
    deleteUploadedFileIfExists(recipe.image_path)
    const oldThumbPath = buildThumbnailPath(recipe.image_path)
    if (oldThumbPath) deleteUploadedFileIfExists(oldThumbPath)
  }

  const imagePath = `/uploads/recipe/${filename}`
  const updated = recipeService.updateRecipe(id, { image_path: imagePath })
  const thumbUrl = `/uploads/recipe/${thumbFilename}`
  res.json({ recipe: updated, url: imagePath, thumbUrl })
})

/**
 * POST /api/recipes/:id/extract-from-images – Step 2: extract recipe text from image(s) via OpenAI.
 * Body: multipart form with "images" (one or more files) and optional "points" (JSON array: for each image, null or [ {x,y}, {x,y}, {x,y}, {x,y} ] in original coords). If points[i] has 4 points, that image is perspective-cropped, then scaled; then send to AI.
 * Unlike POST /api/upload + processImageLater: files are never written to pending/; multer uses memory only. prepareTextImage runs immediately; buffers are not persisted as recipe assets.
 * Returns { recipe, usage?: { ... } }. Token usage is logged to ai_token_usage.
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
    const visionModel = process.env.OPENAI_EXTRACT_MODEL || 'gpt-4.1-mini'
    if (usage || parsedRecipe) {
      logAiTokenUsage(id, usage, parsedRecipe, { model: visionModel, usage_kind: 'recipe_image_extract' })
    }
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
