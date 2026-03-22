/**
 * Controlled vocabulary for recipe-level tags (separate from ingredient categories).
 * Tags may belong to multiple groups (e.g. "dessert" is both meal type and dish type).
 */

export const MEAL_TYPES = new Set(['breakfast', 'lunch', 'dinner', 'snack', 'dessert'])

export const CUISINE_TYPES = new Set([
  'italian',
  'asian',
  'american',
  'mediterranean',
  'greek',
  'spanish',
  'french',
  'mexican',
  'scandinavian',
  'middle_eastern',
  'other',
])

export const DISH_TYPES = new Set([
  'pasta',
  'ramen',
  'soup',
  'salad',
  'burger',
  'sandwich',
  'bread',
  'baked',
  'dessert',
  'breakfast',
  'main',
  'side',
  'drink',
])

export const DIET_TYPES = new Set(['vegetarian', 'vegan', 'meat', 'fish'])

export const CONTEXT_TYPES = new Set(['quick', 'easy', 'comfort_food', 'family'])

/** Every allowed tag string (unique). */
export const ALL_ALLOWED_TAGS = Array.from(
  new Set([
    ...MEAL_TYPES,
    ...CUISINE_TYPES,
    ...DISH_TYPES,
    ...DIET_TYPES,
    ...CONTEXT_TYPES,
  ]),
).sort()

export const ALL_ALLOWED_SET = new Set(ALL_ALLOWED_TAGS)
