import { computed, ref, type Ref } from 'vue'
import { getPlanSuggestionContext, listRecipes, type RecipeListItem } from '../api/recipes'
import { isPastIsoDate } from '../utils/mealPlanDates'
import { getVisiblePlanDays } from '../utils/mealPlanStorage'
import { isRecipePlannable, type MealPlan } from '../utils/mealPlanTypes'
import {
  buildPlanSuggestionsForDay,
  collectNeighborPlanTags,
  getPlannedOpenRecipeIds,
  type PlanSuggestionCandidate,
  type RecipeCookSummary,
} from '../utils/planSuggestionScore'

function parseCookHistory(
  raw: Record<string, RecipeCookSummary>,
): Record<number, RecipeCookSummary> {
  const map: Record<number, RecipeCookSummary> = {}
  for (const [key, value] of Object.entries(raw)) {
    const id = Number(key)
    if (!Number.isFinite(id)) continue
    map[id] = value
  }
  return map
}

function parseHealthScores(raw: Record<string, number>): Record<number, number> {
  const map: Record<number, number> = {}
  for (const [key, value] of Object.entries(raw)) {
    const id = Number(key)
    if (!Number.isFinite(id) || !Number.isFinite(value)) continue
    map[id] = value
  }
  return map
}

export function usePlanSuggestions(plan: Ref<MealPlan>, today: Ref<string>) {
  const recipes = ref<RecipeListItem[]>([])
  const cookHistory = ref<Record<number, RecipeCookSummary>>({})
  const healthScores = ref<Record<number, number>>({})
  const loading = ref(false)
  const error = ref<string | null>(null)
  const hasLoaded = ref(false)

  const plannableRecipeCount = computed(
    () =>
      recipes.value.filter((recipe) =>
        isRecipePlannable({ status: recipe.status, wouldCookAgain: recipe.would_cook_again }),
      ).length,
  )

  const draftRecipeCount = computed(
    () => recipes.value.filter((recipe) => recipe.status === 'draft').length,
  )

  const openPlannedRecipeCount = computed(() => getPlannedOpenRecipeIds(plan.value).size)

  const recipeTagsById = computed(
    () => new Map(recipes.value.map((recipe) => [recipe.id, recipe.tags ?? []])),
  )

  const suggestionInputs = computed(() =>
    recipes.value.map((recipe) => ({
      recipe,
      cookSummary: cookHistory.value[recipe.id] ?? null,
      healthScore: healthScores.value[recipe.id] ?? null,
    })),
  )

  const daySuggestions = computed(() => {
    const inputs = suggestionInputs.value
    const tagsById = recipeTagsById.value
    const currentPlan = plan.value
    const todayStr = today.value

    return getVisiblePlanDays(currentPlan, todayStr)
      .filter((day) => !isPastIsoDate(day.date, todayStr))
      .map((day) => ({
        date: day.date,
        suggestions: buildPlanSuggestionsForDay(inputs, {
          targetDate: day.date,
          today: todayStr,
          plannedOpenRecipeIds: getPlannedOpenRecipeIds(currentPlan),
          neighborTags: collectNeighborPlanTags(day.date, currentPlan, tagsById),
        }),
      }))
  })

  const suggestionLookup = computed(() =>
    Object.fromEntries(daySuggestions.value.map((item) => [item.date, item.suggestions])),
  )

  const totalSuggestionCount = computed(() =>
    daySuggestions.value.reduce((count, item) => count + item.suggestions.length, 0),
  )

  async function refreshSuggestions() {
    loading.value = true
    error.value = null
    try {
      const [recipeList, context] = await Promise.all([listRecipes(), getPlanSuggestionContext()])
      recipes.value = recipeList
      cookHistory.value = parseCookHistory(context.cookHistory)
      healthScores.value = parseHealthScores(context.healthScores)
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Vorschläge konnten nicht geladen werden.'
    } finally {
      loading.value = false
      hasLoaded.value = true
    }
  }

  function suggestionsForDate(date: string): PlanSuggestionCandidate[] {
    return suggestionLookup.value[date] ?? []
  }

  return {
    recipes,
    daySuggestions,
    suggestionLookup,
    suggestionsForDate,
    totalSuggestionCount,
    openPlannedRecipeCount,
    plannableRecipeCount,
    draftRecipeCount,
    hasLoaded,
    refreshSuggestions,
    loading,
    error,
  }
}
