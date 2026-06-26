import type { Recipe } from '../api/recipes'
import type { ShoppingIngredientInput } from './shoppingListTypes'

function scaleAmount(value: number | null | undefined, scale: number): number | null {
  if (value == null || Number.isNaN(Number(value))) return null
  return Math.round(Number(value) * scale * 100) / 100
}

/**
 * Structured ingredient rows from a recipe, scaled to the requested serving count.
 */
export function extractShoppingIngredientsFromRecipe(
  recipe: Recipe,
  servings: number,
): ShoppingIngredientInput[] {
  const originalServings = recipe.servings || 1
  const scale = servings / originalServings
  const rows: ShoppingIngredientInput[] = []

  const push = (row: ShoppingIngredientInput) => {
    if (!row.ingredientName.trim()) return
    rows.push(row)
  }

  if (recipe.ingredients?.length) {
    for (const ing of recipe.ingredients) {
      const ingredientName = (ing.name || ing.ingredient || '').trim()
      push({
        ingredientName,
        category: ing.category?.trim() ? ing.category.trim() : null,
        amount: scaleAmount(ing.amount ?? null, scale),
        amountMax: scaleAmount(ing.amount_max ?? null, scale),
        unit: ing.unit?.trim() ? ing.unit.trim() : null,
      })
    }
    return rows
  }

  if (recipe.parsed_recipe?.ingredientsSections?.length) {
    for (const section of recipe.parsed_recipe.ingredientsSections) {
      for (const item of section.items ?? []) {
        const ingredientName = (item.ingredient ?? '').trim()
        const catRaw = (item as { category?: string | null }).category
        push({
          ingredientName,
          category: catRaw?.trim() ? catRaw.trim() : null,
          amount: scaleAmount(item.amount ?? null, scale),
          amountMax: scaleAmount((item as { amountMax?: number | null }).amountMax ?? null, scale),
          unit: item.unit?.trim() ? item.unit.trim() : null,
        })
      }
    }
  }

  return rows
}
