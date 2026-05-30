/** Max edge length for UI previews (crop overlay, thumbnails). Original file kept for upload. */
const DEFAULT_PREVIEW_MAX_DIMENSION = 1280

function scaleToFit(
  width: number,
  height: number,
  maxDimension: number,
): { width: number; height: number } {
  const maxEdge = Math.max(width, height)
  if (maxEdge <= maxDimension) return { width, height }
  const scale = maxDimension / maxEdge
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  }
}

/**
 * Downscaled object URL for display. Caller must revoke when done.
 * Falls back to full file blob URL if decode/resize fails.
 */
export async function createPreviewObjectUrl(
  file: File,
  maxDimension = DEFAULT_PREVIEW_MAX_DIMENSION,
): Promise<string> {
  if (!file.type.startsWith('image/')) {
    return URL.createObjectURL(file)
  }

  try {
    const bitmap = await createImageBitmap(file)
    try {
      const { width, height } = scaleToFit(bitmap.width, bitmap.height, maxDimension)
      if (width === bitmap.width && height === bitmap.height) {
        return URL.createObjectURL(file)
      }
      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      const ctx = canvas.getContext('2d')
      if (!ctx) return URL.createObjectURL(file)
      ctx.drawImage(bitmap, 0, 0, width, height)
      const mime = file.type === 'image/png' ? 'image/png' : 'image/jpeg'
      const quality = mime === 'image/png' ? undefined : 0.85
      const blob = await new Promise<Blob | null>((resolve) => {
        canvas.toBlob((b) => resolve(b), mime, quality)
      })
      if (!blob) return URL.createObjectURL(file)
      return URL.createObjectURL(blob)
    } finally {
      bitmap.close()
    }
  } catch {
    return URL.createObjectURL(file)
  }
}
