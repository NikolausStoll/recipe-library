import { describe, expect, it } from 'vitest'
import { isIngredientSelectedByDefault } from '../../src/utils/shoppingListDefaults'
import { formatShoppingLine } from '../../src/utils/shoppingListFormat'
import {
  buildShoppingListItemsFromInputs,
  mergeAmountParts,
  mergeShoppingItems,
  removeRecipeFromItems,
} from '../../src/utils/shoppingListMerge'
import type { ShoppingListItem } from '../../src/utils/shoppingListTypes'

function itemStub(overrides: Partial<ShoppingListItem> = {}): ShoppingListItem {
  return {
    id: '1',
    ingredientName: 'Tomaten',
    category: 'produce',
    amountParts: [{ amount: 400, amountMax: null, unit: 'g' }],
    contributions: [
      {
        recipeId: 1,
        recipeTitle: 'Salat',
        amountParts: [{ amount: 400, amountMax: null, unit: 'g' }],
      },
    ],
    sourceRecipes: [{ id: 1, title: 'Salat' }],
    checked: false,
    ...overrides,
  }
}

describe('isIngredientSelectedByDefault', () => {
  it('unchecks pantry and spices by default', () => {
    expect(isIngredientSelectedByDefault('pantry')).toBe(false)
    expect(isIngredientSelectedByDefault('spices')).toBe(false)
    expect(isIngredientSelectedByDefault('produce')).toBe(true)
    expect(isIngredientSelectedByDefault(null)).toBe(true)
  })

  it('unchecks tap water variants by default', () => {
    expect(isIngredientSelectedByDefault('beverages', 'Wasser')).toBe(false)
    expect(isIngredientSelectedByDefault('other', 'kochendes Wasser')).toBe(false)
    expect(isIngredientSelectedByDefault('beverages', 'Rotwein')).toBe(true)
  })
})

describe('formatShoppingLine', () => {
  it('puts the ingredient name first with amounts in parentheses', () => {
    expect(formatShoppingLine(itemStub())).toBe('Tomaten (400g)')
  })

  it('joins non-mergeable parts with commas', () => {
    const item = itemStub({
      amountParts: [
        { amount: 200, amountMax: null, unit: 'g' },
        { amount: 1, amountMax: null, unit: 'Handvoll' },
      ],
    })
    expect(formatShoppingLine(item)).toBe('Tomaten (200g, 1 Handvoll)')
  })
})

describe('mergeAmountParts', () => {
  it('sums grams', () => {
    const merged = mergeAmountParts(
      [{ amount: 200, amountMax: null, unit: 'g' }],
      [{ amount: 300, amountMax: null, unit: 'g' }],
    )
    expect(merged).toEqual([{ amount: 500, amountMax: null, unit: 'g' }])
  })

  it('converts kg and g when merging', () => {
    const merged = mergeAmountParts(
      [{ amount: 500, amountMax: null, unit: 'g' }],
      [{ amount: 1, amountMax: null, unit: 'kg' }],
    )
    expect(merged).toEqual([{ amount: 1.5, amountMax: null, unit: 'kg' }])
  })
})

describe('mergeShoppingItems', () => {
  it('merges same ingredient and category across recipes', () => {
    const existing = buildShoppingListItemsFromInputs(
      [{ ingredientName: 'Tomaten', category: 'produce', amount: 200, amountMax: null, unit: 'g' }],
      { id: 1, title: 'Salat' },
    )
    const additions = buildShoppingListItemsFromInputs(
      [{ ingredientName: 'Tomaten', category: 'produce', amount: 300, amountMax: null, unit: 'g' }],
      { id: 2, title: 'Pasta' },
    )
    const merged = mergeShoppingItems(existing, additions)
    expect(merged).toHaveLength(1)
    expect(formatShoppingLine(merged[0])).toBe('Tomaten (500g)')
    expect(merged[0].contributions).toHaveLength(2)
    expect(merged[0].sourceRecipes).toHaveLength(2)
  })

  it('keeps different ingredient names separate', () => {
    const existing = buildShoppingListItemsFromInputs(
      [{ ingredientName: 'Tomaten', category: 'produce', amount: 200, amountMax: null, unit: 'g' }],
      { id: 1, title: 'A' },
    )
    const additions = buildShoppingListItemsFromInputs(
      [{ ingredientName: 'Rispentomaten', category: 'produce', amount: 300, amountMax: null, unit: 'g' }],
      { id: 2, title: 'B' },
    )
    const merged = mergeShoppingItems(existing, additions)
    expect(merged).toHaveLength(2)
  })
})

