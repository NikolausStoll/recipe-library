/**
 * Unit tests for imperialUnitConversionService.
 * Run: node --test tests/services/imperialUnitConversionService.test.js
 */

import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  classifyImperialUnit,
  convertImperialIngredientRow,
  convertImperialUnitsInEnvelope,
  isLikelyLiquidIngredient,
  roundKitchenAmount,
} from '../../src/services/imperialUnitConversionService.js'

describe('classifyImperialUnit', () => {
  it('detects weight oz, pounds, and fluid ounces', () => {
    assert.equal(classifyImperialUnit('oz'), 'oz')
    assert.equal(classifyImperialUnit('OZ'), 'oz')
    assert.equal(classifyImperialUnit('lb'), 'lb')
    assert.equal(classifyImperialUnit('lbs'), 'lb')
    assert.equal(classifyImperialUnit('fl oz'), 'fl_oz')
    assert.equal(classifyImperialUnit('g'), null)
  })
})

describe('roundKitchenAmount', () => {
  it('rounds to nearest 5 g/ml', () => {
    assert.equal(roundKitchenAmount(425.25), 425)
    assert.equal(roundKitchenAmount(113.4), 115)
  })
})

describe('convertImperialIngredientRow', () => {
  it('converts canned chickpeas from oz to g', () => {
    const converted = convertImperialIngredientRow({
      originalText: '15 oz chickpeas, drained and rinsed',
      amount: 15,
      amountMax: 15,
      unit: 'oz',
      ingredient: 'Kichererbsen',
      additionalInfo: 'aus der Dose, abgetropft und abgespült',
      category: 'legumes',
    })
    assert.equal(converted.unit, 'g')
    assert.equal(converted.amount, 425)
    assert.equal(converted.amountMax, 425)
    assert.equal(converted.ingredient, 'Kichererbsen')
  })

  it('converts pounds to grams', () => {
    const converted = convertImperialIngredientRow({
      amount: 1,
      amountMax: 1,
      unit: 'lb',
      ingredient: 'Kartoffeln',
    })
    assert.equal(converted.unit, 'g')
    assert.equal(converted.amount, 455)
  })

  it('converts fluid ounces to ml', () => {
    const converted = convertImperialIngredientRow({
      amount: 4,
      amountMax: 4,
      unit: 'fl oz',
      ingredient: 'Milch',
    })
    assert.equal(converted.unit, 'ml')
    assert.equal(converted.amount, 120)
  })

  it('converts oz on likely liquids to ml', () => {
    assert.equal(isLikelyLiquidIngredient('Olivenöl', null), true)
    const converted = convertImperialIngredientRow({
      amount: 4,
      amountMax: 4,
      unit: 'oz',
      ingredient: 'Olivenöl',
    })
    assert.equal(converted.unit, 'ml')
    assert.equal(converted.amount, 120)
  })
})

describe('convertImperialUnitsInEnvelope', () => {
  it('converts imperial rows inside ingredient sections', () => {
    const { envelope, convertedCount } = convertImperialUnitsInEnvelope({
      recipe: {
        ingredientsSections: [
          {
            heading: null,
            items: [
              {
                amount: 15,
                amountMax: 15,
                unit: 'oz',
                ingredient: 'Kichererbsen',
              },
              {
                amount: 1,
                amountMax: 1,
                unit: 'TL',
                ingredient: 'Salz',
              },
            ],
          },
        ],
      },
    })
    assert.equal(convertedCount, 1)
    assert.equal(envelope.recipe.ingredientsSections[0].items[0].unit, 'g')
    assert.equal(envelope.recipe.ingredientsSections[0].items[0].amount, 425)
    assert.equal(envelope.recipe.ingredientsSections[0].items[1].unit, 'TL')
  })
})
