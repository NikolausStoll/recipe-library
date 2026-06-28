import { getIngredientCategoryLabelDe } from '../constants/ingredientCategories'
import { getEffectiveCategoryOrder } from './shoppingCategoryOrderStorage'
import type { ShoppingListGroup, ShoppingListItem } from './shoppingListTypes'

function categorySortIndex(category: string | null, order: string[]): number {
  const key = category?.trim() || 'other'
  const idx = order.indexOf(key)
  return idx === -1 ? order.length : idx
}

export function groupShoppingListItems(items: ShoppingListItem[]): ShoppingListGroup[] {
  const order = getEffectiveCategoryOrder()
  const byCategory = new Map<string, ShoppingListItem[]>()

  for (const item of items) {
    const key = item.category?.trim() || 'other'
    const list = byCategory.get(key) ?? []
    list.push(item)
    byCategory.set(key, list)
  }

  const groups: ShoppingListGroup[] = [...byCategory.entries()].map(([categoryKey, groupItems]) => ({
    categoryKey,
    categoryLabel: getIngredientCategoryLabelDe(categoryKey),
    items: [...groupItems].sort((a, b) =>
      a.ingredientName.localeCompare(b.ingredientName, 'de', { sensitivity: 'base' }),
    ),
  }))

  groups.sort((a, b) => categorySortIndex(a.categoryKey, order) - categorySortIndex(b.categoryKey, order))
  return groups
}
