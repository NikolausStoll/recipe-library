import { getIngredientCategoryLabelDe } from '../constants/ingredientCategories'
import { SHOPPING_CATEGORY_ORDER } from '../constants/shoppingCategoryOrder'
import type { ShoppingListGroup, ShoppingListItem } from './shoppingListTypes'

function categorySortIndex(category: string | null): number {
  const key = category?.trim() || 'other'
  const idx = SHOPPING_CATEGORY_ORDER.indexOf(key as (typeof SHOPPING_CATEGORY_ORDER)[number])
  return idx === -1 ? SHOPPING_CATEGORY_ORDER.length : idx
}

export function groupShoppingListItems(items: ShoppingListItem[]): ShoppingListGroup[] {
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

  groups.sort((a, b) => categorySortIndex(a.categoryKey) - categorySortIndex(b.categoryKey))
  return groups
}
