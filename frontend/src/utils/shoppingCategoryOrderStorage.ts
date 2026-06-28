import { SHOPPING_CATEGORY_ORDER } from '../constants/shoppingCategoryOrder'
import { INGREDIENT_CATEGORY_VALUES } from '../constants/ingredientCategories'

const STORAGE_KEY = 'recipe-library-shopping-category-order'

function isValidOrder(order: unknown): order is string[] {
  if (!Array.isArray(order)) return false
  const valid = new Set(INGREDIENT_CATEGORY_VALUES)
  if (order.length !== INGREDIENT_CATEGORY_VALUES.length) return false
  const seen = new Set<string>()
  for (const key of order) {
    if (typeof key !== 'string' || !valid.has(key) || seen.has(key)) return false
    seen.add(key)
  }
  return true
}

export function loadCustomCategoryOrder(): string[] | null {
  if (typeof localStorage === 'undefined') return null
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    return isValidOrder(parsed) ? parsed : null
  } catch {
    return null
  }
}

export function saveCustomCategoryOrder(order: string[]) {
  if (!isValidOrder(order)) return
  localStorage.setItem(STORAGE_KEY, JSON.stringify(order))
}

export function resetCustomCategoryOrder() {
  localStorage.removeItem(STORAGE_KEY)
}

export function getDefaultCategoryOrder(): string[] {
  return [...SHOPPING_CATEGORY_ORDER]
}

export function getEffectiveCategoryOrder(): string[] {
  return loadCustomCategoryOrder() ?? getDefaultCategoryOrder()
}

export function moveCategoryKey(order: string[], key: string, direction: -1 | 1): string[] {
  const idx = order.indexOf(key)
  if (idx === -1) return order
  const next = idx + direction
  if (next < 0 || next >= order.length) return order
  const copy = [...order]
  ;[copy[idx], copy[next]] = [copy[next], copy[idx]]
  return copy
}
