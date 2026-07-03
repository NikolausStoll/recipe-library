import { describe, expect, it } from 'vitest'
import {
  buildDedupedDaySuggestionGroups,
  computePlanWeekStats,
  flattenDedupedSuggestions,
} from '../../src/utils/planWeekSummary'
import type { PlanSuggestionCandidate } from '../../src/utils/planSuggestionScore'

function candidate(id: number, title: string): PlanSuggestionCandidate {
  return {
    recipeId: id,
    recipeTitle: title,
    defaultServings: 2,
    score: 80,
    reasons: ['Gekocht: 0'],
    breakdown: {
      favorite: 0,
      wouldCookAgain: 0,
      frequency: 0,
      recency: 0,
      neverCooked: 1,
      timeFit: 0.5,
      health: 0.5,
      quickEasy: 0,
      passiveCook: 0,
      diversity: 0,
    },
  }
}

describe('computePlanWeekStats', () => {
  it('counts open meals, empty days, and shopping entries', () => {
    const days = [
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
    const stats = computePlanWeekStats(days, '2026-06-26', 3)
    expect(stats.plannedOpenCount).toBe(1)
    expect(stats.emptyFutureDayCount).toBe(2)
    expect(stats.shoppingEntryCount).toBe(3)
  })
})

describe('buildDedupedDaySuggestionGroups', () => {
  it('shows each recipe only once across days', () => {
    const shared = candidate(1, 'Shared')
    const groups = buildDedupedDaySuggestionGroups(
      [
        { date: '2026-06-26', entries: [], suggestions: [shared, candidate(2, 'B')] },
        { date: '2026-06-27', entries: [], suggestions: [shared, candidate(3, 'C')] },
      ],
      '2026-06-26',
      4,
    )
    const allIds = groups.flatMap((group) => group.suggestions.map((s) => s.recipeId))
    expect(new Set(allIds).size).toBe(allIds.length)
    expect(groups[0].suggestions.map((s) => s.recipeId)).toEqual([1, 2])
    expect(groups[1].suggestions.map((s) => s.recipeId)).toEqual([3])
  })
})

describe('flattenDedupedSuggestions', () => {
  it('returns a flat deduplicated list', () => {
    const shared = candidate(1, 'Shared')
    const groups = buildDedupedDaySuggestionGroups(
      [
        { date: '2026-06-26', entries: [], suggestions: [shared, candidate(2, 'B')] },
        { date: '2026-06-27', entries: [], suggestions: [shared, candidate(3, 'C')] },
      ],
      '2026-06-26',
      4,
    )
    expect(flattenDedupedSuggestions(groups).map((s) => s.recipeId)).toEqual([1, 2, 3])
  })
})
