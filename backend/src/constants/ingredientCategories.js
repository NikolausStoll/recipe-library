/**
 * Canonical ingredient category keys persisted in DB and returned by LLM extract/normalize.
 * Must stay in sync with frontend `constants/ingredientCategories.ts`.
 */
export const CANONICAL_INGREDIENT_CATEGORIES = [
  'produce',
  'meat_fish',
  'dairy_eggs',
  'grains',
  'pantry',
  'spices',
  'oils_fats',
  'sauces',
  'baking',
  'frozen',
  'beverages',
  'other',
]

const CATEGORY_SET = new Set(CANONICAL_INGREDIENT_CATEGORIES)

/** For JSON Schema enum (nullable string). */
export const CANONICAL_INGREDIENT_CATEGORY_ENUM = [...CANONICAL_INGREDIENT_CATEGORIES, null]

/**
 * Returns the canonical key if valid, otherwise null (never persists unknown values).
 * @param {unknown} value
 * @returns {string|null}
 */
export function sanitizeIngredientCategory(value) {
  if (value == null) return null
  const s = String(value).trim()
  if (s === '') return null
  return CATEGORY_SET.has(s) ? s : null
}

/** Bullet list for LLM prompts (English keys only). */
export function formatCategoryListForPrompt() {
  return CANONICAL_INGREDIENT_CATEGORIES.map((c) => `- ${c}`).join('\n')
}