describe('removeRecipeFromItems', () => {
  it('subtracts a recipe contribution and keeps merged rows when needed', () => {
    const merged = mergeShoppingItems(
      buildShoppingListItemsFromInputs(
        [{ ingredientName: 'Tomaten', category: 'produce', amount: 200, amountMax: null, unit: 'g' }],
        { id: 1, title: 'Salat' },
      ),
      buildShoppingListItemsFromInputs(
        [{ ingredientName: 'Tomaten', category: 'produce', amount: 300, amountMax: null, unit: 'g' }],
        { id: 2, title: 'Pasta' },
      ),
    )
    const afterRemove = removeRecipeFromItems(merged, 2)
    expect(afterRemove).toHaveLength(1)
    expect(formatShoppingLine(afterRemove[0])).toBe('Tomaten (200g)')
    expect(afterRemove[0].sourceRecipes).toEqual([{ id: 1, title: 'Salat' }])
  })

  it('removes rows that only belonged to the recipe', () => {
    const items = buildShoppingListItemsFromInputs(
      [{ ingredientName: 'Zwiebeln', category: 'produce', amount: 2, amountMax: null, unit: 'Stück' }],
      { id: 3, title: 'Suppe' },
    )
    expect(removeRecipeFromItems(items, 3)).toEqual([])
  })
})

describe('collectSourceRecipes', () => {
  it('returns unique recipes sorted by title', async () => {
    const { collectSourceRecipes } = await import('../../src/utils/shoppingListSources')
    const recipes = collectSourceRecipes([
      itemStub({
        sourceRecipes: [
          { id: 2, title: 'Pasta' },
          { id: 1, title: 'Salat' },
        ],
        contributions: [
          { recipeId: 2, recipeTitle: 'Pasta', amountParts: [] },
          { recipeId: 1, recipeTitle: 'Salat', amountParts: [{ amount: 400, amountMax: null, unit: 'g' }] },
        ],
      }),
      itemStub({
        id: '2',
        ingredientName: 'Zwiebeln',
        contributions: [{ recipeId: 2, recipeTitle: 'Pasta', amountParts: [] }],
        sourceRecipes: [{ id: 2, title: 'Pasta' }],
      }),
    ])
    expect(recipes).toEqual([
      { id: 2, title: 'Pasta' },
      { id: 1, title: 'Salat' },
    ])
  })
})

describe('groupShoppingListItems', () => {
  it('sorts groups by supermarket aisle order', async () => {
    const { groupShoppingListItems } = await import('../../src/utils/shoppingListSort')
    const groups = groupShoppingListItems([
      itemStub({
        id: '1',
        ingredientName: 'Hähnchen',
        category: 'meat_fish',
        amountParts: [],
        contributions: [],
        sourceRecipes: [],
      }),
      itemStub({
        id: '2',
        ingredientName: 'Tomaten',
        category: 'produce',
      }),
      itemStub({
        id: '3',
        ingredientName: 'Salz',
        category: 'spices',
        amountParts: [],
        contributions: [],
        sourceRecipes: [],
      }),
    ])
    expect(groups.map((g) => g.categoryKey)).toEqual(['produce', 'spices', 'meat_fish'])
  })
})
