/**
 * Unit tests for recipe tag validation (no DB).
 * Run: node --test tests/services/recipeTagValidation.test.js
 */

import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  normalizeTagString,
  inferMealTypeFallback,
  inferDishTypeFallback,
  sanitizeRecipeTags,
} from '../../src/services/recipeTagValidation.js'

describe('normalizeTagString', () => {
  it('normalizes allowed tags to lowercase snake_case', () => {
    assert.equal(normalizeTagString(' Italian '), 'italian')
    assert.equal(normalizeTagString('MAIN'), 'main')
  })

  it('drops unknown tags', () => {
    assert.equal(normalizeTagString('not-a-real-tag'), null)
    assert.equal(normalizeTagString(''), null)
  })
})

describe('inferMealTypeFallback', () => {
  it('detects breakfast and dessert from title', () => {
    assert.equal(inferMealTypeFallback('Blueberry Pancakes'), 'breakfast')
    assert.equal(inferMealTypeFallback('Chocolate Tiramisu'), 'dessert')
  })

  it('defaults to dinner', () => {
    assert.equal(inferMealTypeFallback('Pasta Primavera'), 'dinner')
    assert.equal(inferMealTypeFallback(''), 'dinner')
  })
})

describe('inferDishTypeFallback', () => {
  it('maps meal types to dish defaults', () => {
    assert.equal(inferDishTypeFallback('dessert'), 'dessert')
    assert.equal(inferDishTypeFallback('breakfast'), 'breakfast')
    assert.equal(inferDishTypeFallback('dinner'), 'main')
  })
})

describe('sanitizeRecipeTags', () => {
  it('applies defaults when input is not an array', () => {
    const result = sanitizeRecipeTags(null, { title: 'Pasta' })
    assert.ok(result.tags.includes('dinner'))
    assert.ok(result.tags.includes('main'))
    assert.equal(result.incomplete, true)
    assert.ok(result.warnings.length > 0)
  })

  it('drops invalid tags and keeps valid ones sorted', () => {
    const result = sanitizeRecipeTags(['italian', 'bogus-tag', 'main', 'dinner'], {
      title: 'Pasta',
    })
    assert.deepEqual(result.tags, ['dinner', 'italian', 'main'])
    assert.ok(result.warnings.some((w) => w.includes('bogus-tag')))
  })

  it('keeps only first meal type when multiple are present', () => {
    const result = sanitizeRecipeTags(['breakfast', 'lunch', 'main'], { title: 'Brunch' })
    assert.ok(result.tags.includes('breakfast'))
    assert.ok(!result.tags.includes('lunch'))
    assert.ok(result.warnings.some((w) => w.includes('Multiple meal types')))
  })
})
