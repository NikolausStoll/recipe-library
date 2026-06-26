/**
 * Unit tests for import pipeline orchestration (in-memory DB, no OpenAI).
 * Run: node --test tests/services/recipeImportPipelineService.test.js
 */

import assert from 'node:assert/strict'
import { after, before, describe, it } from 'node:test'

process.env.DB_PATH = ':memory:'
process.env.AI_CUP_CONVERSION_ENABLED = 'false'

const { initDb } = await import('../../src/db/index.js')
const { createRecipe } = await import('../../src/services/recipeService.js')
const { applyPostNormalizationStages, finalizeImportedRecipe } = await import('../../src/services/recipeImportPipelineService.js')

before(() => {
  initDb()
})

after(() => {
  delete process.env.DB_PATH
  delete process.env.AI_CUP_CONVERSION_ENABLED
})

function envelopeWithPriseSalt() {
  return {
    status: 'success',
    confidence: 0.95,
    warnings: [],
    missingFields: [],
    recipe: {
      title: 'Simple',
      subtitle: null,
      introText: null,
      language: 'de',
      servings: null,
      prepTimeMinutes: null,
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
          ],
        },
      ],
      steps: [{ index: 1, text: 'Season.' }],
      tips: [],
    },
  }
}

describe('applyPostNormalizationStages', () => {
  it('returns envelope unchanged when no cup rows exist', async () => {
    const structured = envelopeWithPriseSalt()
    const result = await applyPostNormalizationStages(structured)
    assert.equal(result.envelope.recipe.ingredientsSections[0].items[0].unit, 'Prise')
    assert.ok(
      result.warnings.some((w) => w.includes('No cup ingredients found')),
      `expected cup-skip warning, got: ${JSON.stringify(result.warnings)}`,
    )
  })
})

describe('finalizeImportedRecipe', () => {
  it('persists structured recipe even when tag generation fails without API key', async () => {
    const created = createRecipe({ title: 'Pipeline' })
    const prevKey = process.env.OPENAI_API_KEY
    delete process.env.OPENAI_API_KEY

    try {
      const result = await finalizeImportedRecipe(created.id, envelopeWithPriseSalt(), { updateTitle: true })
      assert.equal(result.recipe?.title, 'Simple')
      assert.equal(result.recipe?.ingredients[0]?.unit, 'Prise')
      assert.ok(
        result.warnings.some(
          (w) => w.includes('Tag generation failed') || w.includes('OPENAI_API_KEY is not set'),
        ),
      )
    } finally {
      if (prevKey != null) process.env.OPENAI_API_KEY = prevKey
    }
  })
})
