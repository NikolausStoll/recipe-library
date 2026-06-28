import type { ShoppingListItem } from './shoppingListTypes'

export interface MergeSuggestion {
  itemAId: string
  itemBId: string
  nameA: string
  nameB: string
  category: string | null
}

const STOPWORDS = new Set(['ei', 'tee', 'öl', 'oel'])

function normalizeName(name: string): string {
  return name.trim().toLowerCase()
}

function sameCategory(a: ShoppingListItem, b: ShoppingListItem): boolean {
  const catA = a.category?.trim() || 'other'
  const catB = b.category?.trim() || 'other'
  return catA === catB
}

function shouldSuggestPair(a: ShoppingListItem, b: ShoppingListItem): boolean {
  if (a.id === b.id) return false
  if (!sameCategory(a, b)) return false

  const nameA = normalizeName(a.ingredientName)
  const nameB = normalizeName(b.ingredientName)
  if (nameA === nameB) return false
  if (STOPWORDS.has(nameA) || STOPWORDS.has(nameB)) return false

  const shorter = nameA.length <= nameB.length ? nameA : nameB
  const longer = nameA.length > nameB.length ? nameA : nameB
  if (shorter.length < 4) return false

  return longer.includes(shorter)
}

/** Pairs of list items that might be the same product (manual confirm only). */
export function findMergeSuggestions(items: ShoppingListItem[]): MergeSuggestion[] {
  const suggestions: MergeSuggestion[] = []
  const seen = new Set<string>()

  for (let i = 0; i < items.length; i++) {
    for (let j = i + 1; j < items.length; j++) {
      const a = items[i]
      const b = items[j]
      if (!shouldSuggestPair(a, b)) continue

      const pairKey = [a.id, b.id].sort().join('|')
      if (seen.has(pairKey)) continue
      seen.add(pairKey)
      suggestions.push({
        itemAId: a.id,
        itemBId: b.id,
        nameA: a.ingredientName,
        nameB: b.ingredientName,
        category: a.category ?? b.category,
      })
    }
  }

  return suggestions
}
