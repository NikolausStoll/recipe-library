import fs from 'fs'
import path from 'path'

const defaultUploadDir = path.resolve(process.cwd(), 'data', 'uploads')
const uploadDirRaw = process.env.UPLOAD_DIR || defaultUploadDir
const baseUploadDir = path.isAbsolute(uploadDirRaw) ? uploadDirRaw : path.resolve(process.cwd(), uploadDirRaw)

export function getBaseUploadDir() {
  return baseUploadDir
}

export function resolveUploadedFilePath(imagePath) {
  if (!imagePath || typeof imagePath !== 'string') return null
  let relative = imagePath.replace(/^\/+/, '')
  // URLs are /uploads/recipe/... but files live directly under UPLOAD_DIR (recipe/..., source/...)
  if (relative.startsWith('uploads/')) {
    relative = relative.slice('uploads/'.length)
  }
  return path.join(baseUploadDir, relative)
}

export function buildThumbnailPath(imagePath) {
  if (!imagePath || typeof imagePath !== 'string') return null
  const ext = path.extname(imagePath) || ''
  const base = imagePath.slice(0, imagePath.length - ext.length)
  const dir = path.dirname(imagePath)
  return `${dir}/${path.basename(base)}_thumb${ext}`
}

export function resolveThumbnailFilePath(imagePath) {
  const thumbPath = buildThumbnailPath(imagePath)
  if (!thumbPath) return null
  return resolveUploadedFilePath(thumbPath)
}

export function getThumbnailPathIfExists(imagePath) {
  const thumbPath = buildThumbnailPath(imagePath)
  const fullPath = resolveThumbnailFilePath(imagePath)
  if (thumbPath && fullPath && fs.existsSync(fullPath)) {
    return thumbPath
  }
  return null
}
