/**
 * Canonical ingredient category keys (persisted in DB). Must match
 * `backend/src/constants/ingredientCategories.js`.
 * Labels are German for the UI only; API/DB use `value`.
 */
export const INGREDIENT_CATEGORY_OPTIONS = [
  { value: 'produce', labelDe: 'Obst & Gemüse' },
  { value: 'meat_fish', labelDe: 'Fleisch & Fisch' },
  { value: 'dairy_eggs', labelDe: 'Milchprodukte & Eier' },
  { value: 'grains', labelDe: 'Getreide & Hülsenfrüchte' },
  { value: 'pantry', labelDe: 'Vorratsschrank' },
  { value: 'spices', labelDe: 'Gewürze' },
  { value: 'oils_fats', labelDe: 'Öle & Fette' },
  { value: 'sauces', labelDe: 'Soßen & Würzsaucen' },
  { value: 'baking', labelDe: 'Backen' },
  { value: 'frozen', labelDe: 'Tiefkühl' },
  { value: 'beverages', labelDe: 'Getränke' },
  { value: 'other', labelDe: 'Sonstiges' },
] as const

/** Keys in API order (for validation). */
export const INGREDIENT_CATEGORY_VALUES = INGREDIENT_CATEGORY_OPTIONS.map((o) => o.value) as readonly string[]

export type IngredientCategoryKey = (typeof INGREDIENT_CATEGORY_OPTIONS)[number]['value']

export function isCanonicalIngredientCategory(v: string | null | undefined): v is IngredientCategoryKey {
  return v != null && INGREDIENT_CATEGORY_VALUES.includes(v)
}

/** German label for a persisted key; unknown keys returned as-is. */
export function getIngredientCategoryLabelDe(value: string | null | undefined): string {
  if (value == null || value === '') return ''
  const opt = INGREDIENT_CATEGORY_OPTIONS.find((o) => o.value === value)
  return opt?.labelDe ?? value
}

/**
 * @deprecated Use getIngredientCategoryLabelDe for German UI.
 * Kept for any code that expected English-ish formatting.
 */
export function formatIngredientCategoryLabel(category: string): string {
  return getIngredientCategoryLabelDe(category)
}
