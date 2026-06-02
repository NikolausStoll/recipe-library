/** UI label for recipe.status (backend still uses draft | confirmed). */
export function recipeStatusUiLabel(status: 'draft' | 'confirmed' | string | null | undefined): string | null {
  if (status === 'draft') return 'Prüfen'
  return null
}

export function recipeNeedsReview(status: 'draft' | 'confirmed' | string | null | undefined): boolean {
  return status === 'draft'
}
