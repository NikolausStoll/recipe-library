import { Router } from 'express'
import multer from 'multer'
import path from 'path'
import fs from 'fs'
import sharp from 'sharp'
import * as sourceService from '../services/sourceService.js'
import { cropPerspective, cropPerspectiveBuffer } from '../services/cropPerspectiveService.js'

const router = Router()
const uploadDirRaw = process.env.UPLOAD_DIR || path.join(process.cwd(), 'data', 'uploads')
const uploadDir = path.isAbsolute(uploadDirRaw) ? uploadDirRaw : path.resolve(process.cwd(), uploadDirRaw)
const maxDimension = Number(process.env.IMAGE_MAX_DIMENSION) || 2400
const quality = Number(process.env.IMAGE_QUALITY) || 80

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = /^image\/(jpeg|jpg|png|gif|webp)$/i
    if (allowed.test(file.mimetype)) cb(null, true)
    else cb(new Error('Only image files allowed'))
  },
})

function ensureUploadDir(req, res, next) {
  if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true })
  next()
}

/**
 * GET /api/sources – list all recipe sources (e.g. books).
 */
router.get('/', (req, res) => {
  try {
    const list = sourceService.listSources()
    res.json(list)
  } catch (e) {
    console.error(e)
    res.status(500).json({ error: 'Failed to list sources' })
  }
})

/**
 * GET /api/sources/:id – get one source.
 */
router.get('/:id', (req, res) => {
  const source = sourceService.getSourceById(req.params.id)
  if (!source) return res.status(404).json({ error: 'Source not found' })
  res.json(source)
})

/**
 * POST /api/sources – create source. Body: type, name (title), subtitle?, author?, year?, url?.
 */
router.post('/', (req, res) => {
  const body = req.body || {}
  const name = (body.name ?? body.book_title ?? '').trim()
  if (!name) return res.status(400).json({ error: 'name (or book_title) is required' })
  try {
    const source = sourceService.createSource(body)
    res.status(201).json(source)
  } catch (e) {
    console.error(e)
    res.status(500).json({ error: 'Failed to create source' })
  }
})

/**
 * PUT /api/sources/:id – update source.
 */
router.put('/:id', (req, res) => {
  const source = sourceService.updateSource(req.params.id, req.body || {})
  if (!source) return res.status(404).json({ error: 'Source not found' })
  res.json(source)
})

/**
 * DELETE /api/sources/:id – delete source. Fails if any recipe references it.
 */
router.delete('/:id', (req, res) => {
  const deleted = sourceService.deleteSource(req.params.id)
  if (!deleted) return res.status(400).json({ error: 'Source in use by recipes or not found' })
  res.status(204).send()
})

/**
 * POST /api/sources/:id/cover – upload book cover. Multipart: "image" (file), optional "points" (JSON array of 4 {x,y} for 4-point crop).
 * Order: crop if 4 points, then resize longest side to 2400px, save as WebP. Sets source.image_path.
 */
router.post('/:id/cover', ensureUploadDir, (req, res, next) => {
  upload.single('image')(req, res, (err) => {
    if (err) return res.status(400).json({ error: err.message || 'Upload failed' })
    next()
  })
}, async (req, res) => {
  const id = req.params.id
  const source = sourceService.getSourceById(id)
  if (!source) return res.status(404).json({ error: 'Source not found' })
  if (!req.file) return res.status(400).json({ error: 'No image; use field "image"' })
  let buf = req.file.buffer
  const points = req.body?.points
  if (Array.isArray(points) && points.length === 4) {
    const ext = req.file.mimetype === 'image/png' ? 'png' : req.file.mimetype === 'image/webp' ? 'webp' : 'jpg'
    buf = await cropPerspectiveBuffer(buf, points, ext)
  }
  const filename = `source-${id}-${Date.now()}.webp`
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
    console.error('Cover image failed:', err)
    return res.status(500).json({ error: 'Image processing failed' })
  }
  const imageUrl = `/uploads/${filename}`
  const updated = sourceService.updateSource(id, { image_path: imageUrl })
  res.json({ source: updated, url: imageUrl })
})

export default router
