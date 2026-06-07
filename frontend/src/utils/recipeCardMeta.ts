import type { RecipeListItem } from '../api/recipes'
import { formatCompactRecipeMinutes } from './recipeDetailMeta'
import { formatRecipeSourceMeta } from './recipeSourceLabel'

export function recipeTotalMinutes(recipe: RecipeListItem): number | null {
  const prep = recipe.prep_time_min
  const cook = recipe.cook_time_min
  if (prep == null && cook == null) return null
  return (prep ?? 0) + (cook ?? 0)
}

/** Compact card meta: total time · source. */
export function formatRecipeCardMeta(recipe: RecipeListItem): string {
  const parts: string[] = []
  const mins = recipeTotalMinutes(recipe)
  const timeLabel =
    mins != null && mins > 0
      ? formatCompactRecipeMinutes(mins, recipe.prep_time_source ?? recipe.cook_time_source)
      : null
  if (timeLabel) parts.push(timeLabel)

  const src = formatRecipeSourceMeta(recipe)
  if (src) parts.push(src)

  return parts.join(' · ')
}
