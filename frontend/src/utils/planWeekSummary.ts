import { formatPlanDayLabel, isPastIsoDate } from './mealPlanDates'
import type { PlanDay } from './mealPlanTypes'
import type { PlanSuggestionCandidate } from './planSuggestionScore'

export interface PlanDaySuggestionGroup {
  date: string
  label: string
  isEmpty: boolean
  suggestions: PlanSuggestionCandidate[]
}

export interface PlanWeekStats {
  plannedOpenCount: number
  emptyFutureDayCount: number
  futureDayCount: number
  cookedInPlanCount: number
  shoppingEntryCount: number
}

export function computePlanWeekStats(
  days: PlanDay[],
  today: string,
  shoppingEntryCount: number,
): PlanWeekStats {
  let plannedOpenCount = 0
  let cookedInPlanCount = 0
  let emptyFutureDayCount = 0
  let futureDayCount = 0

  for (const day of days) {
    const isPast = isPastIsoDate(day.date, today)
    if (!isPast) {
      futureDayCount += 1
      if (day.entries.length === 0) emptyFutureDayCount += 1
    }
    for (const entry of day.entries) {
      if (entry.cookedAt) cookedInPlanCount += 1
      else plannedOpenCount += 1
    }
  }

  return {
    plannedOpenCount,
    emptyFutureDayCount,
    futureDayCount,
    cookedInPlanCount,
    shoppingEntryCount,
  }
}

/**
 * Group suggestions by day; each recipe appears at most once (first day in order wins).
 */
export function buildDedupedDaySuggestionGroups(
  days: Array<{ date: string; entries: PlanDay['entries']; suggestions: PlanSuggestionCandidate[] }>,
  today: string,
  maxPerDay = 4,
): PlanDaySuggestionGroup[] {
  const seenRecipeIds = new Set<number>()
  const groups: PlanDaySuggestionGroup[] = []

  for (const day of days) {
    if (isPastIsoDate(day.date, today)) continue

    const suggestions: PlanSuggestionCandidate[] = []
    for (const candidate of day.suggestions) {
      if (seenRecipeIds.has(candidate.recipeId)) continue
      if (suggestions.length >= maxPerDay) break
      seenRecipeIds.add(candidate.recipeId)
      suggestions.push(candidate)
    }

    const isEmpty = day.entries.length === 0
    if (suggestions.length > 0 || isEmpty) {
      groups.push({
        date: day.date,
        label: formatPlanDayLabel(day.date, today),
        isEmpty,
        suggestions,
      })
    }
  }

  return groups
}

/** Flat deduplicated suggestion list for the primary suggestions panel. */
export function flattenDedupedSuggestions(groups: PlanDaySuggestionGroup[]): PlanSuggestionCandidate[] {
  const seen = new Set<number>()
  const flat: PlanSuggestionCandidate[] = []
  for (const group of groups) {
    for (const candidate of group.suggestions) {
      if (seen.has(candidate.recipeId)) continue
      seen.add(candidate.recipeId)
      flat.push(candidate)
    }
  }
  return flat
}
