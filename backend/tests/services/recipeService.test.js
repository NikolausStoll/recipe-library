/**
 * Unit tests for recipeService persistence (in-memory DB).
 * Run: node --test tests/services/recipeService.test.js
 */

import assert from 'node:assert/strict'
import { after, before, describe, it } from 'node:test'

process.env.DB_PATH = ':memory:'

const { initDb } = await import('../../src/db/index.js')
const {
  createRecipe,
  updateRecipe,
  getRecipeById,
  setRecipeParsedRecipe,
  recipeTimeReplaceConflicts,
  applyRecipeTimeEstimate,
} = await import('../../src/services/recipeService.js')

before(() => {
  initDb()
})

after(() => {
  delete process.env.DB_PATH
})

function makeParsedEnvelope(overrides = {}) {
  return {
    status: 'success',
    confidence: 0.9,
    warnings: [],
    missingFields: [],
    recipe: {
      title: 'Imported Salad',
      subtitle: null,
      introText: 'Fresh and simple.',
      language: 'de',
      servings: { value: 2, unitText: 'Portionen' },
      prepTimeMinutes: 10,
      cookTimeMinutes: null,
      ingredientsSections: [
        {
          heading: null,
          items: [
            {
              originalText: 'a pinch of sea salt',
              amount: 1,
              amountMax: 1,
              unit: 'Prise',
              ingredient: 'Meersalz',
              additionalInfo: null,
              category: 'spices',
            },
            {
              originalText: 'a handful of black olives',
              amount: 1,
              amountMax: 1,
              unit: 'Handvoll',
              ingredient: 'schwarze Oliven',
              additionalInfo: null,
              category: 'produce',
            },
          ],
        },
      ],
      steps: [{ index: 1, text: 'Alles mischen.' }],
      tips: ['Kalt servieren.'],
      ...overrides,
    },
  }
}

describe('setRecipeParsedRecipe', () => {
  it('persists structured ingredients with amount, unit, and original_text', () => {
    const created = createRecipe({ title: 'Draft' })
    const updated = setRecipeParsedRecipe(created.id, makeParsedEnvelope(), { updateTitle: true })

    assert.equal(updated?.title, 'Imported Salad')
    assert.equal(updated?.ingredients.length, 2)

    const salt = updated?.ingredients.find((i) => i.ingredient === 'Meersalz')
    assert.equal(salt?.unit, 'Prise')
    assert.equal(salt?.amount, 1)
    assert.equal(salt?.original_text, 'a pinch of sea salt')
    assert.equal(salt?.additional_info, null)

    const olives = updated?.ingredients.find((i) => i.ingredient === 'schwarze Oliven')
    assert.equal(olives?.unit, 'Handvoll')
    assert.equal(updated?.recipe_steps[0]?.instruction, 'Alles mischen.')
    assert.deepEqual(updated?.tips, ['Kalt servieren.'])
  })

  it('returns null for unknown recipe id', () => {
    assert.equal(setRecipeParsedRecipe(99999, makeParsedEnvelope()), null)
  })
})

describe('updateRecipe ingredient sections', () => {
  it('preserves section headings across consecutive ingredients', () => {
    const created = createRecipe({ title: 'Sections' })
    updateRecipe(created.id, {
      ingredients: [
        { amount: 1, unit: 'Prise', name: 'Salz', section_heading: 'Main' },
        { amount: 2, unit: 'EL', name: 'Öl', section_heading: 'Main' },
        { amount: 1, unit: 'Handvoll', name: 'Spinat', section_heading: 'Salad' },
      ],
      recipe_steps: [{ instruction: 'Mix.' }],
    })

    const recipe = getRecipeById(created.id)
    const main = recipe?.ingredients.filter((i) => i.section_heading === 'Main') ?? []
    const salad = recipe?.ingredients.filter((i) => i.section_heading === 'Salad') ?? []
    assert.equal(main.length, 2)
    assert.equal(salad.length, 1)
    assert.equal(main[0]?.name, 'Salz')
    assert.equal(salad[0]?.unit, 'Handvoll')
  })
})

describe('recipeTimeReplaceConflicts', () => {
  it('flags original imported times as conflicts', () => {
    const created = createRecipe({ title: 'Timed', prep_time_min: 15, prep_time_source: 'original' })
    const row = getRecipeById(created.id)
    const conflicts = recipeTimeReplaceConflicts(row)
    assert.equal(conflicts.prep, true)
    assert.equal(conflicts.cook, false)
  })
})

describe('applyRecipeTimeEstimate', () => {
  it('does not overwrite original prep time unless replacement is allowed', () => {
    const created = createRecipe({
      title: 'Timed',
      prep_time_min: 15,
      prep_time_source: 'original',
      cook_time_min: null,
    })

    applyRecipeTimeEstimate(created.id, {
      prepTimeMinutes: 30,
      prepTimeConfidence: 0.8,
      cookTimeMinutes: 20,
      cookTimeConfidence: 0.7,
    })

    let recipe = getRecipeById(created.id)
    assert.equal(recipe?.prep_time_min, 15)

    applyRecipeTimeEstimate(
      created.id,
      {
        prepTimeMinutes: 30,
        prepTimeConfidence: 0.8,
        cookTimeMinutes: 20,
        cookTimeConfidence: 0.7,
      },
      { replace_prep_if_original: true },
    )

    recipe = getRecipeById(created.id)
    assert.equal(recipe?.prep_time_min, 30)
    assert.equal(recipe?.cook_time_min, 20)
    assert.equal(recipe?.prep_time_source, 'estimated')
  })
})

describe('getRecipeById parsed_recipe round-trip', () => {
  it('rebuilds parsed_recipe from stored ingredient rows', () => {
    const created = createRecipe({ title: 'Round trip' })
    setRecipeParsedRecipe(created.id, makeParsedEnvelope())

    const recipe = getRecipeById(created.id)
    const item = recipe?.parsed_recipe?.ingredientsSections?.[0]?.items?.[0]
    assert.equal(item?.ingredient, 'Meersalz')
    assert.equal(item?.unit, 'Prise')
    assert.equal(item?.originalText, 'a pinch of sea salt')
  })
})
