/**
 * Supermarket aisle order for the shopping list (German store layout).
 * Keys match `INGREDIENT_CATEGORY_OPTIONS` / DB `category` values.
 */
export const SHOPPING_CATEGORY_ORDER = [
  'produce', // Obst & Gemüse
  'spices', // Gewürze
  'grains', // Getreide & Hülsenfrüchte
  'baking', // Backen
  'oils_fats', // Öle & Fette
  'sauces', // Soßen & Würzsaucen
  'meat_fish', // Fleisch & Fisch
  'dairy_eggs', // Milchprodukte & Eier
  'beverages', // Getränke
  'frozen', // Tiefkühl
  'pantry', // Vorratsschrank
  'other', // Sonstiges
] as const
