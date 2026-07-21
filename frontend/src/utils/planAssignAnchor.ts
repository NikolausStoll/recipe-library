/** Screen position of the element that opened day assignment. */
export interface PlanAssignAnchor {
  left: number
  top: number
  width: number
  height: number
  /** Click position — popover anchors to pointer when set (desktop). */
  pointerX?: number
  pointerY?: number
}

export function anchorFromMouseEvent(event: MouseEvent): PlanAssignAnchor {
  const pointerX = event.clientX
  const pointerY = event.clientY
  const target = event.currentTarget
  if (target instanceof HTMLElement) {
    const rect = target.getBoundingClientRect()
    return {
      left: rect.left,
      top: rect.top,
      width: rect.width,
      height: rect.height,
      pointerX,
      pointerY,
    }
  }
  return {
    left: pointerX,
    top: pointerY,
    width: 0,
    height: 0,
    pointerX,
    pointerY,
  }
}

export interface AnchoredPopoverPlacement {
  top: number
  left: number
  placement: 'top' | 'bottom'
  arrowLeft: number
}

const VIEWPORT_MARGIN = 8
const ANCHOR_GAP = 8
const ARROW_SIZE = 7

/**
 * Position a popover near an anchor with basic viewport collision handling.
 * When pointerX/pointerY are set, the popover hugs the click location.
 */
export function computeAnchoredPopoverPlacement(
  anchor: PlanAssignAnchor,
  popoverWidth: number,
  popoverHeight: number,
  viewportWidth = typeof window !== 'undefined' ? window.innerWidth : 1024,
  viewportHeight = typeof window !== 'undefined' ? window.innerHeight : 768,
): AnchoredPopoverPlacement {
  const hasPointer = anchor.pointerX != null && anchor.pointerY != null
  const anchorX = hasPointer ? anchor.pointerX! : anchor.left + anchor.width / 2
  const anchorTop = anchor.top
  const anchorBottom = anchor.top + anchor.height
  const refY = hasPointer ? anchor.pointerY! : anchorTop + anchor.height / 2

  let left = anchorX - popoverWidth / 2
  const maxLeft = viewportWidth - popoverWidth - VIEWPORT_MARGIN
  left = Math.min(Math.max(left, VIEWPORT_MARGIN), Math.max(VIEWPORT_MARGIN, maxLeft))

  const spaceBelow = viewportHeight - (hasPointer ? refY : anchorBottom) - VIEWPORT_MARGIN
  const spaceAbove = (hasPointer ? refY : anchorTop) - VIEWPORT_MARGIN
  const preferBottom = spaceBelow >= popoverHeight + ANCHOR_GAP || spaceBelow >= spaceAbove

  let top: number
  let placement: 'top' | 'bottom'
  if (preferBottom) {
    placement = 'bottom'
    top = hasPointer ? refY + ANCHOR_GAP : anchorBottom + ANCHOR_GAP
    if (top + popoverHeight > viewportHeight - VIEWPORT_MARGIN && spaceAbove > spaceBelow) {
      placement = 'top'
      top = hasPointer ? refY - popoverHeight - ANCHOR_GAP : anchorTop - popoverHeight - ANCHOR_GAP
    }
  } else {
    placement = 'top'
    top = hasPointer ? refY - popoverHeight - ANCHOR_GAP : anchorTop - popoverHeight - ANCHOR_GAP
    if (top < VIEWPORT_MARGIN && spaceBelow > spaceAbove) {
      placement = 'bottom'
      top = hasPointer ? refY + ANCHOR_GAP : anchorBottom + ANCHOR_GAP
    }
  }

  top = Math.min(
    Math.max(top, VIEWPORT_MARGIN),
    Math.max(VIEWPORT_MARGIN, viewportHeight - popoverHeight - VIEWPORT_MARGIN),
  )

  const arrowLeft = Math.min(
    Math.max(anchorX - left, ARROW_SIZE + 4),
    popoverWidth - ARROW_SIZE - 4,
  )

  return { top, left, placement, arrowLeft }
}

export { ANCHOR_SIZE }
