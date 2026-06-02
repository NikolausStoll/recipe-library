import type { RecipeListItem } from '../api/recipes'
import {
  getRecipeSourceDisplayLabel,
  isManagedBookSource,
} from './recipeSourceLabel'

type RecipeTimeSource = 'original' | 'estimated' | null | undefined

type DetailSourceFields = Pick<
  RecipeListItem,
  'source_type' | 'source_id' | 'source_name' | 'source_url' | 'source_page' | 'import_method'
>

/** Compact duration: 5min, 25min, 1h 15min. */
export function formatCompactRecipeMinutes(
  v: number | null | undefined,
  source?: RecipeTimeSource
): string | null {
  if (v == null || Number.isNaN(Number(v)) || Number(v) <= 0) return null
  const n = Math.round(Number(v))
  if (n >= 60) {
    const h = Math.floor(n / 60)
    const m = n % 60
    if (m === 0) return `${h}h`
    return `${h}h ${m}min`
  }
  return `${n}min`
}

export function formatUrlDomain(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./i, '')
  } catch {
    const trimmed = url.trim()
    return trimmed.replace(/^https?:\/\//i, '').replace(/^www\./i, '').split('/')[0] || trimmed
  }
}

/** Primary detail metadata source label (book title + page, domain, import type, …). */
export function formatRecipeDetailSourceMeta(recipe: DetailSourceFields): string {
  const label = getRecipeSourceDisplayLabel(recipe)
  const page = recipe.source_page?.trim()
  const pageSuffix = page ? ` · p. ${page}` : ''

  if (isManagedBookSource(recipe) && recipe.source_name?.trim()) {
    return `${recipe.source_name.trim()}${pageSuffix}`
  }

  if (label === 'Website') {
    const url = recipe.source_url?.trim()
    if (url) return formatUrlDomain(url)
    if (recipe.source_name?.trim()) return recipe.source_name.trim()
    return 'Website'
  }

  if (label === 'Book' && recipe.source_name?.trim()) {
    return `${recipe.source_name.trim()}${pageSuffix}`
  }

  return label
}

export function formatDetailServingsLabel(servings: number | null | undefined): string | null {
  if (servings == null || servings <= 0) return null
  return `${servings} serving${servings === 1 ? '' : 's'}`
}

/** Servings count only for compact detail metadata row. */
export function formatDetailServingsCount(servings: number | null | undefined): string | null {
  if (servings == null || servings <= 0) return null
  return String(servings)
}

export type DetailSourceKind = 'book' | 'website' | 'photo' | 'manual' | 'unknown'

export function getRecipeDetailSourceKind(recipe: DetailSourceFields): DetailSourceKind {
  const label = getRecipeSourceDisplayLabel(recipe)
  if (label === 'Book') return 'book'
  if (label === 'Website') return 'website'
  if (label === 'Photo import') return 'photo'
  if (label === 'Manual') return 'manual'
  return 'unknown'
}

export interface DetailTimeMeta {
  value: string
  label: 'PREP' | 'COOK'
}

export function formatDetailPrepMeta(
  recipe: Pick<RecipeListItem, 'prep_time_min' | 'prep_time_source'> | null | undefined
): DetailTimeMeta | null {
  if (!recipe) return null
  const value = formatCompactRecipeMinutes(recipe.prep_time_min, recipe.prep_time_source)
  if (!value) return null
  return { value, label: 'PREP' }
}

export function formatDetailCookMeta(
  recipe: Pick<RecipeListItem, 'cook_time_min' | 'cook_time_source'> | null | undefined
): DetailTimeMeta | null {
  if (!recipe) return null
  const value = formatCompactRecipeMinutes(recipe.cook_time_min, recipe.cook_time_source)
  if (!value) return null
  return { value, label: 'COOK' }
}
