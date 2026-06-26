import { describe, expect, it } from 'vitest'
import type { Recipe } from '../../src/api/recipes'
import { buildFormInitialFromImportedRecipe, buildFormInitialFromRecipe } from '../../src/utils/recipeFormInitial'

function baseRecipe(overrides: Partial<Recipe> = {}): Recipe {
  return {
    id: 1,
    title: 'Test',
    description: '',
    favorite: false,
    ingredients: [],
    recipe_steps: [],
    tips: [],
    tags: [],
    ...overrides,
  } as Recipe
}

describe('buildFormInitialFromRecipe', () => {
  it('maps DB ingredients to form rows with name from ingredient field', () => {
    const initial = buildFormInitialFromRecipe(
      baseRecipe({
        ingredients: [
          {
            amount: 1,
            unit: 'Prise',
            name: 'Meersalz',
            ingredient: 'Meersalz',
            original_text: 'a pinch of sea salt',
            additional_info: null,
          },
        ],
        recipe_steps: [{ instruction: 'Mix.' }],
      }),
    )

    expect(initial.ingredients?.[0]).toMatchObject({
      amount: '1',
      unit: 'Prise',
      name: 'Meersalz',
      original_text: 'a pinch of sea salt',
    })
  })
})

describe('buildFormInitialFromImportedRecipe', () => {
  it('prefers structured ingredient over originalText for name', () => {
    const initial = buildFormInitialFromImportedRecipe(
      baseRecipe({
        parsed_recipe: {
          ingredientsSections: [
            {
              heading: null,
              items: [
                {
                  originalText: 'a pinch of sea salt',
                  amount: 1,
                  unit: 'Prise',
                  ingredient: 'Meersalz',
                  additionalInfo: null,
                },
              ],
            },
          ],
          steps: [{ index: 1, text: 'Season.' }],
        },
      }),
    )

    expect(initial.ingredients?.[0]?.name).toBe('Meersalz')
    expect(initial.ingredients?.[0]?.unit).toBe('Prise')
    expect(initial.ingredients?.[0]?.original_text).toBe('a pinch of sea salt')
  })

  it('falls back to originalText for name when ingredient is empty', () => {
    const initial = buildFormInitialFromImportedRecipe(
      baseRecipe({
        parsed_recipe: {
          ingredientsSections: [
            {
              heading: null,
              items: [
                {
                  originalText: 'a pinch of sea salt',
                  amount: null,
                  unit: null,
                  ingredient: null,
                },
              ],
            },
          ],
        },
      }),
    )

    expect(initial.ingredients?.[0]?.name).toBe('a pinch of sea salt')
  })
})
