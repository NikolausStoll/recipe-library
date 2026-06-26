/**
 * Unit tests for recipe tag persistence.
 * Run: node --test tests/services/recipeTagPersistence.test.js
 */

import assert from 'node:assert/strict'
import { after, before, describe, it } from 'node:test'

process.env.DB_PATH = ':memory:'

const { initDb } = await import('../../src/db/index.js')
const { createRecipe } = await import('../../src/services/recipeService.js')
const { getTagsForRecipe, getTagsForRecipeIds, replaceRecipeTags } = await import('../../src/services/recipeTagPersistence.js')

before(() => {
  initDb()
})

after(() => {
  delete process.env.DB_PATH
})

describe('replaceRecipeTags', () => {
  it('replaces all tags for a recipe', () => {
    const recipe = createRecipe({ title: 'Tagged' })
    replaceRecipeTags(recipe.id, ['dinner', 'italian', 'main'])
    assert.deepEqual(getTagsForRecipe(recipe.id), ['dinner', 'italian', 'main'])
  })

  it('clears tags when given an empty list', () => {
    const recipe = createRecipe({ title: 'Untagged' })
    replaceRecipeTags(recipe.id, ['dinner'])
    replaceRecipeTags(recipe.id, [])
    assert.deepEqual(getTagsForRecipe(recipe.id), [])
  })
})

describe('getTagsForRecipeIds', () => {
  it('returns a map of tags per recipe id', () => {
    const a = createRecipe({ title: 'A' })
    const b = createRecipe({ title: 'B' })
    replaceRecipeTags(a.id, ['dinner', 'main'])
    replaceRecipeTags(b.id, ['dessert'])

    const map = getTagsForRecipeIds([a.id, b.id])
    assert.deepEqual(map.get(a.id), ['dinner', 'main'])
    assert.deepEqual(map.get(b.id), ['dessert'])
  })

  it('returns empty map for empty id list', () => {
    const map = getTagsForRecipeIds([])
    assert.equal(map.size, 0)
  })
})
