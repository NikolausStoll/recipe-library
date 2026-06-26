import { computed, ref, watch } from 'vue'
import type { ShoppingIngredientInput, ShoppingListGroup, ShoppingListItem } from '../utils/shoppingListTypes'
import { buildShoppingListItemsFromInputs, mergeShoppingItems } from '../utils/shoppingListMerge'
import { groupShoppingListItems } from '../utils/shoppingListSort'
import { collectSourceRecipes } from '../utils/shoppingListSources'

const STORAGE_KEY = 'recipe-library-shopping-list-v1'

const items = ref<ShoppingListItem[]>(loadFromStorage())
let persistReady = false

function loadFromStorage(): ShoppingListItem[] {
  if (typeof localStorage === 'undefined') return []
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as ShoppingListItem[]
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function persist() {
  if (!persistReady) return
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items.value))
}

watch(items, persist, { deep: true })

export function useShoppingList() {
  if (!persistReady) {
    persistReady = true
  }

  const grouped = computed<ShoppingListGroup[]>(() => groupShoppingListItems(items.value))
  const sourceRecipes = computed(() => collectSourceRecipes(items.value))
  const itemCount = computed(() => items.value.length)
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

  return {
    items,
    grouped,
    sourceRecipes,
    itemCount,
    isEmpty,
    addIngredients,
    clearList,
  }
}
