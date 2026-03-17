import sharp from 'sharp'

/** Max longest side for recipe text images sent to OpenAI (only downscale). */
export const TEXT_IMAGE_MAX_DIMENSION = Number(process.env.TEXT_IMAGE_MAX_DIMENSION) || 1400

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
