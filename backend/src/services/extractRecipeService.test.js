/**
 * Unit tests for image extraction prompt building (no OpenAI).
 * Run: node --test src/services/extractRecipeService.test.js
 */

import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  EXTRACT_PROMPT,
  GERMAN_TRANSLATION_ADDON,
  buildImageExtractionPrompt,
  parseTranslateToGerman,
} from './extractRecipeService.js'

describe('parseTranslateToGerman', () => {
  it('defaults to false for missing or falsy values', () => {
    assert.equal(parseTranslateToGerman(undefined), false)
    assert.equal(parseTranslateToGerman(null), false)
    assert.equal(parseTranslateToGerman(false), false)
    assert.equal(parseTranslateToGerman('false'), false)
    assert.equal(parseTranslateToGerman(''), false)
    assert.equal(parseTranslateToGerman(1), false)
  })

  it('returns true for boolean true or string "true"', () => {
    assert.equal(parseTranslateToGerman(true), true)
    assert.equal(parseTranslateToGerman('true'), true)
  })
})

describe('buildImageExtractionPrompt', () => {
  it('returns the base prompt unchanged when translateToGerman is false', () => {
    assert.equal(buildImageExtractionPrompt(false), EXTRACT_PROMPT)
    assert.equal(buildImageExtractionPrompt(), EXTRACT_PROMPT)
    assert.ok(EXTRACT_PROMPT.includes('Preserve the original language of the recipe.'))
  })

  it('uses German output instruction and add-on when translateToGerman is true', () => {
    const prompt = buildImageExtractionPrompt(true)
    assert.ok(!prompt.includes('Preserve the original language of the recipe.'))
    assert.ok(prompt.includes('The user requested German output; translate the extracted recipe fields'))
    assert.ok(prompt.includes('merge the content into one coherent recipe'))
    assert.ok(prompt.endsWith(GERMAN_TRANSLATION_ADDON) || prompt.includes(`\n\n${GERMAN_TRANSLATION_ADDON}`))
    assert.ok(prompt.includes('Additional translation mode:'))
    assert.ok(prompt.includes('ingredient originalText must always preserve the visible source line'))
  })

  it('does not modify the base prompt constant', () => {
    const baseBefore = EXTRACT_PROMPT
    buildImageExtractionPrompt(true)
    assert.equal(EXTRACT_PROMPT, baseBefore)
    assert.ok(!EXTRACT_PROMPT.includes('Additional translation mode:'))
  })
})
