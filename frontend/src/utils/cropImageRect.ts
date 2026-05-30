export type CropContentRect = {
  offsetX: number
  offsetY: number
  width: number
  height: number
}

type ObjectFitMetrics = CropContentRect & {
  scale: number
  clipOffsetX: number
  clipOffsetY: number
}

function readObjectFit(img: HTMLImageElement): string {
  return getComputedStyle(img).objectFit || 'fill'
}

/** Coordinate space for crop points within the img element (handles contain letterboxing). */
export function getObjectFitContentSizeInElement(img: HTMLImageElement): ObjectFitMetrics {
  const elW = img.clientWidth
  const elH = img.clientHeight
  const nw = img.naturalWidth
  const nh = img.naturalHeight
  if (elW <= 0 || elH <= 0 || nw <= 0 || nh <= 0) {
    return { offsetX: 0, offsetY: 0, width: elW, height: elH, scale: 1, clipOffsetX: 0, clipOffsetY: 0 }
  }

  const fit = readObjectFit(img)
  if (fit === 'contain') {
    const scale = Math.min(elW / nw, elH / nh)
    const width = nw * scale
    const height = nh * scale
    return {
      offsetX: (elW - width) / 2,
      offsetY: (elH - height) / 2,
      width,
      height,
      scale,
      clipOffsetX: 0,
      clipOffsetY: 0,
    }
  }

  if (fit === 'cover') {
    const scale = Math.max(elW / nw, elH / nh)
    return {
      offsetX: 0,
      offsetY: 0,
      width: elW,
      height: elH,
      scale,
      clipOffsetX: (elW - nw * scale) / 2,
      clipOffsetY: (elH - nh * scale) / 2,
    }
  }

  return {
    offsetX: 0,
    offsetY: 0,
    width: elW,
    height: elH,
    scale: elW / nw,
    clipOffsetX: 0,
    clipOffsetY: 0,
  }
}

/** @deprecated Use getObjectFitContentSizeInElement */
export function getObjectFitContainContentSize(img: HTMLImageElement): CropContentRect {
  const m = getObjectFitContentSizeInElement(img)
  return { offsetX: m.offsetX, offsetY: m.offsetY, width: m.width, height: m.height }
}

/** Crop overlay rect offset from the wrap top-left. */
export function getCropContentRectInWrap(wrap: HTMLElement, img: HTMLImageElement): CropContentRect {
  const metrics = getObjectFitContentSizeInElement(img)
  const fit = readObjectFit(img)
  const offsetX = img.offsetLeft + metrics.offsetX
  const offsetY = img.offsetTop + metrics.offsetY

  if (fit === 'contain') {
    return {
      offsetX,
      offsetY,
      width: metrics.width,
      height: metrics.height,
    }
  }

  return {
    offsetX,
    offsetY,
    width: metrics.width,
    height: metrics.height,
  }
}

/** Display (content) coords → natural image pixels. */
export function contentPointToNatural(
  contentX: number,
  contentY: number,
  img: HTMLImageElement,
): { x: number; y: number } {
  const fit = readObjectFit(img)
  const metrics = getObjectFitContentSizeInElement(img)
  const nw = img.naturalWidth
  const nh = img.naturalHeight
  if (metrics.width <= 0 || metrics.height <= 0 || nw <= 0 || nh <= 0) {
    return { x: 0, y: 0 }
  }
  if (fit === 'contain') {
    return {
      x: (contentX / metrics.width) * nw,
      y: (contentY / metrics.height) * nh,
    }
  }
  if (fit === 'cover') {
    return {
      x: (contentX - metrics.clipOffsetX) / metrics.scale,
      y: (contentY - metrics.clipOffsetY) / metrics.scale,
    }
  }
  return {
    x: (contentX / metrics.width) * nw,
    y: (contentY / metrics.height) * nh,
  }
}

export function clientToCropContentPoint(
  clientX: number,
  clientY: number,
  wrap: HTMLElement,
  img: HTMLImageElement,
): { x: number; y: number } | null {
  const imgRect = img.getBoundingClientRect()
  const metrics = getObjectFitContentSizeInElement(img)
  const x = clientX - imgRect.left - metrics.offsetX
  const y = clientY - imgRect.top - metrics.offsetY
  const requireInside = readObjectFit(img) === 'contain'
  if (requireInside && (x < 0 || y < 0 || x > metrics.width || y > metrics.height)) return null
  return {
    x: Math.max(0, Math.min(metrics.width, x)),
    y: Math.max(0, Math.min(metrics.height, y)),
  }
}

export function cropContentPointsToNatural(
  points: Array<{ x: number; y: number }>,
  img: HTMLImageElement,
): Array<{ x: number; y: number }> {
  const metrics = getObjectFitContentSizeInElement(img)
  if (metrics.width <= 0 || metrics.height <= 0 || img.naturalWidth <= 0 || img.naturalHeight <= 0) {
    return []
  }
  return points.map((p) => {
    const n = contentPointToNatural(p.x, p.y, img)
    return { x: Math.round(n.x), y: Math.round(n.y) }
  })
}

/** Map natural coords from a downscaled preview to the original file dimensions. */
export function scaleNaturalPointsToSourceSize(
  points: Array<{ x: number; y: number }>,
  previewNaturalW: number,
  previewNaturalH: number,
  sourceW: number,
  sourceH: number,
): Array<{ x: number; y: number }> {
  if (points.length === 0 || previewNaturalW <= 0 || previewNaturalH <= 0) return []
  if (previewNaturalW === sourceW && previewNaturalH === sourceH) return points
  const sx = sourceW / previewNaturalW
  const sy = sourceH / previewNaturalH
  return points.map((p) => ({
    x: Math.round(p.x * sx),
    y: Math.round(p.y * sy),
  }))
}

export async function readImageFileDimensions(
  file: File,
): Promise<{ width: number; height: number } | null> {
  if (!file.type.startsWith('image/')) return null
  try {
    const bitmap = await createImageBitmap(file)
    const dims = { width: bitmap.width, height: bitmap.height }
    bitmap.close()
    return dims
  } catch {
    return null
  }
}

/** Map natural image pixels to overlay display coordinates (inverse of cropContentPointsToNatural). */
export function naturalPointsToDisplay(
  points: Array<{ x: number; y: number }>,
  img: HTMLImageElement,
): Array<{ x: number; y: number }> {
  const fit = readObjectFit(img)
  const metrics = getObjectFitContentSizeInElement(img)
  const nw = img.naturalWidth
  const nh = img.naturalHeight
  if (nw <= 0 || nh <= 0) return []

  if (fit === 'contain') {
    return points.map((p) => ({
      x: (p.x / nw) * metrics.width,
      y: (p.y / nh) * metrics.height,
    }))
  }

  if (fit === 'cover') {
    return points.map((p) => ({
      x: p.x * metrics.scale + metrics.clipOffsetX,
      y: p.y * metrics.scale + metrics.clipOffsetY,
    }))
  }

  return points.map((p) => ({
    x: (p.x / nw) * metrics.width,
    y: (p.y / nh) * metrics.height,
  }))
}
