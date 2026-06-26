/**
 * Unit tests for ingredient category helpers.
 * Run: node --test tests/constants/ingredientCategories.test.js
 */

import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  CANONICAL_INGREDIENT_CATEGORIES,
  CANONICAL_INGREDIENT_CATEGORY_ENUM,
  sanitizeIngredientCategory,
  formatCategoryListForPrompt,
} from '../../src/constants/ingredientCategories.js'

describe('sanitizeIngredientCategory', () => {
  it('returns canonical keys unchanged', () => {
    assert.equal(sanitizeIngredientCategory('produce'), 'produce')
    assert.equal(sanitizeIngredientCategory('  spices  '), 'spices')
  })

  it('returns null for unknown or empty values', () => {
    assert.equal(sanitizeIngredientCategory('vegetable'), null)
    assert.equal(sanitizeIngredientCategory(''), null)
    assert.equal(sanitizeIngredientCategory(null), null)
    assert.equal(sanitizeIngredientCategory(undefined), null)
  })
})

describe('CANONICAL_INGREDIENT_CATEGORY_ENUM', () => {
  it('includes null for JSON schema', () => {
    assert.ok(CANONICAL_INGREDIENT_CATEGORY_ENUM.includes(null))
    assert.equal(CANONICAL_INGREDIENT_CATEGORY_ENUM.length, CANONICAL_INGREDIENT_CATEGORIES.length + 1)
  })
})

describe('formatCategoryListForPrompt', () => {
  it('lists every canonical category as a bullet', () => {
    const prompt = formatCategoryListForPrompt()
    for (const cat of CANONICAL_INGREDIENT_CATEGORIES) {
      assert.ok(prompt.includes(`- ${cat}`), `missing category ${cat}`)
    }
  })
})
