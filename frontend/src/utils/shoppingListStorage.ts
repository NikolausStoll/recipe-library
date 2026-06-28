import type { ShoppingContribution, ShoppingListItem } from './shoppingListTypes'
import { finalizeShoppingItem, regroupShoppingItems } from './shoppingListMerge'

const STORAGE_KEY_V2 = 'recipe-library-shopping-list-v2'
const STORAGE_KEY_V1 = 'recipe-library-shopping-list-v1'

type LegacyShoppingListItem = Omit<ShoppingListItem, 'contributions' | 'checked'> & {
  contributions?: ShoppingContribution[]
  checked?: boolean
}

function migrateV1Item(item: LegacyShoppingListItem): ShoppingListItem {
  if (item.contributions?.length) {
    return finalizeShoppingItem({
      id: item.id,
      ingredientName: item.ingredientName,
      category: item.category,
      contributions: item.contributions.map((c) => ({
        ...c,
        amountParts: c.amountParts.map((p) => ({ ...p })),
      })),
      checked: item.checked ?? false,
    })
  }

  const sources =
    item.sourceRecipes?.length > 0 ? item.sourceRecipes : [{ id: 0, title: 'Unbekannt' }]
  const contributions = sources.map((source, index) => ({
    recipeId: source.id,
    recipeTitle: source.title,
    amountParts: index === 0 ? (item.amountParts ?? []).map((p) => ({ ...p })) : [],
  }))

  return finalizeShoppingItem({
    id: item.id,
    ingredientName: item.ingredientName,
    category: item.category,
    contributions,
    checked: false,
  })
}

export function loadShoppingListFromStorage(): ShoppingListItem[] {
  if (typeof localStorage === 'undefined') return []

  try {
    const rawV2 = localStorage.getItem(STORAGE_KEY_V2)
    if (rawV2) {
      const parsed = JSON.parse(rawV2) as LegacyShoppingListItem[]
      if (!Array.isArray(parsed)) return []
      return regroupShoppingItems(parsed.map(migrateV1Item))
    }

    const rawV1 = localStorage.getItem(STORAGE_KEY_V1)
    if (!rawV1) return []
    const parsed = JSON.parse(rawV1) as LegacyShoppingListItem[]
    if (!Array.isArray(parsed)) return []
    return regroupShoppingItems(parsed.map(migrateV1Item))
  } catch {
    return []
  }
}

export function saveShoppingListToStorage(items: ShoppingListItem[]) {
  if (typeof localStorage === 'undefined') return
  localStorage.setItem(STORAGE_KEY_V2, JSON.stringify(items))
  localStorage.removeItem(STORAGE_KEY_V1)
}

export { STORAGE_KEY_V2 }
