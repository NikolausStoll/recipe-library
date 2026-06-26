const DEFAULT_UNCHECKED_CATEGORIES = new Set(['pantry', 'spices'])

/** Whether an ingredient row is pre-selected in the add-to-shopping picker. */
export function isIngredientSelectedByDefault(category: string | null | undefined): boolean {
  if (!category?.trim()) return true
  return !DEFAULT_UNCHECKED_CATEGORIES.has(category.trim())
}
