import { computed, ref, watch } from 'vue'
import type { ShoppingIngredientInput, ShoppingListGroup, ShoppingListItem } from '../utils/shoppingListTypes'
import { MANUAL_SHOPPING_SOURCE } from '../utils/shoppingListTypes'
import {
  buildShoppingListItemsFromInputs,
  mergeItemsById,
  mergeShoppingItems,
  removeItemById,
  removeRecipeFromItems,
  toggleItemChecked,
} from '../utils/shoppingListMerge'
import { findMergeSuggestions, type MergeSuggestion } from '../utils/shoppingListMergeSuggestions'
import { groupShoppingListItems } from '../utils/shoppingListSort'
import { collectSourceRecipes } from '../utils/shoppingListSources'
import { loadShoppingListFromStorage, saveShoppingListToStorage } from '../utils/shoppingListStorage'

const items = ref<ShoppingListItem[]>(loadShoppingListFromStorage())
const categoryOrderVersion = ref(0)
const dismissedMergeKeys = ref(new Set<string>())
const mergeSheetOpen = ref(false)
let persistReady = false

function mergePairKey(suggestion: MergeSuggestion): string {
  return [suggestion.itemAId, suggestion.itemBId].sort().join('|')
}

function persist() {
  if (!persistReady) return
  saveShoppingListToStorage(items.value)
}

watch(items, persist, { deep: true })

export function useShoppingList() {
  if (!persistReady) {
    persistReady = true
  }

  const grouped = computed<ShoppingListGroup[]>(() => {
    categoryOrderVersion.value
    return groupShoppingListItems(items.value)
  })
  const sourceRecipes = computed(() => collectSourceRecipes(items.value))
  const itemCount = computed(() => items.value.length)
  const uncheckedCount = computed(() => items.value.filter((item) => !item.checked).length)
  const isEmpty = computed(() => items.value.length === 0)
  const mergeSuggestions = computed<MergeSuggestion[]>(() => findMergeSuggestions(items.value))
  const activeMergeSuggestions = computed(() =>
    mergeSuggestions.value.filter((suggestion) => !dismissedMergeKeys.value.has(mergePairKey(suggestion))),
  )

  function openMergeReviewIfNeeded() {
    if (activeMergeSuggestions.value.length > 0) {
      mergeSheetOpen.value = true
    }
  }

  function dismissMergeReview() {
    for (const suggestion of activeMergeSuggestions.value) {
      dismissedMergeKeys.value = new Set(dismissedMergeKeys.value).add(mergePairKey(suggestion))
    }
    mergeSheetOpen.value = false
  }

  function skipMergeSuggestion(index: number) {
    const suggestion = activeMergeSuggestions.value[index]
    if (!suggestion) return
    dismissedMergeKeys.value = new Set(dismissedMergeKeys.value).add(mergePairKey(suggestion))
    if (activeMergeSuggestions.value.length === 0) {
      mergeSheetOpen.value = false
    }
  }

  function bumpCategoryOrder() {
    categoryOrderVersion.value++
  }

  function addIngredients(
    selected: ShoppingIngredientInput[],
    sourceRecipe: { id: number; title: string },
  ): number {
    if (selected.length === 0) return 0
    const additions = buildShoppingListItemsFromInputs(selected, sourceRecipe)
    items.value = mergeShoppingItems(items.value, additions)
    openMergeReviewIfNeeded()
    return selected.length
  }

  function addManualIngredient(ingredientName: string, category: string | null): void {
    const name = ingredientName.trim()
    if (!name) return
    addIngredients(
      [{ ingredientName: name, category, amount: null, amountMax: null, unit: null }],
      MANUAL_SHOPPING_SOURCE,
    )
  }

  function clearList() {
    items.value = []
    dismissedMergeKeys.value = new Set()
    mergeSheetOpen.value = false
  }

  function toggleChecked(itemId: string) {
    items.value = toggleItemChecked(items.value, itemId)
  }

  function removeItem(itemId: string) {
    items.value = removeItemById(items.value, itemId)
  }

  function removeRecipe(recipeId: number) {
    if (recipeId === MANUAL_SHOPPING_SOURCE.id) return
    items.value = removeRecipeFromItems(items.value, recipeId)
  }

  function mergeItems(keepId: string, removeId: string) {
    items.value = mergeItemsById(items.value, keepId, removeId)
    if (activeMergeSuggestions.value.length === 0) {
      mergeSheetOpen.value = false
    }
  }

  function recipeIsOnList(recipeId: number): boolean {
    return sourceRecipes.value.some((recipe) => recipe.id === recipeId)
  }

  return {
    items,
    grouped,
    sourceRecipes,
    itemCount,
    uncheckedCount,
    isEmpty,
    mergeSuggestions,
    activeMergeSuggestions,
    mergeSheetOpen,
    addIngredients,
    addManualIngredient,
    clearList,
    toggleChecked,
    removeItem,
    removeRecipe,
    mergeItems,
    openMergeReviewIfNeeded,
    dismissMergeReview,
    skipMergeSuggestion,
    bumpCategoryOrder,
    recipeIsOnList,
  }
}
