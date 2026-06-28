import { computed, ref, watch } from 'vue'
import type { ShoppingIngredientInput, ShoppingListGroup, ShoppingListItem } from '../utils/shoppingListTypes'
import {
  buildShoppingListItemsFromInputs,
  mergeShoppingItems,
  removeItemById,
  removeRecipeFromItems,
  toggleItemChecked,
} from '../utils/shoppingListMerge'
import { groupShoppingListItems } from '../utils/shoppingListSort'
import { collectSourceRecipes } from '../utils/shoppingListSources'
import { loadShoppingListFromStorage, saveShoppingListToStorage } from '../utils/shoppingListStorage'

const items = ref<ShoppingListItem[]>(loadShoppingListFromStorage())
let persistReady = false

function persist() {
  if (!persistReady) return
  saveShoppingListToStorage(items.value)
}

watch(items, persist, { deep: true })

export function useShoppingList() {
  if (!persistReady) {
    persistReady = true
  }

  const grouped = computed<ShoppingListGroup[]>(() => groupShoppingListItems(items.value))
  const sourceRecipes = computed(() => collectSourceRecipes(items.value))
  const itemCount = computed(() => items.value.length)
  const uncheckedCount = computed(() => items.value.filter((item) => !item.checked).length)
  const isEmpty = computed(() => items.value.length === 0)

  function addIngredients(
    selected: ShoppingIngredientInput[],
    sourceRecipe: { id: number; title: string },
  ): number {
    if (selected.length === 0) return 0
    const additions = buildShoppingListItemsFromInputs(selected, sourceRecipe)
    items.value = mergeShoppingItems(items.value, additions)
    return selected.length
  }

  function clearList() {
    items.value = []
  }

  function toggleChecked(itemId: string) {
    items.value = toggleItemChecked(items.value, itemId)
  }

  function removeItem(itemId: string) {
    items.value = removeItemById(items.value, itemId)
  }

  function removeRecipe(recipeId: number) {
    items.value = removeRecipeFromItems(items.value, recipeId)
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
    addIngredients,
    clearList,
    toggleChecked,
    removeItem,
    removeRecipe,
    recipeIsOnList,
  }
}
