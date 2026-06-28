export interface ShoppingAmountPart {
  amount: number | null
  amountMax: number | null
  unit: string | null
}

export interface ShoppingContribution {
  recipeId: number
  recipeTitle: string
  amountParts: ShoppingAmountPart[]
}

export interface ShoppingListItem {
  id: string
  ingredientName: string
  category: string | null
  amountParts: ShoppingAmountPart[]
  contributions: ShoppingContribution[]
  sourceRecipes: { id: number; title: string }[]
  checked: boolean
}

export interface ShoppingIngredientInput {
  ingredientName: string
  category: string | null
  amount: number | null
  amountMax: number | null
  unit: string | null
}

export interface ShoppingListGroup {
  categoryKey: string
  categoryLabel: string
  items: ShoppingListItem[]
}
