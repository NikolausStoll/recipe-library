/**
 * Unit tests for shared ingredient parsing prompt blocks.
 * Run: node --test tests/constants/ingredientParsingPrompt.test.js
 */

import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { buildIngredientParsingPromptBlock } from '../../src/constants/ingredientParsingPrompt.js'

describe('buildIngredientParsingPromptBlock', () => {
  it('tells the model not to put quantity phrases in additionalInfo', () => {
    const prompt = buildIngredientParsingPromptBlock({ unitLanguage: 'de' })
    assert.ok(prompt.includes('never put quantity phrases in additionalInfo'))
    assert.ok(prompt.includes('pinch/pinches'))
    assert.ok(prompt.includes('handful/handfuls'))
    assert.ok(prompt.includes('drizzle/drizzle of'))
  })

  it('includes German Schuss examples for vague liquid amounts', () => {
    const prompt = buildIngredientParsingPromptBlock({ unitLanguage: 'de' })
    assert.ok(prompt.includes('unit: "Schuss"'))
    assert.ok(prompt.includes('a good drizzle of olive oil'))
    assert.ok(prompt.includes('handful/handfuls → Handvoll'))
    assert.ok(prompt.includes('a pinch of sea salt'))
  })

  it('documents to taste as additionalInfo only', () => {
    const prompt = buildIngredientParsingPromptBlock({ unitLanguage: 'de' })
    assert.ok(prompt.includes('"to taste"'))
    assert.ok(prompt.includes('additionalInfo: "nach Belieben"'))
  })

  it('includes diced/roasted examples in additionalInfo not as units', () => {
    const prompt = buildIngredientParsingPromptBlock({ unitLanguage: 'de' })
    assert.ok(prompt.includes('additionalInfo: "gewürfelt"'))
    assert.ok(prompt.includes('additionalInfo: "geröstet"'))
  })

  it('includes amountMax rule by default', () => {
    const prompt = buildIngredientParsingPromptBlock({ unitLanguage: 'de' })
    assert.ok(prompt.includes('amountMax must equal amount'))
  })

  it('can omit amountMax rule when requested', () => {
    const prompt = buildIngredientParsingPromptBlock({ unitLanguage: 'de', includeAmountMaxRule: false })
    assert.ok(!prompt.includes('amountMax must equal amount'))
  })

  it('includes English splash unit for non-German extraction', () => {
    const prompt = buildIngredientParsingPromptBlock({ unitLanguage: 'en' })
    assert.ok(prompt.includes('unit: "splash"'))
    assert.ok(!prompt.includes('unit: "Schuss"'))
  })

  it('can include cup handling for normalization', () => {
    const prompt = buildIngredientParsingPromptBlock({ unitLanguage: 'de', includeCupHandling: true })
    assert.ok(prompt.includes('Cup handling:'))
    assert.ok(prompt.includes('must not convert cup-based ingredients'))
  })
})
