import {
  addDaysIso,
  compareIsoDates,
  eachIsoDateInclusive,
  isPastIsoDate,
  todayIsoDate,
} from './mealPlanDates'
import {
  DEFAULT_PLAN_DAY_COUNT,
  MAX_PLAN_DAY_COUNT,
  type MealPlan,
  type PlanDay,
  type PlanEntry,
} from './mealPlanTypes'

const STORAGE_KEY = 'recipe-library-meal-plan-v1'

function clampDayCount(count: number): number {
  if (!Number.isFinite(count)) return DEFAULT_PLAN_DAY_COUNT
  return Math.min(MAX_PLAN_DAY_COUNT, Math.max(DEFAULT_PLAN_DAY_COUNT, Math.round(count)))
}

function emptyDay(date: string): PlanDay {
  return { date, entries: [] }
}

function sortEntries(entries: PlanEntry[]): PlanEntry[] {
  return [...entries].sort((a, b) => a.sortOrder - b.sortOrder || a.addedAt.localeCompare(b.addedAt))
}

function sortDays(days: PlanDay[]): PlanDay[] {
  return [...days].sort((a, b) => compareIsoDates(a.date, b.date))
}

function daysByDate(days: PlanDay[]): Map<string, PlanDay> {
  const map = new Map<string, PlanDay>()
  for (const day of days) {
    const date = day.date?.trim()
    if (!date) continue
    const existing = map.get(date)
    if (!existing) {
      map.set(date, { date, entries: sortEntries(day.entries ?? []) })
      continue
    }
    existing.entries = sortEntries([...existing.entries, ...(day.entries ?? [])])
  }
  return map
}

/** Ensure today..today+dayCount-1 exist; keep past days that still have entries. */
export function normalizeMealPlan(plan: MealPlan, today = todayIsoDate()): MealPlan {
  const dayCount = clampDayCount(plan.dayCount)
  const windowEnd = addDaysIso(today, dayCount - 1)
  const byDate = daysByDate(plan.days)

  for (const date of eachIsoDateInclusive(today, windowEnd)) {
    if (!byDate.has(date)) byDate.set(date, emptyDay(date))
  }

  const kept: PlanDay[] = []
  for (const [date, day] of byDate.entries()) {
    const inWindow = compareIsoDates(date, today) >= 0 && compareIsoDates(date, windowEnd) <= 0
    const hasEntries = day.entries.length > 0
    if (inWindow || (isPastIsoDate(date, today) && hasEntries)) {
      kept.push({ date, entries: sortEntries(day.entries) })
    }
  }

  return {
    version: 1,
    dayCount,
    days: sortDays(kept),
    updatedAt: new Date().toISOString(),
  }
}

export function createEmptyMealPlan(dayCount = DEFAULT_PLAN_DAY_COUNT, today = todayIsoDate()): MealPlan {
  const count = clampDayCount(dayCount)
  const days: PlanDay[] = []
  for (let i = 0; i < count; i++) {
    days.push(emptyDay(addDaysIso(today, i)))
  }
  return {
    version: 1,
    dayCount: count,
    days,
    updatedAt: new Date().toISOString(),
  }
}

export function getVisiblePlanDays(plan: MealPlan, today = todayIsoDate()): PlanDay[] {
  return sortPlanDaysForDisplay(normalizeMealPlan(plan, today).days, today)
}

/** Today first, then future, then past days with entries (newest past last). */
export function sortPlanDaysForDisplay(days: PlanDay[], today = todayIsoDate()): PlanDay[] {
  const past: PlanDay[] = []
  let todayDay: PlanDay | null = null
  const future: PlanDay[] = []

  for (const day of days) {
    if (day.date === today) todayDay = day
    else if (isPastIsoDate(day.date, today)) past.push(day)
    else future.push(day)
  }

  future.sort((a, b) => compareIsoDates(a.date, b.date))
  past.sort((a, b) => compareIsoDates(a.date, b.date))

  const ordered: PlanDay[] = []
  if (todayDay) ordered.push(todayDay)
  ordered.push(...future)
  ordered.push(...past)
  return ordered
}

export function loadMealPlanFromStorage(today = todayIsoDate()): MealPlan {
  if (typeof localStorage === 'undefined') {
    return createEmptyMealPlan(DEFAULT_PLAN_DAY_COUNT, today)
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return createEmptyMealPlan(DEFAULT_PLAN_DAY_COUNT, today)
    const parsed = JSON.parse(raw) as MealPlan
    if (parsed?.version !== 1 || !Array.isArray(parsed.days)) {
      return createEmptyMealPlan(DEFAULT_PLAN_DAY_COUNT, today)
    }
    return normalizeMealPlan(
      {
        version: 1,
        dayCount: clampDayCount(parsed.dayCount),
        days: parsed.days,
        updatedAt: parsed.updatedAt ?? new Date().toISOString(),
      },
      today,
    )
  } catch {
    return createEmptyMealPlan(DEFAULT_PLAN_DAY_COUNT, today)
  }
}

export function saveMealPlanToStorage(plan: MealPlan) {
  if (typeof localStorage === 'undefined') return
  localStorage.setItem(STORAGE_KEY, JSON.stringify(plan))
}

export { STORAGE_KEY }
