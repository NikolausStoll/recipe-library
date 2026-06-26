import type { ShoppingListItem } from './shoppingListTypes'

/** Unique recipes that contributed ingredients to the current list, sorted by title. */
export function collectSourceRecipes(items: ShoppingListItem[]): { id: number; title: string }[] {
  const byId = new Map<number, string>()
  for (const item of items) {
    for (const src of item.sourceRecipes) {
      if (!byId.has(src.id)) byId.set(src.id, src.title)
    }
  }
  return [...byId.entries()]
    .map(([id, title]) => ({ id, title }))
    .sort((a, b) => a.title.localeCompare(b.title, 'de', { sensitivity: 'base' }))
}
