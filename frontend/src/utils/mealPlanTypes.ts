export const DEFAULT_PLAN_DAY_COUNT = 7
export const MAX_PLAN_DAY_COUNT = 7
export const PLAN_MANY_ENTRIES_HINT = 4

export interface PlanEntry {
  id: string
  recipeId: number
  recipeTitle: string
  recipeImageUrl?: string | null
  servings: number
  sortOrder: number
  role?: 'main' | 'extra'
  addedAt: string
  /** ISO date (plan day) when marked cooked in plan; null = open */
  cookedAt: string | null
}

export interface PlanDay {
  date: string
  entries: PlanEntry[]
}

export interface MealPlan {
  version: 1
  dayCount: number
  days: PlanDay[]
  updatedAt: string
}

export function isRecipePlannable(options: {
  status: string
  wouldCookAgain: string | null | undefined
}): boolean {
  if (options.status !== 'confirmed') return false
  if (options.wouldCookAgain === 'no') return false
  return true
}
