import { computed, nextTick, ref, type ComputedRef, type Ref } from 'vue'
import { attachCropPointPointerDrag } from '../utils/cropPointerDrag'
import { buildCropPolylinePoints, canShowCropLines, type CropPoint } from '../utils/cropOverlay'
import { createCropDisplaySizeTracker } from '../utils/cropDisplaySize'
import {
  clientToCropContentPoint,
  cropContentPointsToNatural,
  getCropContentRectInWrap,
  scaleNaturalPointsToSourceSize,
} from '../utils/cropImageRect'

export function useCropPerspectiveEditor(options: {
  points: Ref<CropPoint[]>
  maxPoints?: number
  sourceDimensions?: ComputedRef<{ width: number; height: number } | null | undefined>
  onDraggingChange?: (dragging: boolean) => void
  onImageLoad?: () => void
}) {
  const maxPoints = options.maxPoints ?? 4
  const cropWrapRef = ref<HTMLDivElement | null>(null)
  const cropImgRef = ref<HTMLImageElement | null>(null)
  const displaySizeTick = ref(0)
  let cropImgObserver: ResizeObserver | null = null
  const displayTracker = createCropDisplaySizeTracker()
  displayTracker.setOnChange(() => {
    displaySizeTick.value++
  })

  const contentRect = computed(() => {
    void displaySizeTick.value
    const wrap = cropWrapRef.value
    const img = cropImgRef.value
    if (!wrap || !img) return { offsetX: 0, offsetY: 0, width: 0, height: 0 }
    return getCropContentRectInWrap(wrap, img)
  })

  const overlayStyle = computed(() => ({
    left: `${contentRect.value.offsetX}px`,
    top: `${contentRect.value.offsetY}px`,
    width: `${contentRect.value.width}px`,
    height: `${contentRect.value.height}px`,
    right: 'auto',
    bottom: 'auto',
  }))

  const polylinePoints = computed(() => buildCropPolylinePoints(options.points.value))

  const showLines = computed(() => {
    const { width, height } = contentRect.value
    return canShowCropLines(options.points.value.length, width, height)
  })

  function syncDisplay() {
    if (cropWrapRef.value) displayTracker.attachWrap(0, cropWrapRef.value)
    cropImgObserver?.disconnect()
    cropImgObserver = null
    const img = cropImgRef.value
    if (img && typeof ResizeObserver !== 'undefined') {
      cropImgObserver = new ResizeObserver(() => {
        displaySizeTick.value++
      })
      cropImgObserver.observe(img)
    }
  }

  function onImageLoad() {
    nextTick(() => syncDisplay())
    options.onImageLoad?.()
  }

  function onWrapPointerDown(e: PointerEvent, active: boolean) {
    if (!active || options.points.value.length >= maxPoints) return
    if ((e.target as HTMLElement).closest?.('.crop-perspective-editor__point')) return
    if (e.pointerType === 'mouse' && e.button !== 0) return
    const wrap = cropWrapRef.value
    const img = cropImgRef.value
    if (!wrap || !img) return
    const pt = clientToCropContentPoint(e.clientX, e.clientY, wrap, img)
    if (!pt) return
    options.points.value = [...options.points.value, pt]
  }

  function onPointPointerDown(e: PointerEvent, pointIdx: number) {
    const wrap = cropWrapRef.value
    const img = cropImgRef.value
    if (!wrap || !img) return
    options.onDraggingChange?.(true)
    attachCropPointPointerDrag(e, {
      wrap,
      image: img,
      onMove: (x, y) => {
        const pt = options.points.value[pointIdx]
        if (!pt) return
        if (pt.x === x && pt.y === y) return
        pt.x = x
        pt.y = y
      },
      onActiveCleanup: () => {
        options.onDraggingChange?.(false)
      },
    })
  }

  function getNaturalPoints(): CropPoint[] {
    const img = cropImgRef.value
    if (!img || options.points.value.length !== maxPoints) return []
    let natural = cropContentPointsToNatural(options.points.value, img)
    const source = options.sourceDimensions?.value
    if (source && img.naturalWidth > 0 && img.naturalHeight > 0) {
      natural = scaleNaturalPointsToSourceSize(
        natural,
        img.naturalWidth,
        img.naturalHeight,
        source.width,
        source.height,
      )
    }
    return natural
  }

  function dispose() {
    cropImgObserver?.disconnect()
    displayTracker.dispose()
  }

  return {
    cropWrapRef,
    cropImgRef,
    contentRect,
    overlayStyle,
    polylinePoints,
    showLines,
    onImageLoad,
    onWrapPointerDown,
    onPointPointerDown,
    getNaturalPoints,
    dispose,
    syncDisplay,
  }
}
