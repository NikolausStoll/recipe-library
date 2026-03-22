/**
 * Pointer-based drag for perspective-crop corner handles (mouse, touch, pen).
 * Uses setPointerCapture so the finger can move outside the handle without losing tracking.
 */
export function attachCropPointPointerDrag(
  e: PointerEvent,
  options: {
    wrap: HTMLElement
    onMove: (x: number, y: number) => void
    /** Called with cleanup when drag starts; call with null when drag ends (internal). */
    onActiveCleanup: (cleanup: (() => void) | null) => void
  }
): void {
  if (e.pointerType === 'mouse' && e.button !== 0) return
  e.preventDefault()
  e.stopPropagation()
  const el = e.currentTarget as HTMLElement
  const { wrap, onMove, onActiveCleanup } = options
  el.setPointerCapture(e.pointerId)

  const move = (ev: PointerEvent) => {
    if (ev.pointerId !== e.pointerId) return
    ev.preventDefault()
    const r = wrap.getBoundingClientRect()
    const x = Math.max(0, Math.min(r.width, ev.clientX - r.left))
    const y = Math.max(0, Math.min(r.height, ev.clientY - r.top))
    onMove(x, y)
  }
  const end = (ev: PointerEvent) => {
    if (ev.pointerId !== e.pointerId) return
    cleanup()
  }
  function cleanup() {
    el.removeEventListener('pointermove', move)
    el.removeEventListener('pointerup', end)
    el.removeEventListener('pointercancel', end)
    try {
      el.releasePointerCapture(e.pointerId)
    } catch {
      /* already released */
    }
    onActiveCleanup(null)
  }
  onActiveCleanup(cleanup)
  el.addEventListener('pointermove', move, { passive: false })
  el.addEventListener('pointerup', end)
  el.addEventListener('pointercancel', end)
}
