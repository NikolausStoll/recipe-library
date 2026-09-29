import sharp from 'sharp'

/** Max longest side for recipe text images sent to OpenAI (only downscale). */
export const TEXT_IMAGE_MAX_DIMENSION = Number(process.env.TEXT_IMAGE_MAX_DIMENSION) || 1400
export const THUMBNAIL_MAX_DIMENSION = Number(process.env.THUMBNAIL_MAX_DIMENSION) || 600

/**
 * WebP quality for vision/OCR model inputs (and Observatory artifacts).
 * Default 90 ≈ visually lossless for recipe text; override via TEXT_IMAGE_WEBP_QUALITY.
 * @returns {number}
 */
export function resolveTextImageWebpQuality() {
  const n = Number(process.env.TEXT_IMAGE_WEBP_QUALITY)
  if (Number.isFinite(n)) return Math.min(100, Math.max(1, Math.round(n)))
  return 90
}

/**
 * Encode a buffer as high-quality WebP (same encoding used before vision + Observatory).
 * @param {Buffer} buffer
 * @returns {Promise<Buffer>}
 */
export async function encodeTextImageWebp(buffer) {
  const quality = resolveTextImageWebpQuality()
  return sharp(buffer).webp({ quality, effort: 4 }).toBuffer()
}

/**
 * Prepare recipe text image for vision extract:
 * scale longest side to TEXT_IMAGE_MAX_DIMENSION (only if larger), then high-quality WebP.
 * No deskew – use 4-point perspective crop in the UI before sending.
 * @param {Buffer} buffer
 * @returns {Promise<Buffer>} WebP bytes (same format sent to OpenAI / Observatory)
 */
export async function prepareTextImage(buffer) {
  const meta = await sharp(buffer).metadata()
  const w = meta.width || 0
  const h = meta.height || 0
  const maxSide = Math.max(w, h)
  let pipeline = sharp(buffer)
  if (maxSide > TEXT_IMAGE_MAX_DIMENSION) {
    const scale = TEXT_IMAGE_MAX_DIMENSION / maxSide
    pipeline = pipeline.resize(Math.round(w * scale), Math.round(h * scale), { fit: 'inside' })
  }
  const quality = resolveTextImageWebpQuality()
  return pipeline.webp({ quality, effort: 4 }).toBuffer()
}

/**
 * Encode the buffer as WebP, scaling the longest side to `maxSide` (only if larger),
 * and write the result to `filepath`.
 */
export async function writeResizedWebp(buffer, filepath, maxSide = THUMBNAIL_MAX_DIMENSION, quality = Number(process.env.IMAGE_QUALITY) || 80) {
  let pipeline = sharp(buffer)
  const meta = await pipeline.metadata()
  const w = meta.width || 0
  const h = meta.height || 0
  const longest = Math.max(w, h)
  if (maxSide && longest > maxSide) {
    const scale = maxSide / longest
    pipeline = pipeline.resize(Math.round(w * scale), Math.round(h * scale), { fit: 'inside' })
  }
  await pipeline.webp({ quality }).toFile(filepath)
}
