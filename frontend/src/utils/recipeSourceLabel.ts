import type { RecipeListItem } from '../api/recipes'
import { formatUrlDomain } from './formatUrlDomain'

export type RecipeSourceDisplayLabel =
  | 'Buch'
  | 'Website'
  | 'Fotoimport'
  | 'Manuell'
  | 'Quelle unbekannt'

type SourceFields = Pick<
  RecipeListItem,
  | 'source_type'
  | 'source_id'
  | 'source_name'
  | 'source_url'
  | 'original_url'
  | 'source_domain'
  | 'import_method'
>

export function isWebsiteSourceType(type: string | null | undefined): boolean {
  const t = (type ?? '').toLowerCase()
  return t === 'url' || t === 'website'
}

/** UI source type label — does not treat arbitrary source_name as Book. */
export function getRecipeSourceDisplayLabel(recipe: SourceFields): RecipeSourceDisplayLabel {
  const type = (recipe.source_type ?? '').toLowerCase()
  const hasManaged = recipe.source_id != null

  if (hasManaged && type === 'book') return 'Buch'
  if (hasManaged && isWebsiteSourceType(type)) return 'Website'
  if (hasManaged && type === 'manual') return 'Manuell'
  if (hasManaged && (type === 'other' || type === 'website')) {
    return recipe.source_url?.trim() ? 'Website' : 'Manuell'
  }

  if (recipe.source_url?.trim()) return 'Website'
  if (recipe.import_method === 'image') return 'Fotoimport'
  if (recipe.import_method === 'url') return 'Website'
  if (recipe.import_method === 'manual') return 'Manuell'

  return 'Quelle unbekannt'
}

/** Compact card/detail meta: book title or website domain. */
export function formatRecipeSourceMeta(recipe: SourceFields): string {
  const label = getRecipeSourceDisplayLabel(recipe)
  if (label === 'Buch' && recipe.source_name?.trim()) return recipe.source_name.trim()
  if (label === 'Website') {
    const domain =
      recipe.source_domain?.trim() ||
      recipe.source_name?.trim() ||
      (recipe.original_url?.trim() ? formatUrlDomain(recipe.original_url) : '') ||
      (recipe.source_url?.trim() ? formatUrlDomain(recipe.source_url) : '')
    return domain || 'Website'
  }
  return label
}

/** Clickable original recipe page URL (not the website source site root). */
export function getRecipeOriginalPageUrl(recipe: SourceFields): string | null {
  const original = recipe.original_url?.trim()
  if (original) return original
  if (isRecipeWebsiteSource(recipe) && recipe.source_url?.trim()) return recipe.source_url.trim()
  return null
}

export function isManagedBookSource(recipe: SourceFields): boolean {
  return recipe.source_id != null && (recipe.source_type ?? '').toLowerCase() === 'book'
}

export function isRecipeWebsiteSource(recipe: SourceFields): boolean {
  const label = getRecipeSourceDisplayLabel(recipe)
  return label === 'Website'
}
