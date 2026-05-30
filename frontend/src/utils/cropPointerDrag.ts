import {
  clientToCropContentPoint,
  contentPointToNatural,
  getCropContentRectInWrap,
} from './cropImageRect'

/**
 * Pointer-based drag for perspective-crop corner handles (mouse, touch, pen).
 * Uses setPointerCapture so the finger can move outside the handle without losing tracking.
 */
export function attachCropPointPointerDrag(
  e: PointerEvent,
  options: {
    wrap: HTMLElement
    image?: HTMLImageElement
    onMove: (x: number, y: number) => void
    /** Called with cleanup when drag starts; call with null when drag ends (internal). */
    onActiveCleanup: (cleanup: (() => void) | null) => void
  }
): void {
  if (e.pointerType === 'mouse' && e.button !== 0) return
  e.preventDefault()
  e.stopPropagation()
  const el = e.currentTarget as HTMLElement
  const { wrap, image, onMove, onActiveCleanup } = options
  const cropImg = (image ?? wrap.querySelector('img')) as HTMLImageElement | null
  el.setPointerCapture(e.pointerId)
  const zoom = 2.2
  const lensSize = 120
  const lensGap = 20
  const lens = document.createElement('div')
  const hasLensImage = cropImg instanceof HTMLImageElement && !!cropImg.currentSrc
  if (hasLensImage) {
    lens.style.position = 'absolute'
    lens.style.width = `${lensSize}px`
    lens.style.height = `${lensSize}px`
    lens.style.borderRadius = '999px'
    lens.style.border = '2px solid rgba(255,255,255,0.95)'
    lens.style.boxShadow = '0 2px 10px rgba(0,0,0,0.35)'
    lens.style.backgroundColor = 'rgba(17, 24, 39, 0.7)'
    lens.style.pointerEvents = 'none'
    lens.style.zIndex = '30'
    lens.style.backgroundRepeat = 'no-repeat'
    lens.style.backgroundImage = `url("${cropImg.currentSrc}")`
    lens.style.overflow = 'hidden'
    const crosshair = document.createElement('div')
    crosshair.style.position = 'absolute'
    crosshair.style.left = '50%'
    crosshair.style.top = '50%'
    crosshair.style.width = '0'
    crosshair.style.height = '0'
    crosshair.style.transform = 'translate(-50%, -50%)'
    const crosshairH = document.createElement('span')
    crosshairH.style.position = 'absolute'
    crosshairH.style.left = '50%'
    crosshairH.style.top = '50%'
    crosshairH.style.width = '28px'
    crosshairH.style.height = '1px'
    crosshairH.style.transform = 'translate(-50%, -50%)'
    crosshairH.style.background = 'var(--color-primary, #ff6b35)'
    crosshairH.style.boxShadow = '0 0 0 1px rgba(0,0,0,0.18)'
    const crosshairV = document.createElement('span')
    crosshairV.style.position = 'absolute'
    crosshairV.style.left = '50%'
    crosshairV.style.top = '50%'
    crosshairV.style.width = '1px'
    crosshairV.style.height = '28px'
    crosshairV.style.transform = 'translate(-50%, -50%)'
    crosshairV.style.background = 'var(--color-primary, #ff6b35)'
    crosshairV.style.boxShadow = '0 0 0 1px rgba(0,0,0,0.18)'
    crosshair.appendChild(crosshairH)
    crosshair.appendChild(crosshairV)
    lens.appendChild(crosshair)
    wrap.appendChild(lens)
  }

  let lensRaf = 0
  const positionLens = (clientX: number, clientY: number) => {
    if (!(cropImg instanceof HTMLImageElement)) {
      return { x: 0, y: 0 }
    }
    const pt = clientToCropContentPoint(clientX, clientY, wrap, cropImg)
    if (!pt) return { x: 0, y: 0 }

    if (hasLensImage && cropImg.naturalWidth > 0 && cropImg.naturalHeight > 0) {
      const wrapRect = wrap.getBoundingClientRect()
      const content = getCropContentRectInWrap(wrap, cropImg)
      const natural = contentPointToNatural(pt.x, pt.y, cropImg)
      const pointerX = content.offsetX + pt.x
      const pointerY = content.offsetY + pt.y
      let lensX = pointerX + lensGap
      let lensY = pointerY + lensGap
      if (lensX + lensSize > wrapRect.width) lensX = pointerX - lensSize - lensGap
      if (lensY + lensSize > wrapRect.height) lensY = pointerY - lensSize - lensGap
      lensX = Math.max(0, Math.min(wrapRect.width - lensSize, lensX))
      lensY = Math.max(0, Math.min(wrapRect.height - lensSize, lensY))
      lens.style.left = `${lensX}px`
      lens.style.top = `${lensY}px`
      lens.style.backgroundSize = `${cropImg.naturalWidth * zoom}px ${cropImg.naturalHeight * zoom}px`
      lens.style.backgroundPosition = `${-natural.x * zoom + lensSize / 2}px ${-natural.y * zoom + lensSize / 2}px`
    }
    return pt
  }

  const move = (ev: PointerEvent) => {
    if (ev.pointerId !== e.pointerId) return
    ev.preventDefault()
    cancelAnimationFrame(lensRaf)
    lensRaf = requestAnimationFrame(() => {
      const pt = positionLens(ev.clientX, ev.clientY)
      onMove(pt.x, pt.y)
    })
  }
  const end = (ev: PointerEvent) => {
    if (ev.pointerId !== e.pointerId) return
    cleanup()
  }
  function cleanup() {
    cancelAnimationFrame(lensRaf)
    el.removeEventListener('pointermove', move)
    el.removeEventListener('pointerup', end)
    el.removeEventListener('pointercancel', end)
    try {
      el.releasePointerCapture(e.pointerId)
    } catch {
      /* already released */
    }
    if (hasLensImage) {
      lens.remove()
    }
    onActiveCleanup(null)
  }
  onActiveCleanup(cleanup)
  el.addEventListener('pointermove', move, { passive: false })
  el.addEventListener('pointerup', end)
  el.addEventListener('pointercancel', end)
}
