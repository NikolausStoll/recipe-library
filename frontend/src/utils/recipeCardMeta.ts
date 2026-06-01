import type { RecipeListItem } from '../api/recipes'

function totalMinutes(recipe: RecipeListItem): number | null {
  const prep = recipe.prep_time_min
  const cook = recipe.cook_time_min
  if (prep == null && cook == null) return null
  return (prep ?? 0) + (cook ?? 0)
}

function healthLabel(recipe: RecipeListItem & { health_score?: { estimate?: { healthScore?: number | null } } | null }): string | null {
  const score = recipe.health_score?.estimate?.healthScore
  if (score == null) return null
  if (score >= 70) return 'Balanced'
  if (score >= 50) return 'Moderate'
  return null
}

function sourceLabel(recipe: RecipeListItem): string | null {
  if (recipe.source_type === 'book' || recipe.source_name) return 'Book'
  if (recipe.source_url) return 'Web'
  return null
}

/** Compact meta line for recipe cards (max ~3 items). */
export function formatRecipeCardMeta(recipe: RecipeListItem): string {
  const parts: string[] = []
  const mins = totalMinutes(recipe)
  if (mins != null && mins > 0) parts.push(`${mins} min`)
  const health = healthLabel(recipe as RecipeListItem & { health_score?: { estimate?: { healthScore?: number | null } } | null })
  if (health) parts.push(health)
  else if (recipe.nutrition_kcal != null) parts.push(`${Math.round(recipe.nutrition_kcal)} kcal`)
  const src = sourceLabel(recipe)
  if (src && parts.length < 3) parts.push(src)
  else if (recipe.servings != null && parts.length < 3) parts.push(`${recipe.servings} servings`)
  return parts.join(' · ')
}
