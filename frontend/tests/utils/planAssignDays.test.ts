import { describe, expect, it } from 'vitest'
import { buildAssignDayOptions } from '../../src/utils/planAssignDays'
import { formatPlanDayCompactLabel } from '../../src/utils/mealPlanDates'

describe('formatPlanDayCompactLabel', () => {
  const today = '2026-06-26'

  it('labels today and tomorrow compactly', () => {
    expect(formatPlanDayCompactLabel('2026-06-26', today)).toEqual({ label: 'Heute', subLabel: '26' })
    expect(formatPlanDayCompactLabel('2026-06-27', today)).toEqual({ label: 'Morgen', subLabel: '27' })
  })

  it('uses weekday short label for later days', () => {
    expect(formatPlanDayCompactLabel('2026-06-28', today)).toEqual({ label: 'So', subLabel: '28' })
    expect(formatPlanDayCompactLabel('2026-06-29', today)).toEqual({ label: 'Mo', subLabel: '29' })
  })
})

describe('buildAssignDayOptions', () => {
  it('returns future days with compact labels and excludes source day', () => {
    const days = [
      {
        date: '2026-06-25',
        entries: [],
      },
      {
        date: '2026-06-26',
        entries: [
          {
            id: '1',
            recipeId: 1,
            recipeTitle: 'A',
            servings: 2,
            sortOrder: 0,
            addedAt: '2026-06-26T10:00:00.000Z',
            cookedAt: null,
          },
        ],
      },
      { date: '2026-06-27', entries: [] },
      { date: '2026-06-28', entries: [] },
    ]

    const options = buildAssignDayOptions(days, '2026-06-26', '2026-06-26')
    expect(options.map((option) => option.date)).toEqual(['2026-06-27', '2026-06-28'])
    expect(options[0]).toMatchObject({
      compactLabel: 'Morgen',
      subLabel: '27',
      plannedCount: 0,
      isToday: false,
    })
    expect(options[1]).toMatchObject({
      compactLabel: 'So',
      subLabel: '28',
      plannedCount: 0,
    })
  })
})
