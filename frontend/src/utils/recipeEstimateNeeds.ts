import type { Recipe, RecipeHealthScoreResponse } from '../api/recipes'

type NutritionFields = {
  nutrition_kcal?: number | null
  nutrition_protein?: number | null
  nutrition_carbs?: number | null
  nutrition_fat?: number | null
  parsed_recipe?: { nutritionTotal?: { kcal?: number | null; protein?: number | null; carbs?: number | null; fat?: number | null } | null } | null
}

export function recipeHasNutrition(recipe: NutritionFields | null | undefined): boolean {
  if (!recipe) return false
  const totals = {
    kcal: recipe.nutrition_kcal ?? recipe.parsed_recipe?.nutritionTotal?.kcal ?? null,
    protein: recipe.nutrition_protein ?? recipe.parsed_recipe?.nutritionTotal?.protein ?? null,
    carbs: recipe.nutrition_carbs ?? recipe.parsed_recipe?.nutritionTotal?.carbs ?? null,
    fat: recipe.nutrition_fat ?? recipe.parsed_recipe?.nutritionTotal?.fat ?? null,
  }
  return [totals.kcal, totals.protein, totals.carbs, totals.fat].some(
    (v) => v != null && !Number.isNaN(Number(v))
  )
}

export function recipeNeedsNutritionEstimate(recipe: NutritionFields | null | undefined): boolean {
  return !recipeHasNutrition(recipe)
}

export function recipeNeedsHealthScoreEstimate(
  healthScore: RecipeHealthScoreResponse | null | undefined
): boolean {
  const score = healthScore?.estimate?.healthScore
  return score == null || Number.isNaN(Number(score))
}

export function recipeNeedsTimeEstimate(recipe: {
  prep_time_min?: number | null
  cook_time_min?: number | null
} | null | undefined): boolean {
  if (!recipe) return true
  const prep = recipe.prep_time_min
  const cook = recipe.cook_time_min
  const hasPrep = prep != null && !Number.isNaN(Number(prep)) && Number(prep) > 0
  const hasCook = cook != null && !Number.isNaN(Number(cook)) && Number(cook) > 0
  return !hasPrep || !hasCook
}

export function perServingNutrition(
  recipe: NutritionFields & { servings?: number | null },
  servingsOverride?: number | null
): { kcal: number | null; protein: number | null; carbs: number | null; fat: number | null } {
  const totals = {
    kcal: recipe.nutrition_kcal ?? recipe.parsed_recipe?.nutritionTotal?.kcal ?? null,
    protein: recipe.nutrition_protein ?? recipe.parsed_recipe?.nutritionTotal?.protein ?? null,
    carbs: recipe.nutrition_carbs ?? recipe.parsed_recipe?.nutritionTotal?.carbs ?? null,
    fat: recipe.nutrition_fat ?? recipe.parsed_recipe?.nutritionTotal?.fat ?? null,
  }
  const servings = servingsOverride ?? recipe.servings ?? 1
  const div = (v: number | null) => {
    if (v == null || Number.isNaN(Number(v))) return null
    const n = Number(v)
    return servings > 0 ? Math.round(n / servings) : n
  }
  return {
    kcal: div(totals.kcal),
    protein: div(totals.protein),
    carbs: div(totals.carbs),
    fat: div(totals.fat),
  }
}

export function recipeHasPrepOrCookTimes(recipe: {
  prep_time_min?: number | null
  cook_time_min?: number | null
} | null | undefined): boolean {
  if (!recipe) return false
  const prep = recipe.prep_time_min
  const cook = recipe.cook_time_min
  const hasPrep = prep != null && !Number.isNaN(Number(prep)) && Number(prep) > 0
  const hasCook = cook != null && !Number.isNaN(Number(cook)) && Number(cook) > 0
  return hasPrep || hasCook
}
