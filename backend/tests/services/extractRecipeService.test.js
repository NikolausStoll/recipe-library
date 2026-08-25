/**
 * Unit tests for image extraction prompt building (no OpenAI).
 * Run: node --test tests/services/extractRecipeService.test.js
 */

import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  EXTRACT_PROMPT,
  GERMAN_TRANSLATION_ADDON,
  RECIPE_JSON_SCHEMA,
  buildImageExtractionPrompt,
  buildImageExtractionUserMessage,
  parseTranslateToGerman,
} from '../../src/services/extractRecipeService.js'

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
  it('includes base extract prompt and English parsing rules when translateToGerman is false', () => {
    const prompt = buildImageExtractionPrompt(false)
    assert.equal(buildImageExtractionPrompt(), prompt)
    assert.ok(prompt.includes('Preserve the original language of the recipe.'))
    assert.ok(prompt.includes('never put quantity phrases in additionalInfo'))
    assert.ok(prompt.includes('unit: "handful"'))
    assert.ok(prompt.includes('unit: "splash"'))
  })

  it('uses German output instruction and add-on when translateToGerman is true', () => {
    const prompt = buildImageExtractionPrompt(true)
    assert.ok(!prompt.includes('Preserve the original language of the recipe.'))
    assert.ok(prompt.includes('The user requested German output; translate the extracted recipe fields'))
    assert.ok(prompt.includes('merge the content into one coherent recipe'))
    assert.ok(prompt.endsWith(GERMAN_TRANSLATION_ADDON) || prompt.includes(`\n\n${GERMAN_TRANSLATION_ADDON}`))
    assert.ok(prompt.includes('Additional translation mode:'))
    assert.ok(prompt.includes('Preserve ingredient originalText exactly.'))
    assert.ok(prompt.includes('recipe.introText'))
    assert.ok(!prompt.includes('recipe.description'))
    assert.ok(prompt.includes('ingredient: always provide a clean German ingredient name.'))
    assert.ok(prompt.includes('Set recipe.language to "de"'))
    assert.ok(prompt.includes('unit: "Schuss"'))
    assert.ok(prompt.includes('a pinch of sea salt'))
    assert.ok(!prompt.includes('Put preparation notes, alternatives, ranges, and qualifiers into additionalInfo'))
  })

  it('does not modify the base prompt constant', () => {
    const baseBefore = EXTRACT_PROMPT
    buildImageExtractionPrompt(true)
    assert.equal(EXTRACT_PROMPT, baseBefore)
    assert.ok(!EXTRACT_PROMPT.includes('Additional translation mode:'))
    assert.ok(!EXTRACT_PROMPT.includes('Ingredient parsing:'))
  })

  it('places ingredient parsing block before the language instruction', () => {
    const prompt = buildImageExtractionPrompt(false)
    const parsingIdx = prompt.indexOf('Ingredient parsing:')
    const languageIdx = prompt.indexOf('Preserve the original language of the recipe.')
    assert.ok(parsingIdx >= 0)
    assert.ok(languageIdx > parsingIdx)
  })
})

describe('RECIPE_JSON_SCHEMA', () => {
  it('requires structured ingredient fields including unit and originalText', () => {
    const itemSchema =
      RECIPE_JSON_SCHEMA.properties.recipe.properties.ingredientsSections.items.properties.items.items
    assert.deepEqual(itemSchema.required, [
      'originalText',
      'amount',
      'amountMax',
      'unit',
      'ingredient',
      'additionalInfo',
      'category',
    ])
    assert.ok(itemSchema.properties.unit.description.includes('Prise'))
  })
})

describe('logAiTokenUsage', () => {
  it('inserts a row into ai_token_usage', async () => {
    process.env.DB_PATH = ':memory:'
    const { initDb, getDb } = await import('../../src/db/index.js')
    initDb()
    const { logAiTokenUsage } = await import('../../src/services/extractRecipeService.js')

    logAiTokenUsage(null, { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 }, { ok: true }, {
      model: 'gpt-4.1-mini',
      usage_kind: 'test',
    })

    const row = getDb()
      .prepare('SELECT recipe_id, total_tokens, model, usage_kind FROM ai_token_usage ORDER BY id DESC LIMIT 1')
      .get()
    assert.equal(row.recipe_id, null)
    assert.equal(row.total_tokens, 15)
    assert.equal(row.model, 'gpt-4.1-mini')
    assert.equal(row.usage_kind, 'test')
    delete process.env.DB_PATH
  })
})

describe('buildImageExtractionUserMessage', () => {
  it('returns the default extract message when translateToGerman is false', () => {
    const message = buildImageExtractionUserMessage(false)
    assert.equal(message, 'Extract the recipe from the following image(s). Return valid JSON matching the schema.')
    assert.equal(buildImageExtractionUserMessage(), message)
  })

  it('asks for German translation when translateToGerman is true', () => {
    const message = buildImageExtractionUserMessage(true)
    assert.ok(message.includes('Translate the extracted fields to German'))
    assert.ok(message.includes('Keep ingredient originalText unchanged'))
    assert.ok(message.includes('Return valid JSON matching the schema'))
  })

  it('does not mention German parsing hints when translateToGerman is false', () => {
    const message = buildImageExtractionUserMessage(false)
    assert.ok(!message.includes('parse pinch/handful/drizzle'))
  })
})
