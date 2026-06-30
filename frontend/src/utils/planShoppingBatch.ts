import { compareIsoDates, todayIsoDate } from './mealPlanDates'
import { getVisiblePlanDays } from './mealPlanStorage'
import type { MealPlan } from './mealPlanTypes'

export interface PlanShoppingBatchItem {
  entryId: string
  recipeId: number
  recipeTitle: string
  servings: number
  planDate: string
}

export type PlanShoppingBatchOptions = {
  /** Include entries already marked cooked in the plan. Default false. */
  includeCooked?: boolean
  today?: string
}

/**
 * Collect plan entries for the shopping batch flow: visible days, sorted by date then sortOrder.
 */
export function collectPlanEntriesForShopping(
  plan: MealPlan,
  options: PlanShoppingBatchOptions = {},
): PlanShoppingBatchItem[] {
  const today = options.today ?? todayIsoDate()
  const includeCooked = options.includeCooked === true
  const days = getVisiblePlanDays(plan, today)
  const items: PlanShoppingBatchItem[] = []

  for (const day of [...days].sort((a, b) => compareIsoDates(a.date, b.date))) {
    const entries = [...day.entries].sort(
      (a, b) => a.sortOrder - b.sortOrder || a.addedAt.localeCompare(b.addedAt),
    )
    for (const entry of entries) {
      if (!includeCooked && entry.cookedAt) continue
      items.push({
        entryId: entry.id,
        recipeId: entry.recipeId,
        recipeTitle: entry.recipeTitle,
        servings: Math.max(1, entry.servings),
        planDate: day.date,
      })
    }
  }

  return items
}
