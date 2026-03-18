import { Router } from 'express'
import multer from 'multer'
import path from 'path'
import fs from 'fs'
import sharp from 'sharp'
import { createRecipe } from '../services/recipeService.js'
import { cropPerspectiveBuffer } from '../services/cropPerspectiveService.js'

const router = Router()

const uploadDirRaw = process.env.UPLOAD_DIR || path.join(process.cwd(), 'data', 'uploads')
const baseUploadDir = path.isAbsolute(uploadDirRaw) ? uploadDirRaw : path.resolve(process.cwd(), uploadDirRaw)
const uploadDir = path.join(baseUploadDir, 'recipe')
const maxDimension = Number(process.env.IMAGE_MAX_DIMENSION) || 2400
const quality = Number(process.env.IMAGE_QUALITY) || 80

function ensureUploadDir(req, res, next) {
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true })
  }
  next()
}

const storage = multer.memoryStorage()
const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = /^image\/(jpeg|jpg|png|gif|webp)$/i
    if (allowed.test(file.mimetype)) cb(null, true)
    else cb(new Error('Only image files (JPEG, PNG, GIF, WebP) are allowed'))
  },
})

/**
 * POST /api/upload
 * Step 1: Create draft recipe. Recipe image is optional.
 * - With image: multipart "image" (file), optional "points" (JSON array of 4 {x,y} for 4-point crop).
 *   Crop if 4 points, then resize only down (longest side <= IMAGE_MAX_DIMENSION), save as WebP in data/uploads/recipe. Returns { url, recipe }.
 * - Without image: no file. Creates draft with image_path: null. Returns { recipe }.
 */
router.post('/', ensureUploadDir, (req, res, next) => {
  upload.single('image')(req, res, (err) => {
    if (err) return res.status(400).json({ error: err.message || 'Upload failed' })
    next()
  })
}, async (req, res) => {
  if (!req.file) {
    const recipe = await createRecipe({
      title: 'Rezept aus Bild',
      import_method: 'image',
      image_path: null,
      extract_status: 'pending',
    })
    return res.status(201).json({ recipe })
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

  const filename = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}.webp`
  const filepath = path.join(uploadDir, filename)
  try {
    let pipeline = sharp(buf)
    const meta = await pipeline.metadata()
    const w = meta.width || 0
    const h = meta.height || 0
    if (w > maxDimension || h > maxDimension) {
      const scale = maxDimension / Math.max(w, h)
      pipeline = pipeline.resize(Math.round(w * scale), Math.round(h * scale), { fit: 'inside' })
    }
    await pipeline.webp({ quality }).toFile(filepath)
  } catch (err) {
    console.error('Image processing failed:', err)
    return res.status(500).json({ error: 'Image processing failed' })
  }

  const imageUrl = `/uploads/recipe/${filename}`
  const recipe = await createRecipe({
    title: 'Rezept aus Bild',
    import_method: 'image',
    image_path: imageUrl,
    extract_status: 'pending',
  })

  res.status(201).json({ url: imageUrl, recipe })
})

export default router
