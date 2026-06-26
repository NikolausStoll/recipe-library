import { describe, expect, it } from 'vitest'
import type { RecipeHealthScoreResponse } from '../../src/api/recipes'
import {
  perServingNutrition,
  recipeHasNutrition,
  recipeNeedsHealthScoreEstimate,
  recipeNeedsNutritionEstimate,
  recipeNeedsTimeEstimate,
} from '../../src/utils/recipeEstimateNeeds'

function healthScoreStub(score: number): RecipeHealthScoreResponse {
  return {
    estimate: {
      healthScore: score,
      summary: null,
      positives: [],
      concerns: [],
      improvementTips: [],
      confidence: null,
    },
    model: null,
    tokenUsage: null,
  }
}

describe('recipeHasNutrition', () => {
  it('returns true when any macro is present on recipe or parsed_recipe', () => {
    expect(recipeHasNutrition({ nutrition_kcal: 420 })).toBe(true)
    expect(
      recipeHasNutrition({
        parsed_recipe: { nutritionTotal: { protein: 12 } },
      }),
    ).toBe(true)
    expect(recipeHasNutrition({})).toBe(false)
  })
})

describe('recipeNeedsNutritionEstimate', () => {
  it('is true when nutrition is missing', () => {
    expect(recipeNeedsNutritionEstimate({})).toBe(true)
    expect(recipeNeedsNutritionEstimate({ nutrition_kcal: 100 })).toBe(false)
  })
})

describe('recipeNeedsHealthScoreEstimate', () => {
  it('is true when health score is missing', () => {
    expect(recipeNeedsHealthScoreEstimate(null)).toBe(true)
    expect(recipeNeedsHealthScoreEstimate(healthScoreStub(7))).toBe(false)
  })
})

describe('recipeNeedsTimeEstimate', () => {
  it('requires both prep and cook times', () => {
    expect(recipeNeedsTimeEstimate({ prep_time_min: 10 })).toBe(true)
    expect(recipeNeedsTimeEstimate({ prep_time_min: 10, cook_time_min: 20 })).toBe(false)
  })
})

describe('perServingNutrition', () => {
  it('divides totals by servings', () => {
    const result = perServingNutrition(
      { nutrition_kcal: 800, nutrition_protein: 40, servings: 4 },
      4,
    )
    expect(result.kcal).toBe(200)
    expect(result.protein).toBe(10)
  })
})
