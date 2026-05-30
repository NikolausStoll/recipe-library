export type CropPoint = { x: number; y: number }

/** SVG polyline `points` for 2–3 open corners or closed quad at 4. */
export function buildCropPolylinePoints(points: CropPoint[]): string {
  if (points.length < 2) return ''
  const open = points.map((p) => `${p.x},${p.y}`).join(' ')
  if (points.length >= 4) {
    const first = points[0]
    return `${open} ${first.x},${first.y}`
  }
  return open
}

export function canShowCropLines(pointCount: number, displayW: number, displayH: number): boolean {
  return pointCount >= 2 && displayW > 0 && displayH > 0
}
