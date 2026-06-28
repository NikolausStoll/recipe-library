import type { ShoppingListItem } from './shoppingListTypes'

/** Unique recipes that contributed ingredients to the current list, sorted by title. */
export function collectSourceRecipes(items: ShoppingListItem[]): { id: number; title: string }[] {
  const byId = new Map<number, string>()
  for (const item of items) {
    for (const contribution of item.contributions ?? []) {
      if (contribution.recipeId === 0) continue
      if (!byId.has(contribution.recipeId)) {
        byId.set(contribution.recipeId, contribution.recipeTitle)
      }
    }
    for (const src of item.sourceRecipes ?? []) {
      if (src.id === 0) continue
      if (!byId.has(src.id)) byId.set(src.id, src.title)
    }
  }
  return [...byId.entries()]
    .map(([id, title]) => ({ id, title }))
    .sort((a, b) => a.title.localeCompare(b.title, 'de', { sensitivity: 'base' }))
}
