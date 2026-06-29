import { describe, expect, it } from 'vitest'
import {
  buildPlanSuggestionsForDay,
  planDayTimeContext,
  scoreRecipeForPlanDay,
  type PlanSuggestionInput,
  type PlanSuggestionRecipe,
} from '../../src/utils/planSuggestionScore'

function recipe(overrides: Partial<PlanSuggestionRecipe> = {}): PlanSuggestionRecipe {
  return {
    id: 1,
    title: 'Test',
    favorite: false,
    would_cook_again: null,
    status: 'confirmed',
    tags: [],
    prep_time_min: 20,
    cook_time_min: 20,
    servings: 2,
    ...overrides,
  }
}

function input(
  recipeOverrides: Partial<PlanSuggestionRecipe> = {},
  extras: Partial<PlanSuggestionInput> = {},
): PlanSuggestionInput {
  return {
    recipe: recipe(recipeOverrides),
    cookSummary: extras.cookSummary ?? null,
    healthScore: extras.healthScore ?? null,
  }
}

describe('planDayTimeContext', () => {
  it('detects weekday, friday, and weekend', () => {
    expect(planDayTimeContext('2026-06-26')).toBe('friday')
    expect(planDayTimeContext('2026-06-27')).toBe('weekend')
    expect(planDayTimeContext('2026-06-29')).toBe('weekday')
  })
})

describe('scoreRecipeForPlanDay', () => {
  const baseContext = {
    targetDate: '2026-06-29',
    today: '2026-06-26',
    plannedOpenRecipeIds: new Set<number>(),
    neighborTags: [] as string[],
  }

  it('excludes drafts and would_cook_again no', () => {
    expect(
      scoreRecipeForPlanDay(input({ status: 'draft' }), baseContext),
    ).toBeNull()
    expect(
      scoreRecipeForPlanDay(input({ would_cook_again: 'no' }), baseContext),
    ).toBeNull()
  })

  it('excludes recipes already anywhere in the open plan', () => {
    const scored = scoreRecipeForPlanDay(input({ id: 5 }), {
      ...baseContext,
      plannedOpenRecipeIds: new Set([5]),
    })
    expect(scored).toBeNull()
  })

  it('prefers quick recipes on weekdays over slow ones', () => {
    const quick = scoreRecipeForPlanDay(
      input({ id: 1, title: 'Quick', prep_time_min: 10, cook_time_min: 15, tags: ['quick', 'easy'] }),
      { ...baseContext, targetDate: '2026-06-29' },
    )
    const slow = scoreRecipeForPlanDay(
      input({ id: 2, title: 'Slow', prep_time_min: 40, cook_time_min: 120 }),
      { ...baseContext, targetDate: '2026-06-29' },
    )
    expect(quick!.score).toBeGreaterThan(slow!.score)
  })

  it('boosts favorites and never-cooked recipes', () => {
    const plain = scoreRecipeForPlanDay(
      input({ id: 1 }, { cookSummary: { cookCount: 5, lastCookedDate: '2026-06-20' } }),
      baseContext,
    )
    const favorite = scoreRecipeForPlanDay(
      input({ id: 2, favorite: true }, { cookSummary: { cookCount: 5, lastCookedDate: '2026-06-20' } }),
      baseContext,
    )
    const neverCooked = scoreRecipeForPlanDay(
      input({ id: 3 }, { cookSummary: { cookCount: 0, lastCookedDate: null } }),
      baseContext,
    )
    expect(favorite!.score).toBeGreaterThan(plain!.score)
    expect(neverCooked!.score).toBeGreaterThan(plain!.score)
    expect(neverCooked!.reasons).toContain('Gekocht: 0')
    expect(plain!.reasons.some((r) => r.startsWith('Gekocht:'))).toBe(true)
  })
})

describe('buildPlanSuggestionsForDay', () => {
  it('ranks eligible recipes and respects limit', () => {
    const context = {
      targetDate: '2026-06-29',
      today: '2026-06-26',
      plannedOpenRecipeIds: new Set<number>(),
      neighborTags: [] as string[],
    }
    const results = buildPlanSuggestionsForDay(
      [
        input({ id: 1, title: 'A', favorite: false }),
        input({ id: 2, title: 'B', favorite: true }),
        input({ id: 3, title: 'C', status: 'draft' }),
      ],
      context,
      2,
    )
    expect(results).toHaveLength(2)
    expect(results[0].recipeId).toBe(2)
  })

  it('penalizes cuisine overlap with neighbor days', () => {
    const context = {
      targetDate: '2026-06-29',
      today: '2026-06-26',
      plannedOpenRecipeIds: new Set<number>(),
      neighborTags: ['italian', 'pasta'],
    }
    const italian = scoreRecipeForPlanDay(
      input({ id: 1, tags: ['italian', 'pasta'] }),
      context,
    )
    const asian = scoreRecipeForPlanDay(
      input({ id: 2, tags: ['asian', 'ramen'] }),
      context,
    )
    expect(asian!.score).toBeGreaterThan(italian!.score)
  })
})
