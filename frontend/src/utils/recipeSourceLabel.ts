import type { RecipeListItem } from '../api/recipes'

export type RecipeSourceDisplayLabel =
  | 'Book'
  | 'Website'
  | 'Photo import'
  | 'Manual'
  | 'Source unknown'

type SourceFields = Pick<
  RecipeListItem,
  'source_type' | 'source_id' | 'source_name' | 'source_url' | 'import_method'
>

/** UI source type label — does not treat arbitrary source_name as Book. */
export function getRecipeSourceDisplayLabel(recipe: SourceFields): RecipeSourceDisplayLabel {
  const type = (recipe.source_type ?? '').toLowerCase()
  const hasManaged = recipe.source_id != null

  if (hasManaged && type === 'book') return 'Book'
  if (hasManaged && type === 'url') return 'Website'
  if (hasManaged && type === 'manual') return 'Manual'
  if (hasManaged && (type === 'other' || type === 'website')) {
    return recipe.source_url?.trim() ? 'Website' : 'Manual'
  }

  if (recipe.source_url?.trim()) return 'Website'
  if (recipe.import_method === 'image') return 'Photo import'
  if (recipe.import_method === 'url') return 'Website'
  if (recipe.import_method === 'manual') return 'Manual'

  return 'Source unknown'
}

/** Compact card/detail meta: book title when type is book, else standard label. */
export function formatRecipeSourceMeta(recipe: SourceFields): string {
  const label = getRecipeSourceDisplayLabel(recipe)
  if (label === 'Book' && recipe.source_name?.trim()) return recipe.source_name.trim()
  return label
}

export function isManagedBookSource(recipe: SourceFields): boolean {
  return recipe.source_id != null && (recipe.source_type ?? '').toLowerCase() === 'book'
}

export function isRecipeWebsiteSource(recipe: SourceFields): boolean {
  const label = getRecipeSourceDisplayLabel(recipe)
  return label === 'Website'
}
