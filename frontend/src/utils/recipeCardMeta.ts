import type { RecipeListItem } from '../api/recipes'
import { formatRecipeSourceMeta } from './recipeSourceLabel'

function totalMinutes(recipe: RecipeListItem): number | null {
  const prep = recipe.prep_time_min
  const cook = recipe.cook_time_min
  if (prep == null && cook == null) return null
  return (prep ?? 0) + (cook ?? 0)
}

function healthLabel(
  recipe: RecipeListItem & { health_score?: { estimate?: { healthScore?: number | null } } | null }
): string | null {
  const score = recipe.health_score?.estimate?.healthScore
  if (score == null) return null
  if (score >= 70) return 'Ausgewogen'
  if (score >= 50) return 'Mittel'
  return null
}

function primaryTagLabel(recipe: RecipeListItem): string | null {
  const tag = recipe.tags?.[0]
  if (!tag) return null
  return tag.replace(/_/g, ' ')
}

/** Compact meta line for recipe cards (max ~3 items). */
export function formatRecipeCardMeta(recipe: RecipeListItem): string {
  const parts: string[] = []
  const mins = totalMinutes(recipe)
  if (mins != null && mins > 0) parts.push(`${mins} Min.`)

  const tag = primaryTagLabel(recipe)
  if (tag && parts.length < 3) parts.push(tag)
  else {
    const health = healthLabel(
      recipe as RecipeListItem & { health_score?: { estimate?: { healthScore?: number | null } } | null }
    )
    if (health && parts.length < 3) parts.push(health)
    else if (recipe.nutrition_kcal != null && parts.length < 3) {
      parts.push(`${Math.round(recipe.nutrition_kcal)} kcal`)
    }
  }

  const src = formatRecipeSourceMeta(recipe)
  if (parts.length < 3) parts.push(src)

  return parts.join(' · ')
}
