const DEFAULT_UNCHECKED_CATEGORIES = new Set(['pantry', 'spices'])

/** Tap water and similar — not something you put on a grocery list. */
const DEFAULT_UNCHECKED_NAME_PATTERN =
  /^(?:(?:kochendes|kaltes|heißes|heisses|warmes|sprudelndes)\s+)?wasser$|^water$/i

/** Whether an ingredient row is pre-selected in the add-to-shopping picker. */
export function isIngredientSelectedByDefault(
  category: string | null | undefined,
  ingredientName?: string | null,
): boolean {
  const name = ingredientName?.trim() ?? ''
  if (name && DEFAULT_UNCHECKED_NAME_PATTERN.test(name)) return false
  if (!category?.trim()) return true
  return !DEFAULT_UNCHECKED_CATEGORIES.has(category.trim())
}
