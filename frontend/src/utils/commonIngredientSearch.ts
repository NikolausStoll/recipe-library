import Fuse from 'fuse.js'
import {
  COMMON_SHOPPING_INGREDIENTS,
  type CommonShoppingIngredient,
} from '../constants/commonShoppingIngredients'

const fuse = new Fuse(COMMON_SHOPPING_INGREDIENTS, {
  keys: ['name'],
  threshold: 0.35,
  ignoreLocation: true,
})

export function searchCommonShoppingIngredients(
  query: string,
  limit = 8,
): CommonShoppingIngredient[] {
  const q = query.trim()
  if (!q) return COMMON_SHOPPING_INGREDIENTS.slice(0, limit)
  return fuse.search(q, { limit }).map((result) => result.item)
}

export function matchCommonIngredient(name: string): CommonShoppingIngredient | null {
  const trimmed = name.trim()
  if (!trimmed) return null
  const exact = COMMON_SHOPPING_INGREDIENTS.find(
    (item) => item.name.localeCompare(trimmed, 'de', { sensitivity: 'base' }) === 0,
  )
  if (exact) return exact
  const results = searchCommonShoppingIngredients(trimmed, 1)
  if (results.length === 0) return null
  if (results[0].name.localeCompare(trimmed, 'de', { sensitivity: 'base' }) === 0) return results[0]
  return null
}
