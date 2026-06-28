import { describe, expect, it, vi } from 'vitest'
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

  it('merges singular and plural German names with mixed units', () => {
    const existing = buildShoppingListItemsFromInputs(
      [{ ingredientName: 'Süßkartoffel', category: 'produce', amount: 200, amountMax: null, unit: 'g' }],
      { id: 1, title: 'Salat' },
    )
    const additions = buildShoppingListItemsFromInputs(
      [{ ingredientName: 'Süßkartoffeln', category: 'produce', amount: 2, amountMax: null, unit: null }],
      { id: 2, title: 'Ofen' },
    )
    const merged = mergeShoppingItems(existing, additions)
    expect(merged).toHaveLength(1)
    expect(merged[0].ingredientName).toBe('Süßkartoffel')
    expect(formatShoppingLine(merged[0])).toBe('Süßkartoffel (200g, 2)')
  })
})

describe('normalizeIngredientNameForMerge', () => {
  it('treats singular and plural as the same merge key', async () => {
    const { normalizeIngredientNameForMerge } = await import('../../src/utils/shoppingIngredientNameNormalize')
    expect(normalizeIngredientNameForMerge('Süßkartoffel')).toBe(
      normalizeIngredientNameForMerge('Süßkartoffeln'),
    )
    expect(normalizeIngredientNameForMerge('Ei')).toBe(normalizeIngredientNameForMerge('Eier'))
    expect(normalizeIngredientNameForMerge('Tomaten')).not.toBe(
      normalizeIngredientNameForMerge('Rispentomaten'),
    )
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

describe('collectSourceRecipes manual entries', () => {
  it('excludes manual source id 0', async () => {
    const { collectSourceRecipes } = await import('../../src/utils/shoppingListSources')
    const { MANUAL_SHOPPING_SOURCE } = await import('../../src/utils/shoppingListTypes')
    const recipes = collectSourceRecipes([
      itemStub({
        contributions: [
          { recipeId: MANUAL_SHOPPING_SOURCE.id, recipeTitle: MANUAL_SHOPPING_SOURCE.title, amountParts: [] },
          { recipeId: 1, recipeTitle: 'Salat', amountParts: [] },
        ],
        sourceRecipes: [MANUAL_SHOPPING_SOURCE, { id: 1, title: 'Salat' }],
      }),
    ])
    expect(recipes).toEqual([{ id: 1, title: 'Salat' }])
  })
})

describe('findMergeSuggestions', () => {
  it('suggests substring pairs in the same category', async () => {
    const { findMergeSuggestions } = await import('../../src/utils/shoppingListMergeSuggestions')
    const suggestions = findMergeSuggestions([
      itemStub({ id: 'a', ingredientName: 'Tomaten', category: 'produce' }),
      itemStub({ id: 'b', ingredientName: 'Rispentomaten', category: 'produce' }),
    ])
    expect(suggestions).toHaveLength(1)
    expect(suggestions[0].nameA).toBe('Tomaten')
    expect(suggestions[0].nameB).toBe('Rispentomaten')
  })

  it('ignores stopwords and different categories', async () => {
    const { findMergeSuggestions } = await import('../../src/utils/shoppingListMergeSuggestions')
    expect(
      findMergeSuggestions([
        itemStub({ id: 'a', ingredientName: 'Ei', category: 'dairy_eggs' }),
        itemStub({ id: 'b', ingredientName: 'Eier', category: 'dairy_eggs' }),
      ]),
    ).toHaveLength(0)
    expect(
      findMergeSuggestions([
        itemStub({ id: 'a', ingredientName: 'Tomaten', category: 'produce' }),
        itemStub({ id: 'b', ingredientName: 'Tomaten', category: 'pantry' }),
      ]),
    ).toHaveLength(0)
  })
})

describe('mergeItemsById', () => {
  it('combines contributions and keeps the chosen name', async () => {
    const { mergeItemsById } = await import('../../src/utils/shoppingListMerge')
    const items = mergeShoppingItems(
      buildShoppingListItemsFromInputs(
        [{ ingredientName: 'Tomaten', category: 'produce', amount: 200, amountMax: null, unit: 'g' }],
        { id: 1, title: 'Salat' },
      ),
      buildShoppingListItemsFromInputs(
        [{ ingredientName: 'Rispentomaten', category: 'produce', amount: 300, amountMax: null, unit: 'g' }],
        { id: 2, title: 'Pasta' },
      ),
    )
    const merged = mergeItemsById(items, items[0].id, items[1].id)
    expect(merged).toHaveLength(1)
    expect(merged[0].ingredientName).toBe('Tomaten')
    expect(formatShoppingLine(merged[0])).toBe('Tomaten (500g)')
    expect(merged[0].contributions).toHaveLength(2)
  })
})

describe('formatShoppingListAsText', () => {
  it('exports unchecked items grouped by category', async () => {
    const { formatShoppingListAsText } = await import('../../src/utils/shoppingListExport')
    const { groupShoppingListItems } = await import('../../src/utils/shoppingListSort')
    const groups = groupShoppingListItems([
      itemStub({ id: '1', ingredientName: 'Tomaten', category: 'produce', checked: false }),
      itemStub({
        id: '2',
        ingredientName: 'Salz',
        category: 'spices',
        amountParts: [],
        contributions: [],
        sourceRecipes: [],
        checked: true,
      }),
    ])
    const text = formatShoppingListAsText(groups)
    expect(text).toContain('Einkaufsliste')
    expect(text).toContain('- Tomaten (400g)')
    expect(text).not.toContain('Salz')
  })
})

describe('searchCommonShoppingIngredients', () => {
  it('returns staples matching partial query', async () => {
    const { searchCommonShoppingIngredients } = await import('../../src/utils/commonIngredientSearch')
    const results = searchCommonShoppingIngredients('tom')
    expect(results.some((item) => item.name === 'Tomaten')).toBe(true)
    expect(results.every((item) => item.category)).toBe(true)
  })

  it('resolves exact manual names to categories', async () => {
    const { matchCommonIngredient } = await import('../../src/utils/commonIngredientSearch')
    expect(matchCommonIngredient('Zwiebeln')?.category).toBe('produce')
    expect(matchCommonIngredient('xyz-unknown-foo')).toBeNull()
  })
})

describe('shoppingCategoryOrderStorage', () => {
  it('moves keys and validates order length', async () => {
    const store = new Map<string, string>()
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => {
        store.set(key, value)
      },
      removeItem: (key: string) => {
        store.delete(key)
      },
    })

    const {
      getDefaultCategoryOrder,
      moveCategoryKey,
      saveCustomCategoryOrder,
      loadCustomCategoryOrder,
      resetCustomCategoryOrder,
    } = await import('../../src/utils/shoppingCategoryOrderStorage')

    const order = getDefaultCategoryOrder()
    const moved = moveCategoryKey(order, 'produce', 1)
    expect(moved[1]).toBe('produce')
    saveCustomCategoryOrder(moved)
    expect(loadCustomCategoryOrder()).toEqual(moved)
    resetCustomCategoryOrder()
    expect(loadCustomCategoryOrder()).toBeNull()

    vi.unstubAllGlobals()
  })
})
