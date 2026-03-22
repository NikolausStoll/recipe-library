import fs from 'fs'
import path from 'path'
import { getBaseUploadDir } from './uploadPaths.js'

/**
 * File extension for OpenCV temp input (jpeg → jpg).
 * @param {string} mimetype
 * @returns {string} e.g. jpg, png, webp, gif
 */
export function extFromImageMimetype(mimetype) {
  if (!mimetype || typeof mimetype !== 'string') return 'jpg'
  const m = mimetype.toLowerCase()
  if (m === 'image/png') return 'png'
  if (m === 'image/webp') return 'webp'
  if (m === 'image/gif') return 'gif'
  return 'jpg'
}

/**
 * Extension for cropPerspectiveBuffer (jpeg → jpg).
 * @param {string} fileExt — without dot
 */
export function extForPerspectiveCrop(fileExt) {
  const e = (fileExt || 'jpg').replace(/^\./, '').toLowerCase()
  if (e === 'jpeg') return 'jpg'
  return e === 'png' || e === 'webp' ? e : 'jpg'
}

/**
 * Save raw upload bytes without resize/WebP. Used when user defers crop/finalize.
 * @param {'recipe' | 'source'} kind
 * @param {number} entityId
 * @param {Buffer} buffer
 * @param {string} mimetype
 * @returns {{ url: string, absolutePath: string, ext: string }}
 */
export function savePendingUploadBuffer(kind, entityId, buffer, mimetype) {
  const ext = extFromImageMimetype(mimetype)
  const base = getBaseUploadDir()
  const sub = kind === 'source' ? 'source' : 'recipe'
  const pendingDir = path.join(base, sub, 'pending')
  if (!fs.existsSync(pendingDir)) {
    fs.mkdirSync(pendingDir, { recursive: true })
  }
  const prefix = kind === 'source' ? 'source' : 'recipe'
  const filename = `${prefix}-${entityId}-${Date.now()}.${ext}`
  const absolutePath = path.join(pendingDir, filename)
  fs.writeFileSync(absolutePath, buffer)
  const url = `/uploads/${sub}/pending/${filename}`
  return { url, absolutePath, ext }
}

/**
 * Delete file at URL path if it exists (e.g. old pending or processed image).
 * @param {string | null} imagePath — e.g. /uploads/recipe/pending/recipe-1-....jpg
 */
export function deleteUploadedFileIfExists(imagePath) {
  if (!imagePath || typeof imagePath !== 'string') return
  let relative = imagePath.replace(/^\/+/, '')
  if (relative.startsWith('uploads/')) relative = relative.slice('uploads/'.length)
  const full = path.join(getBaseUploadDir(), relative)
  if (full && fs.existsSync(full)) {
    try {
      fs.unlinkSync(full)
    } catch (err) {
      console.error('Failed to delete upload file:', full, err)
    }
  }
}
