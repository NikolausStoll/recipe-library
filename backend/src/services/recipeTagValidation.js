/**
 * Validate and sanitize recipe tags against the controlled list and group rules.
 */

import {
  ALL_ALLOWED_SET,
  MEAL_TYPES,
  CUISINE_TYPES,
  DISH_TYPES,
  DIET_TYPES,
  CONTEXT_TYPES,
} from '../constants/recipeTags.js'

/**
 * @param {unknown} raw
 * @returns {string|null}
 */
export function normalizeTagString(raw) {
  if (raw == null) return null
  const s = String(raw).trim().toLowerCase().replace(/\s+/g, '_')
  if (!s) return null
  return ALL_ALLOWED_SET.has(s) ? s : null
}

/**
 * Infer meal type when missing (very small heuristic on title only).
 * @param {string|null|undefined} title
 * @returns {string}
 */
export function inferMealTypeFallback(title) {
  const t = (title != null ? String(title) : '').toLowerCase()
  if (/breakfast|brunch|pancake|waffle|smoothie|cereal|oatmeal|muffin\b/.test(t)) return 'breakfast'
  if (/\blunch\b|midday/.test(t)) return 'lunch'
  if (/tiramisu|dessert|cake|cookie|brownie|pudding|ice cream|sweet treat|pastry\b|pie\b(?!\s*crust)/.test(t)) {
    return 'dessert'
  }
  if (/\bsnack\b|dip\b|trail mix/.test(t)) return 'snack'
  return 'dinner'
}

/**
 * @param {string} meal
 * @returns {string}
 */
export function inferDishTypeFallback(meal) {
  if (meal === 'dessert') return 'dessert'
  if (meal === 'breakfast') return 'breakfast'
  return 'main'
}

/**
 * @param {unknown[]} rawList
 * @returns {{ tags: string[], warnings: string[], fallbacks: { meal?: boolean, dish?: boolean }, incomplete: boolean }}
 */
export function sanitizeRecipeTags(rawList, options = {}) {
  const warnings = []
  const title = options.title != null ? String(options.title) : ''

  if (!Array.isArray(rawList)) {
    const meal = inferMealTypeFallback(title)
    const dish = inferDishTypeFallback(meal)
    const tags = uniqueSorted([meal, dish])
    return {
      tags,
      warnings: ['Tag input was not an array; applied defaults'],
      fallbacks: { meal: true, dish: true },
      incomplete: true,
    }
  }

  /** @type {string[]} */
  const normalized = []
  for (const x of rawList) {
    const n = normalizeTagString(x)
    if (n) {
      normalized.push(n)
    } else if (x != null && String(x).trim() !== '') {
      warnings.push(`Dropped unknown or invalid tag: ${String(x)}`)
    }
  }

  /** Preserve first-seen order, unique */
  const seen = new Set()
  const order = []
  for (const t of normalized) {
    if (!seen.has(t)) {
      seen.add(t)
      order.push(t)
    }
  }

  const uniqueMeals = [...new Set(order.filter((t) => MEAL_TYPES.has(t)))]
  const uniqueCuisines = [...new Set(order.filter((t) => CUISINE_TYPES.has(t)))]
  const uniqueDiets = [...new Set(order.filter((t) => DIET_TYPES.has(t)))]
  const uniqueContexts = [...new Set(order.filter((t) => CONTEXT_TYPES.has(t)))]

  const dishSeen = new Set()
  const dishInOrder = []
  for (const t of order) {
    if (DISH_TYPES.has(t) && !dishSeen.has(t)) {
      dishSeen.add(t)
      dishInOrder.push(t)
      if (dishInOrder.length >= 2) break
    }
  }
  const uniqueDishCount = [...new Set(order.filter((t) => DISH_TYPES.has(t)))].length

  const fallbacks = {}

  let meal = uniqueMeals[0] ?? null
  if (uniqueMeals.length > 1) {
    warnings.push('Multiple meal types; kept first in list order')
  }
  if (!meal) {
    meal = inferMealTypeFallback(title)
    fallbacks.meal = true
    warnings.push('No valid meal type; inferred from title or defaulted to dinner')
  }

  let cuisine = uniqueCuisines[0] ?? null
  if (uniqueCuisines.length > 1) {
    warnings.push('Multiple cuisines; kept first in list order')
  }

  let dishList = dishInOrder
  if (uniqueDishCount > 2) {
    warnings.push('More than two dish types; kept first two in list order')
  }
  if (dishList.length === 0) {
    dishList = [inferDishTypeFallback(meal)]
    fallbacks.dish = true
    warnings.push('No dish type; applied default for meal type')
  }

  let diet = uniqueDiets[0] ?? null
  if (uniqueDiets.length > 1) {
    warnings.push('Multiple diet tags; kept first in list order')
  }

  const contextPick = uniqueContexts.slice(0, 2)
  if (uniqueContexts.length > 2) {
    warnings.push('More than two context tags; kept first two in list order')
  }

  const out = new Set()
  out.add(meal)
  if (cuisine) out.add(cuisine)
  dishList.forEach((d) => out.add(d))
  if (diet) out.add(diet)
  contextPick.forEach((c) => out.add(c))

  const tags = [...out].sort()
  return {
    tags,
    warnings,
    fallbacks,
    incomplete: false,
  }
}

function uniqueSorted(arr) {
  return [...new Set(arr)].sort()
}
