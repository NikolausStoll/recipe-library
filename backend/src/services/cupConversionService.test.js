/**
 * Unit tests for cupConversionService (no DB, no OpenAI).
 * Run: node --test src/services/cupConversionService.test.js
 */

import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  isCupUnit,
  CUP_UNIT_VARIANTS,
  extractCupIngredientRows,
  buildCupConversionRequest,
  mergeCupConversionResponse,
  cupIngredientId,
  convertCupIngredients,
} from './cupConversionService.js'

// ---------------------------------------------------------------------------
// isCupUnit
// ---------------------------------------------------------------------------

describe('isCupUnit', () => {
  it('returns true for all cup variant strings', () => {
    for (const v of CUP_UNIT_VARIANTS) {
      assert.equal(isCupUnit(v), true, `expected "${v}" to be cup unit`)
      assert.equal(isCupUnit(v.toUpperCase()), true, `case-insensitive: "${v.toUpperCase()}"`)
    }
  })

  it('returns false for non-cup units', () => {
    for (const v of ['g', 'ml', 'EL', 'TL', 'Zehen', null, undefined, '']) {
      assert.equal(isCupUnit(v), false, `expected "${v}" not to be cup unit`)
    }
  })
})

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

function makeEnvelope(sections) {
  return {
    status: 'success',
    confidence: 1,
    warnings: [],
    missingFields: [],
    recipe: { ingredientsSections: sections },
  }
}

function ingRow(ingredient, unit, amount = 1) {
  return {
    originalText: `${amount} ${unit} ${ingredient}`,
    amount,
    amountMax: amount,
    unit,
    ingredient,
    additionalInfo: null,
    category: 'other',
  }
}

// ---------------------------------------------------------------------------
// extractCupIngredientRows
// ---------------------------------------------------------------------------

describe('extractCupIngredientRows', () => {
  it('returns empty array for envelope with no sections', () => {
    assert.deepEqual(extractCupIngredientRows({}), [])
  })

  it('returns only cup rows with correct ids', () => {
    const envelope = makeEnvelope([
      {
        heading: null,
        items: [
          ingRow('Spinat', 'cup'),   // 0:0  ← cup
          ingRow('Salz', 'TL'),      // 0:1
          ingRow('Mehl', 'Tasse'),   // 0:2  ← cup
        ],
      },
      {
        heading: 'Dressing',
        items: [
          ingRow('Olivenöl', 'EL'),  // 1:0
          ingRow('Kichererbsen', 'cups', 2), // 1:1  ← cup
        ],
      },
    ])

    const rows = extractCupIngredientRows(envelope)
    assert.equal(rows.length, 3)
    assert.equal(rows[0].id, '0:0')
    assert.equal(rows[1].id, '0:2')
    assert.equal(rows[2].id, '1:1')
    assert.equal(rows[2].sectionIndex, 1)
    assert.equal(rows[2].itemIndex, 1)
  })
})

// ---------------------------------------------------------------------------
// buildCupConversionRequest
// ---------------------------------------------------------------------------

describe('buildCupConversionRequest', () => {
  it('returns null when no cup rows exist', () => {
    const envelope = makeEnvelope([
      { heading: null, items: [ingRow('Salz', 'TL')] },
    ])
    assert.equal(buildCupConversionRequest(envelope), null)
  })

  it('request only contains id/amount/amountMax/unit/ingredient/additionalInfo — no originalText or category', () => {
    const envelope = makeEnvelope([
      { heading: null, items: [ingRow('Spinat', 'cup')] },
    ])
    const req = buildCupConversionRequest(envelope)
    assert.ok(req)
    assert.equal(req.ingredients.length, 1)
    const item = req.ingredients[0]
    assert.equal(item.id, '0:0')
    assert.ok('amount' in item)
    assert.ok('amountMax' in item)
    assert.ok('unit' in item)
    assert.ok('ingredient' in item)
    assert.ok('additionalInfo' in item)
    assert.ok(!('originalText' in item))
    assert.ok(!('category' in item))
    assert.ok(!('sectionIndex' in item))
    assert.ok(!('itemIndex' in item))
    assert.ok(!('cupReferences' in req))
  })
})

// ---------------------------------------------------------------------------
// mergeCupConversionResponse
// ---------------------------------------------------------------------------

