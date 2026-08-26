import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  buildTextExtractionPrompt,
  getTextExtractionModel,
} from '../../src/services/textRecipeExtractionService.js'

describe('textRecipeExtractionService', () => {
  it('uses the dedicated configurable model', () => {
    const previous = process.env.OPENAI_TEXT_EXTRACT_MODEL
    process.env.OPENAI_TEXT_EXTRACT_MODEL = 'test-text-model'
    assert.equal(getTextExtractionModel(), 'test-text-model')
    if (previous == null) delete process.env.OPENAI_TEXT_EXTRACT_MODEL
    else process.env.OPENAI_TEXT_EXTRACT_MODEL = previous
  })

  it('keeps the text prompt independent from image/OCR instructions', () => {
    const prompt = buildTextExtractionPrompt(false)
    assert.match(prompt, /arbitrary pasted plain text/)
    assert.match(prompt, /Preserve the source language/)
    assert.match(prompt, /Set recipe\.language to the detected source language when clear; otherwise null/)
    assert.match(prompt, /This step must not convert cup-based ingredients/)
    assert.doesNotMatch(prompt, /image readability|occluded|OCR/i)
  })

  it('adds German translation instructions without translating originalText', () => {
    const prompt = buildTextExtractionPrompt(true)
    assert.match(prompt, /Set recipe\.language to "de"/)
    assert.match(prompt, /Keep ingredient originalText exactly as pasted/)
    assert.match(prompt, /never use formal "Sie"/)
    assert.match(prompt, /Never translate recipe\.title/)
    assert.match(prompt, /natural German recipe language for home cooks/)
  })

  it('distinguishes preparation serving instructions from separate serving tips', () => {
    const prompt = buildTextExtractionPrompt(false)
    assert.match(prompt, /Serving instructions that are part of the actual preparation flow/)
    assert.match(prompt, /Separately presented serving advice may also become a tip/)
    assert.match(prompt, /Mit Parmesan bestreuen und sofort servieren/)
  })
})