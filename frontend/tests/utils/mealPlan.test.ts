import { describe, expect, it } from 'vitest'
import { useMealPlan } from '../../src/composables/useMealPlan'
import { addDaysIso, formatPlanDayLabel } from '../../src/utils/mealPlanDates'
import {
  createEmptyMealPlan,
  getVisiblePlanDays,
  normalizeMealPlan,
  sortPlanDaysForDisplay,
} from '../../src/utils/mealPlanStorage'
import { isRecipePlannable } from '../../src/utils/mealPlanTypes'

describe('mealPlanDates', () => {
  it('formats German day labels', () => {
    const label = formatPlanDayLabel('2026-06-26', '2026-06-26')
    expect(label).toContain('heute')
    expect(label).toMatch(/26/)
  })

  it('adds calendar days in local ISO form', () => {
    expect(addDaysIso('2026-06-26', 1)).toBe('2026-06-27')
  })
})

describe('normalizeMealPlan', () => {
  it('keeps past days with entries and fills future window', () => {
    const today = '2026-06-26'
    const plan = normalizeMealPlan(
      {
        version: 1,
        dayCount: 5,
        updatedAt: '2026-06-26T12:00:00.000Z',
        days: [
          {
            date: '2026-06-24',
            entries: [
              {
                id: '1',
                recipeId: 10,
                recipeTitle: 'Pasta',
                servings: 2,
                sortOrder: 0,
                addedAt: '2026-06-24T10:00:00.000Z',
                cookedAt: null,
              },
            ],
          },
          {
            date: '2026-06-26',
            entries: [],
          },
        ],
      },
      today,
    )

    const dates = plan.days.map((d) => d.date)
    expect(dates).toContain('2026-06-24')
    expect(dates).toContain('2026-06-26')
    expect(dates).toContain('2026-07-02')
    expect(dates).not.toContain('2026-06-25')
  })

  it('drops empty past days', () => {
    const today = '2026-06-26'
    const plan = normalizeMealPlan(
      {
        version: 1,
        dayCount: 5,
        updatedAt: '2026-06-26T12:00:00.000Z',
        days: [{ date: '2026-06-20', entries: [] }],
      },
      today,
    )
    expect(plan.days.every((d) => d.date >= today)).toBe(true)
  })
})

describe('getVisiblePlanDays', () => {
  it('matches normalize output length', () => {
    const plan = createEmptyMealPlan(7, '2026-06-26')
    expect(getVisiblePlanDays(plan, '2026-06-26')).toHaveLength(7)
  })

  it('puts today first, then future, then past with entries', () => {
    const today = '2026-06-26'
    const plan = normalizeMealPlan(
      {
        version: 1,
        dayCount: 5,
        updatedAt: '2026-06-26T12:00:00.000Z',
        days: [
          {
            date: '2026-06-24',
            entries: [
              {
                id: '1',
                recipeId: 10,
                recipeTitle: 'Pasta',
                servings: 2,
                sortOrder: 0,
                addedAt: '2026-06-24T10:00:00.000Z',
                cookedAt: null,
              },
            ],
          },
          { date: '2026-06-26', entries: [] },
          { date: '2026-06-27', entries: [] },
        ],
      },
      today,
    )
    const visible = sortPlanDaysForDisplay(plan.days, today)
    expect(visible[0].date).toBe('2026-06-26')
    expect(visible.slice(1, 7).map((d) => d.date)).toEqual([
      '2026-06-27',
      '2026-06-28',
      '2026-06-29',
      '2026-06-30',
      '2026-07-01',
      '2026-07-02',
    ])
    expect(visible[visible.length - 1].date).toBe('2026-06-24')
  })
})

describe('isRecipePlannable', () => {
  it('excludes drafts and would_cook_again no', () => {
    expect(isRecipePlannable({ status: 'confirmed', wouldCookAgain: 'yes' })).toBe(true)
    expect(isRecipePlannable({ status: 'confirmed', wouldCookAgain: 'no' })).toBe(false)
    expect(isRecipePlannable({ status: 'draft', wouldCookAgain: null })).toBe(false)
  })
})

describe('useMealPlan moveEntry', () => {
  it('moves an open entry to another day', () => {
    const { plan, addEntry, moveEntry, refreshPlanWindow } = useMealPlan()
    const today = '2026-06-26'
    refreshPlanWindow()
    addEntry(today, { recipeId: 1, recipeTitle: 'Pasta', servings: 2 })
    const sourceDay = plan.value.days.find((day) => day.date === today)
    const entryId = sourceDay?.entries[0]?.id
    expect(entryId).toBeTruthy()

    const targetDate = addDaysIso(today, 1)
    moveEntry(entryId!, targetDate)

    expect(plan.value.days.find((day) => day.date === today)?.entries ?? []).toHaveLength(0)
    expect(plan.value.days.find((day) => day.date === targetDate)?.entries[0]?.recipeTitle).toBe('Pasta')
  })
})
