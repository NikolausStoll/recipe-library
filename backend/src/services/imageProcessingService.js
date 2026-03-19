import sharp from 'sharp'

/** Max longest side for recipe text images sent to OpenAI (only downscale). */
export const TEXT_IMAGE_MAX_DIMENSION = Number(process.env.TEXT_IMAGE_MAX_DIMENSION) || 1400
export const THUMBNAIL_MAX_DIMENSION = Number(process.env.THUMBNAIL_MAX_DIMENSION) || 600

/**
 * Prepare recipe text image: scale longest side to TEXT_IMAGE_MAX_DIMENSION (only if larger).
 * No deskew – use 4-point perspective crop in the UI before sending.
 * @param {Buffer} buffer
 * @returns {Promise<Buffer>}
 */
export async function prepareTextImage(buffer) {
  const meta = await sharp(buffer).metadata()
  const w = meta.width || 0
  const h = meta.height || 0
  const maxSide = Math.max(w, h)
  if (maxSide <= TEXT_IMAGE_MAX_DIMENSION) {
    return sharp(buffer).png().toBuffer()
  }
  const scale = TEXT_IMAGE_MAX_DIMENSION / maxSide
  return sharp(buffer)
    .resize(Math.round(w * scale), Math.round(h * scale), { fit: 'inside' })
    .png()
    .toBuffer()
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
