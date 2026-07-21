import { describe, expect, it } from 'vitest'
import { computeAnchoredPopoverPlacement } from '../../src/utils/planAssignAnchor'

describe('computeAnchoredPopoverPlacement', () => {
  it('places popover below anchor by default', () => {
    const placement = computeAnchoredPopoverPlacement(
      { left: 100, top: 200, width: 120, height: 40 },
      160,
      80,
      800,
      600,
    )
    expect(placement.placement).toBe('bottom')
    expect(placement.top).toBe(248)
    expect(placement.left).toBe(80)
    expect(placement.arrowLeft).toBeGreaterThan(0)
  })

  it('places popover near pointer when click coordinates are provided', () => {
    const placement = computeAnchoredPopoverPlacement(
      { left: 100, top: 200, width: 120, height: 40, pointerX: 180, pointerY: 215 },
      160,
      80,
      800,
      600,
    )
    expect(placement.placement).toBe('bottom')
    expect(placement.top).toBe(223)
    expect(placement.left).toBe(100)
    expect(placement.arrowLeft).toBe(80)
  })

  it('flips above when not enough space below', () => {
    const placement = computeAnchoredPopoverPlacement(
      { left: 100, top: 520, width: 120, height: 40 },
      160,
      80,
      800,
      600,
    )
    expect(placement.placement).toBe('top')
    expect(placement.top).toBeLessThan(520)
  })

  it('keeps popover inside horizontal viewport', () => {
    const placement = computeAnchoredPopoverPlacement(
      { left: 10, top: 100, width: 40, height: 32 },
      200,
      72,
      320,
      600,
    )
    expect(placement.left).toBeGreaterThanOrEqual(8)
    expect(placement.left + 200).toBeLessThanOrEqual(312)
  })
})
