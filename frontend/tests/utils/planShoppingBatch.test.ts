import { describe, expect, it } from 'vitest'
import { collectPlanEntriesForShopping } from '../../src/utils/planShoppingBatch'
import type { MealPlan } from '../../src/utils/mealPlanTypes'

function plan(overrides: Partial<MealPlan> = {}): MealPlan {
  return {
    version: 1,
    dayCount: 7,
    days: [],
    updatedAt: '2026-06-26T10:00:00.000Z',
    ...overrides,
  }
}

describe('collectPlanEntriesForShopping', () => {
  it('returns open entries sorted by day then sortOrder', () => {
    const items = collectPlanEntriesForShopping(
      plan({
        days: [
          {
            date: '2026-06-28',
            entries: [
              {
                id: 'b',
                recipeId: 2,
                recipeTitle: 'B',
                servings: 2,
                sortOrder: 1,
                addedAt: '2026-06-26T10:00:00.000Z',
                cookedAt: null,
              },
            ],
          },
          {
            date: '2026-06-26',
            entries: [
              {
                id: 'a1',
                recipeId: 1,
                recipeTitle: 'A late',
                servings: 4,
                sortOrder: 1,
                addedAt: '2026-06-26T11:00:00.000Z',
                cookedAt: null,
              },
              {
                id: 'a0',
                recipeId: 3,
                recipeTitle: 'A early',
                servings: 3,
                sortOrder: 0,
                addedAt: '2026-06-26T09:00:00.000Z',
                cookedAt: null,
              },
            ],
          },
        ],
      }),
      { today: '2026-06-26' },
    )

    expect(items.map((item) => item.entryId)).toEqual(['a0', 'a1', 'b'])
    expect(items[0].servings).toBe(3)
    expect(items[2].planDate).toBe('2026-06-28')
  })

  it('skips cooked entries by default', () => {
    const items = collectPlanEntriesForShopping(
      plan({
        days: [
          {
            date: '2026-06-26',
            entries: [
              {
                id: 'open',
                recipeId: 1,
                recipeTitle: 'Open',
                servings: 2,
                sortOrder: 0,
                addedAt: '2026-06-26T10:00:00.000Z',
                cookedAt: null,
              },
              {
                id: 'done',
                recipeId: 2,
                recipeTitle: 'Done',
                servings: 2,
                sortOrder: 1,
                addedAt: '2026-06-26T10:00:00.000Z',
                cookedAt: '2026-06-26',
              },
            ],
          },
        ],
      }),
      { today: '2026-06-26' },
    )

    expect(items).toHaveLength(1)
    expect(items[0].entryId).toBe('open')
  })

  it('can include cooked entries when requested', () => {
    const items = collectPlanEntriesForShopping(
      plan({
        days: [
          {
            date: '2026-06-26',
            entries: [
              {
                id: 'done',
                recipeId: 2,
                recipeTitle: 'Done',
                servings: 2,
                sortOrder: 0,
                addedAt: '2026-06-26T10:00:00.000Z',
                cookedAt: '2026-06-26',
              },
            ],
          },
        ],
      }),
      { today: '2026-06-26', includeCooked: true },
    )

    expect(items).toHaveLength(1)
  })
})
