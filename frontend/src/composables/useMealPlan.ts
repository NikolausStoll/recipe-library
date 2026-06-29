import { computed, ref, watch } from 'vue'
import { postRecipeCooked } from '../api/recipes'
import {
  formatPlanDateRange,
  compareIsoDates,
  isPastIsoDate,
  isTodayIsoDate,
  todayIsoDate,
} from '../utils/mealPlanDates'
import {
  getVisiblePlanDays,
  loadMealPlanFromStorage,
  normalizeMealPlan,
  saveMealPlanToStorage,
} from '../utils/mealPlanStorage'
import type { MealPlan, PlanDay, PlanEntry } from '../utils/mealPlanTypes'
import { PLAN_MANY_ENTRIES_HINT } from '../utils/mealPlanTypes'

const plan = ref<MealPlan>(loadMealPlanFromStorage())
let persistReady = false

function persist() {
  if (!persistReady) return
  saveMealPlanToStorage(plan.value)
}

watch(plan, persist, { deep: true })

function findDay(date: string): PlanDay | undefined {
  return plan.value.days.find((day) => day.date === date)
}

function nextSortOrder(entries: PlanEntry[]): number {
  if (entries.length === 0) return 0
  return Math.max(...entries.map((e) => e.sortOrder)) + 1
}

export function useMealPlan() {
  if (!persistReady) {
    persistReady = true
  }

  const today = computed(() => todayIsoDate())

  const visibleDays = computed(() => getVisiblePlanDays(plan.value, today.value))

  const dateRangeLabel = computed(() => {
    const days = visibleDays.value
    if (days.length === 0) return ''
    const sortedDates = days.map((d) => d.date).sort(compareIsoDates)
    return formatPlanDateRange(sortedDates[0], sortedDates[sortedDates.length - 1])
  })

  const hasOpenPastEntries = computed(() =>
    visibleDays.value.some(
      (day) => isPastIsoDate(day.date, today.value) && day.entries.some((e) => !e.cookedAt),
    ),
  )

  function refreshPlanWindow() {
    plan.value = normalizeMealPlan(plan.value, today.value)
  }

  function addEntry(
    date: string,
    payload: {
      recipeId: number
      recipeTitle: string
      recipeImageUrl?: string | null
      servings: number
    },
  ) {
    refreshPlanWindow()
    const existingDay = findDay(date)
    const entry: PlanEntry = {
      id: crypto.randomUUID(),
      recipeId: payload.recipeId,
      recipeTitle: payload.recipeTitle.trim(),
      recipeImageUrl: payload.recipeImageUrl ?? null,
      servings: Math.max(1, Math.round(payload.servings)),
      sortOrder: nextSortOrder(existingDay?.entries ?? []),
      addedAt: new Date().toISOString(),
      cookedAt: null,
    }

    const nextDays = existingDay
      ? plan.value.days.map((day) =>
          day.date === date ? { ...day, entries: [...day.entries, entry] } : day,
        )
      : [...plan.value.days, { date, entries: [entry] }]

    plan.value = normalizeMealPlan({ ...plan.value, days: nextDays }, today.value)
  }

  function removeEntry(entryId: string) {
    plan.value = normalizeMealPlan(
      {
        ...plan.value,
        days: plan.value.days.map((day) => ({
          ...day,
          entries: day.entries.filter((e) => e.id !== entryId),
        })),
      },
      today.value,
    )
  }

  async function markEntryCooked(entryId: string): Promise<void> {
    let cookedDate: string | null = null
    let recipeId: number | null = null

    for (const day of plan.value.days) {
      const entry = day.entries.find((e) => e.id === entryId)
      if (entry && !entry.cookedAt) {
        cookedDate = day.date
        recipeId = entry.recipeId
        break
      }
    }
    if (!cookedDate || recipeId == null) return

    await postRecipeCooked(recipeId, { cookedDate })

    plan.value = normalizeMealPlan(
      {
        ...plan.value,
        days: plan.value.days.map((day) => ({
          ...day,
          entries: day.entries.map((entry) =>
            entry.id === entryId ? { ...entry, cookedAt: cookedDate } : entry,
          ),
        })),
      },
      today.value,
    )
  }

  function entryCountForDay(date: string): number {
    return findDay(date)?.entries.length ?? 0
  }

  function showManyEntriesHint(date: string): boolean {
    return entryCountForDay(date) >= PLAN_MANY_ENTRIES_HINT
  }

  function isDayPast(date: string): boolean {
    return isPastIsoDate(date, today.value)
  }

  function isDayToday(date: string): boolean {
    return isTodayIsoDate(date, today.value)
  }

  return {
    plan,
    visibleDays,
    dateRangeLabel,
    hasOpenPastEntries,
    today,
    refreshPlanWindow,
    addEntry,
    removeEntry,
    markEntryCooked,
    showManyEntriesHint,
    isDayPast,
    isDayToday,
  }
}
