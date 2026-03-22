import { Router } from 'express'
import multer from 'multer'
import path from 'path'
import fs from 'fs'
import * as sourceService from '../services/sourceService.js'
import { cropPerspective, cropPerspectiveBuffer } from '../services/cropPerspectiveService.js'
import { writeResizedWebp } from '../services/imageProcessingService.js'
import { getBaseUploadDir, buildThumbnailPath, resolveUploadedFilePath } from '../utils/uploadPaths.js'
import {
  savePendingUploadBuffer,
  deleteUploadedFileIfExists,
  extForPerspectiveCrop,
} from '../utils/pendingImageUpload.js'

const router = Router()
const baseUploadDir = getBaseUploadDir()
const uploadDir = path.join(baseUploadDir, 'source')
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
 * POST /api/sources/:id/crop-perspective – Finalize deferred cover or re-crop processed WebP (same semantics as recipe).
 */
router.post('/:id/crop-perspective', ensureUploadDir, async (req, res) => {
  const id = req.params.id
  const source = sourceService.getSourceById(id)
  if (!source) return res.status(404).json({ error: 'Source not found' })
  if (!source.image_path) return res.status(400).json({ error: 'Source has no image to crop' })
  const points = req.body?.points
  const pending = source.image_processing_pending === true

  if (pending) {
    const filepath = resolveUploadedFilePath(source.image_path)
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

      const filename = `source-${id}-${Date.now()}.webp`
      const filepathOut = path.join(uploadDir, filename)
      const thumbFilename = `${path.basename(filename, path.extname(filename))}_thumb.webp`
      const thumbPath = path.join(uploadDir, thumbFilename)

      await writeResizedWebp(workBuf, filepathOut, maxDimension, quality)
      await writeResizedWebp(workBuf, thumbPath, 600, quality)

      deleteUploadedFileIfExists(source.image_path)

      const imageUrl = `/uploads/source/${filename}`
      const updated = sourceService.setSourceImagePathAndPending(id, {
        image_path: imageUrl,
        image_processing_pending: false,
      })
      const url = `${imageUrl}?v=${Date.now()}`
      return res.json({ source: updated, url, thumbUrl: `/uploads/source/${thumbFilename}` })
    } catch (e) {
      console.error('Finalize pending source image failed:', e)
      return res.status(500).json({ error: e.message || 'Crop failed' })
    }
  }

  if (!Array.isArray(points) || points.length !== 4) {
    return res.status(400).json({ error: 'Exactly 4 points {x, y} required' })
  }
  const filepath = resolveUploadedFilePath(source.image_path)
  if (!filepath || !fs.existsSync(filepath)) {
    return res.status(404).json({ error: 'Image file not found' })
  }
  try {
    await cropPerspective(filepath, filepath, points)
    try {
      const thumbImagePath = buildThumbnailPath(source.image_path)
      if (thumbImagePath) {
        const thumbFullPath = resolveUploadedFilePath(thumbImagePath)
        if (thumbFullPath) {
          const buffer = await fs.promises.readFile(filepath)
          await writeResizedWebp(buffer, thumbFullPath, 600, quality)
        }
      }
    } catch (thumbErr) {
      console.error('Failed to refresh source thumbnail after cropping:', thumbErr)
    }
    const url = `${source.image_path}?v=${Date.now()}`
    const updated = sourceService.getSourceById(id)
    res.json({ source: updated, url })
  } catch (e) {
    console.error('Source crop perspective failed:', e)
    res.status(500).json({ error: e.message || 'Crop failed' })
  }
})

/**
 * POST /api/sources/:id/cover – upload book cover. Multipart: "image" (file), optional "points", optional "processImageLater".
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

  const processLater =
    req.body?.processImageLater === 'true' ||
    req.body?.processImageLater === '1' ||
    req.body?.processImageLater === true

  if (processLater) {
    if (source.image_path) {
      deleteUploadedFileIfExists(source.image_path)
      const ot = buildThumbnailPath(source.image_path)
      if (ot) deleteUploadedFileIfExists(ot)
    }
    try {
      const { url } = savePendingUploadBuffer('source', Number(id), req.file.buffer, req.file.mimetype)
      const updated = sourceService.setSourceImagePathAndPending(id, {
        image_path: url,
        image_processing_pending: true,
      })
      return res.json({ source: updated, url, thumbUrl: null })
    } catch (e) {
      console.error('Deferred source cover upload failed:', e)
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
  const filename = `source-${id}-${Date.now()}.webp`
  const filepath = path.join(uploadDir, filename)
  const thumbFilename = `${path.basename(filename, path.extname(filename))}_thumb.webp`
  const thumbPath = path.join(uploadDir, thumbFilename)
  try {
    await writeResizedWebp(buf, filepath, maxDimension, quality)
    await writeResizedWebp(buf, thumbPath, 600, quality)
  } catch (err) {
    console.error('Cover image failed:', err)
    try {
      if (fs.existsSync(filepath)) fs.unlinkSync(filepath)
    } catch {}
    try {
      if (fs.existsSync(thumbPath)) fs.unlinkSync(thumbPath)
    } catch {}
    return res.status(500).json({ error: 'Image processing failed' })
  }
  const imageUrl = `/uploads/source/${filename}`
  const thumbUrl = `/uploads/source/${thumbFilename}`
  const oldImagePath = source.image_path
  if (oldImagePath) {
    deleteUploadedFileIfExists(oldImagePath)
    const oldThumbPath = buildThumbnailPath(oldImagePath)
    if (oldThumbPath) deleteUploadedFileIfExists(oldThumbPath)
  }
  const updated = sourceService.setSourceImagePathAndPending(id, {
    image_path: imageUrl,
    image_processing_pending: false,
  })
  res.json({ source: updated, url: imageUrl, thumbUrl })
})

export default router
