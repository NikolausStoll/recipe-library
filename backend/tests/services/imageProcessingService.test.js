import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import sharp from 'sharp'
import {
  encodeTextImageWebp,
  prepareTextImage,
  resolveTextImageWebpQuality,
  TEXT_IMAGE_MAX_DIMENSION,
} from '../../src/services/imageProcessingService.js'

describe('imageProcessingService text vision WebP', () => {
  it('resolveTextImageWebpQuality defaults to 90 and clamps', () => {
    const prev = process.env.TEXT_IMAGE_WEBP_QUALITY
    try {
      delete process.env.TEXT_IMAGE_WEBP_QUALITY
      assert.equal(resolveTextImageWebpQuality(), 90)
      process.env.TEXT_IMAGE_WEBP_QUALITY = '95'
      assert.equal(resolveTextImageWebpQuality(), 95)
      process.env.TEXT_IMAGE_WEBP_QUALITY = '0'
      assert.equal(resolveTextImageWebpQuality(), 1)
      process.env.TEXT_IMAGE_WEBP_QUALITY = '200'
      assert.equal(resolveTextImageWebpQuality(), 100)
    } finally {
      if (prev === undefined) delete process.env.TEXT_IMAGE_WEBP_QUALITY
      else process.env.TEXT_IMAGE_WEBP_QUALITY = prev
    }
  })

  it('prepareTextImage returns WebP and downscales when needed', async () => {
    const src = await sharp({
      create: { width: TEXT_IMAGE_MAX_DIMENSION + 400, height: 800, channels: 3, background: '#ffffff' },
    })
      .png()
      .toBuffer()

    const out = await prepareTextImage(src)
    const meta = await sharp(out).metadata()
    assert.equal(meta.format, 'webp')
    assert.ok((meta.width || 0) <= TEXT_IMAGE_MAX_DIMENSION)
    assert.ok((meta.height || 0) <= TEXT_IMAGE_MAX_DIMENSION)
  })

  it('encodeTextImageWebp re-encodes arbitrary buffers to WebP', async () => {
    const png = await sharp({
      create: { width: 40, height: 30, channels: 3, background: '#112233' },
    })
      .png()
      .toBuffer()
    const webp = await encodeTextImageWebp(png)
    const meta = await sharp(webp).metadata()
    assert.equal(meta.format, 'webp')
  })
})
