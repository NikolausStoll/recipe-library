/** Irregular German ingredient plurals for shopping-list merge keys. */
const IRREGULAR_SINGULAR: Record<string, string> = {
  eier: 'ei',
  äpfel: 'apfel',
}

/**
 * Normalize ingredient names so singular/plural variants merge (e.g. Süßkartoffel ↔ Süßkartoffeln).
 * Not fuzzy matching — Tomaten and Rispentomaten stay separate.
 */
export function normalizeIngredientNameForMerge(name: string): string {
  const n = name.trim().toLocaleLowerCase('de')
  if (!n) return n
  if (IRREGULAR_SINGULAR[n]) return IRREGULAR_SINGULAR[n]

  // Diminutives are often invariant (Hähnchen, Brötchen).
  if (n.endsWith('chen') || n.endsWith('lein')) return n

  // Typical German plurals: Zwiebeln, Süßkartoffeln, Tomaten, Möhren → drop trailing "n".
  if (n.endsWith('eln') && n.length > 4) return n.slice(0, -1)
  if (n.endsWith('en') && n.length > 4) return n.slice(0, -1)

  // Champignons, Nudeln (when written with s) → drop trailing "s".
  if (n.endsWith('s') && n.length > 3 && !n.endsWith('ss') && !n.endsWith('us')) {
    return n.slice(0, -1)
  }

  return n
}

/** Prefer shorter display name when two spellings share the same merge key. */
export function preferIngredientDisplayName(a: string, b: string): string {
  const left = a.trim()
  const right = b.trim()
  if (!left) return right
  if (!right) return left
  if (normalizeIngredientNameForMerge(left) !== normalizeIngredientNameForMerge(right)) return left
  return left.length <= right.length ? left : right
}
