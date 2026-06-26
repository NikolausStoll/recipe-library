export interface ShoppingAmountPart {
  amount: number | null
  amountMax: number | null
  unit: string | null
}

export interface ShoppingListItem {
  id: string
  ingredientName: string
  category: string | null
  amountParts: ShoppingAmountPart[]
  sourceRecipes: { id: number; title: string }[]
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
