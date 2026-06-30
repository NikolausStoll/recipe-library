import { computed, ref } from 'vue'
import { getRecipe, type Recipe } from '../api/recipes'
import { collectPlanEntriesForShopping, type PlanShoppingBatchItem } from '../utils/planShoppingBatch'
import type { MealPlan } from '../utils/mealPlanTypes'

export interface PlanShoppingBatchResult {
  recipeCount: number
  ingredientCount: number
}

export function usePlanShoppingBatch() {
  const queue = ref<PlanShoppingBatchItem[]>([])
  const activeIndex = ref(-1)
  const loading = ref(false)
  const loadError = ref<string | null>(null)
  const currentRecipe = ref<Recipe | null>(null)
  const ingredientCount = ref(0)
  const result = ref<PlanShoppingBatchResult | null>(null)

  const active = computed(() => activeIndex.value >= 0 && activeIndex.value < queue.value.length)
  const currentItem = computed(() => (active.value ? queue.value[activeIndex.value] : null))
  const batchLabel = computed(() => {
    if (!active.value || queue.value.length <= 1) return null
    return `Rezept ${activeIndex.value + 1} von ${queue.value.length}`
  })

  function reset() {
    queue.value = []
    activeIndex.value = -1
    loading.value = false
    loadError.value = null
    currentRecipe.value = null
  }

  async function loadCurrentRecipe(): Promise<boolean> {
    const item = currentItem.value
    if (!item) return false
    loading.value = true
    loadError.value = null
    currentRecipe.value = null
    try {
      currentRecipe.value = await getRecipe(item.recipeId)
      return true
    } catch {
      loadError.value = `„${item.recipeTitle}“ konnte nicht geladen werden.`
      return false
    } finally {
      loading.value = false
    }
  }

  async function start(plan: MealPlan): Promise<boolean> {
    reset()
    result.value = null
    const items = collectPlanEntriesForShopping(plan)
    if (items.length === 0) return false
    queue.value = items
    activeIndex.value = 0
    ingredientCount.value = 0
    return loadCurrentRecipe()
  }

  async function advance(): Promise<void> {
    if (activeIndex.value + 1 >= queue.value.length) {
      result.value = {
        recipeCount: queue.value.length,
        ingredientCount: ingredientCount.value,
      }
      reset()
      return
    }
    activeIndex.value += 1
    await loadCurrentRecipe()
  }

  function onAdded(count: number) {
    ingredientCount.value += count
    void advance()
  }

  function abort() {
    reset()
  }

  async function skipFailedAndContinue() {
    loadError.value = null
    await advance()
  }

  function dismissResult() {
    result.value = null
  }

  return {
    queue,
    active,
    loading,
    loadError,
    currentRecipe,
    currentItem,
    batchLabel,
    result,
    start,
    onAdded,
    abort,
    skipFailedAndContinue,
    dismissResult,
  }
}