describe('mergeCupConversionResponse', () => {
  const baseEnvelope = makeEnvelope([
    {
      heading: null,
      items: [
        ingRow('Spinat', 'cup'),    // 0:0
        ingRow('Salz', 'TL'),       // 0:1 — not cup, stays
        ingRow('Mehl', 'Tasse'),    // 0:2
      ],
    },
  ])

  it('action=keep leaves row unchanged', () => {
    const response = {
      items: [
        { id: '0:0', action: 'keep', amount: null, amountMax: null, unit: null, confidence: 1 },
        { id: '0:2', action: 'keep', amount: null, amountMax: null, unit: null, confidence: 1 },
      ],
    }
    const { envelope } = mergeCupConversionResponse(baseEnvelope, response, ['0:0', '0:2'])
    const items = envelope.recipe.ingredientsSections[0].items
    assert.equal(items[0].unit, 'cup')
    assert.equal(items[2].unit, 'Tasse')
  })

  it('action=convert updates amount/amountMax/unit only', () => {
    const response = {
      items: [
        { id: '0:0', action: 'convert', amount: 30, amountMax: 30, unit: 'g', confidence: 0.9 },
        { id: '0:2', action: 'keep', amount: null, amountMax: null, unit: null, confidence: 1 },
      ],
    }
    const { envelope } = mergeCupConversionResponse(baseEnvelope, response, ['0:0', '0:2'])
    const items = envelope.recipe.ingredientsSections[0].items
    assert.equal(items[0].amount, 30)
    assert.equal(items[0].unit, 'g')
    assert.equal(items[1].unit, 'TL')   // non-cup row unchanged
    assert.equal(items[2].unit, 'Tasse') // keep unchanged
  })

  it('preserves originalText, category, ingredient, additionalInfo after convert', () => {
    const response = {
      items: [
        { id: '0:0', action: 'convert', amount: 30, amountMax: 30, unit: 'g', confidence: 0.9 },
        { id: '0:2', action: 'keep', amount: null, amountMax: null, unit: null, confidence: 1 },
      ],
    }
    const { envelope } = mergeCupConversionResponse(baseEnvelope, response, ['0:0', '0:2'])
    const items = envelope.recipe.ingredientsSections[0].items
    assert.equal(items[0].originalText, '1 cup Spinat')
    assert.equal(items[0].category, 'other')
    assert.equal(items[0].ingredient, 'Spinat')
    assert.equal(items[0].additionalInfo, null)
  })

  it('ignores unexpected ingredient/additionalInfo fields in convert response', () => {
    const response = {
      items: [
        {
          id: '0:0',
          action: 'convert',
          amount: 30,
          amountMax: 30,
          unit: 'g',
          confidence: 0.9,
          ingredient: 'SHOULD BE IGNORED',
          additionalInfo: 'ALSO IGNORED',
        },
        { id: '0:2', action: 'keep', amount: null, amountMax: null, unit: null, confidence: 1 },
      ],
    }
    const { envelope } = mergeCupConversionResponse(baseEnvelope, response, ['0:0', '0:2'])
    const items = envelope.recipe.ingredientsSections[0].items
    assert.equal(items[0].ingredient, 'Spinat')         // original preserved
    assert.equal(items[0].additionalInfo, null)          // original preserved
    assert.equal(items[0].unit, 'g')                    // amount fields updated
  })

  it('ingredient row order is preserved', () => {
    const response = {
      items: [
        { id: '0:2', action: 'convert', amount: 120, amountMax: 120, unit: 'g', confidence: 0.9 },
        { id: '0:0', action: 'keep', amount: null, amountMax: null, unit: null, confidence: 1 },
      ],
    }
    const { envelope } = mergeCupConversionResponse(baseEnvelope, response, ['0:0', '0:2'])
    const items = envelope.recipe.ingredientsSections[0].items
    // Order must match original section order, not response order
    assert.equal(items[0].ingredient, 'Spinat')
    assert.equal(items[1].ingredient, 'Salz')
    assert.equal(items[2].ingredient, 'Mehl')
  })

  it('missing id from response adds warning and keeps row unchanged', () => {
    const response = {
      items: [
        { id: '0:0', action: 'keep', amount: null, amountMax: null, unit: null, ingredient: null, additionalInfo: null, confidence: 1 },
        // 0:2 missing
      ],
    }
    const { warnings, partial } = mergeCupConversionResponse(baseEnvelope, response, ['0:0', '0:2'])
    assert.equal(partial, true)
    assert.ok(warnings.some((w) => w.includes('partially failed')))
  })
})

// ---------------------------------------------------------------------------
// convertCupIngredients — integration (no real LLM)
// ---------------------------------------------------------------------------

describe('convertCupIngredients', () => {
  it('skips LLM call when no cup rows', async () => {
    let called = false
    const envelope = makeEnvelope([
      { heading: null, items: [ingRow('Salz', 'TL')] },
    ])
    const result = await convertCupIngredients(envelope, {
      callLLM: async () => {
        called = true
        return {}
      },
    })
    assert.equal(called, false)
    assert.equal(result.skipped, true)
    assert.equal(result.meta.cupRowCount, 0)
  })

  it('calls LLM and merges when cup rows exist', async () => {
    const envelope = makeEnvelope([
      { heading: null, items: [ingRow('Spinat', 'cup')] },
    ])
    const fakeResponse = {
      items: [
        { id: '0:0', action: 'convert', amount: 30, amountMax: 30, unit: 'g', ingredient: null, additionalInfo: null, confidence: 0.9 },
      ],
    }
    const result = await convertCupIngredients(envelope, {
      callLLM: async () => ({ response: fakeResponse, usage: null, model: 'test-model', request_json: '{}' }),
    })
    assert.equal(result.skipped, false)
    assert.equal(result.meta.cupRowCount, 1)
    const items = result.envelope.recipe.ingredientsSections[0].items
    assert.equal(items[0].unit, 'g')
    assert.equal(items[0].amount, 30)
  })

  it('on LLM failure returns original envelope with warning', async () => {
    const envelope = makeEnvelope([
      { heading: null, items: [ingRow('Mehl', 'Tasse')] },
    ])
    const result = await convertCupIngredients(envelope, {
      callLLM: async () => { throw new Error('OpenAI down') },
    })
    assert.equal(result.skipped, false)
    const items = result.envelope.recipe.ingredientsSections[0].items
    assert.equal(items[0].unit, 'Tasse') // unchanged
    assert.ok(result.warnings.some((w) => w.includes('Cup conversion failed')))
  })
})
