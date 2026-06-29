/**
 * Unit tests for recipeNormalizationService payload shaping (no OpenAI).
 * Run: node --test tests/services/recipeNormalizationService.test.js
 */

import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  buildCanonicalIngredientSections,
  buildNormalizationPayloadForModel,
  finalizeNormalizedTips,
  finalizeNormalizedRecipe,
  realignNormalizedSteps,
  mergeScrapedNotesIntoEnvelope,
  sanitizeNormalizedTips,
} from '../../src/services/recipeNormalizationService.js'

describe('buildCanonicalIngredientSections', () => {
  it('prefers ingredient_sections when sections have lines', () => {
    const sections = buildCanonicalIngredientSections({
      ingredient_lines: ['duplicate a', 'duplicate b'],
      ingredient_sections: [
        { heading: null, lines: ['2 cups flour', '1 tsp salt'] },
        { heading: 'Dressing', lines: ['2 tbsp oil'] },
      ],
    })
    assert.equal(sections.length, 2)
    assert.equal(sections[0].lines.length, 2)
    assert.equal(sections[1].heading, 'Dressing')
    assert.deepEqual(sections[1].lines, ['2 tbsp oil'])
  })

  it('converts flat ingredient_lines when sections missing', () => {
    const sections = buildCanonicalIngredientSections({
      ingredient_lines: ['200 g pasta', '2 tbsp oil'],
    })
    assert.deepEqual(sections, [{ heading: null, lines: ['200 g pasta', '2 tbsp oil'] }])
  })

  it('falls back to ingredient_lines when ingredient_sections empty', () => {
    const sections = buildCanonicalIngredientSections({
      ingredient_lines: ['1 onion', '2 carrots'],
      ingredient_sections: [],
    })
    assert.deepEqual(sections, [{ heading: null, lines: ['1 onion', '2 carrots'] }])
  })

  it('falls back to ingredient_lines when all sections have no lines', () => {
    const sections = buildCanonicalIngredientSections({
      ingredient_lines: ['1 egg'],
      ingredient_sections: [{ heading: 'Main', lines: [] }],
    })
    assert.deepEqual(sections, [{ heading: null, lines: ['1 egg'] }])
  })

  it('preserves section order and line order', () => {
    const sections = buildCanonicalIngredientSections({
      ingredient_sections: [
        { heading: 'Main', lines: ['a', 'b'] },
        { heading: 'Herb oil', lines: ['c', 'd'] },
      ],
    })
    assert.equal(sections[0].heading, 'Main')
    assert.deepEqual(sections[0].lines, ['a', 'b'])
    assert.equal(sections[1].heading, 'Herb oil')
    assert.deepEqual(sections[1].lines, ['c', 'd'])
  })

  it('returns one empty section when no ingredients', () => {
    assert.deepEqual(buildCanonicalIngredientSections({}), [{ heading: null, lines: [] }])
  })
})

describe('buildNormalizationPayloadForModel', () => {
  it('omits ingredient_lines from LLM payload', () => {
    const payload = buildNormalizationPayloadForModel({
      title: 'Salad',
      ingredient_lines: ['1 cup greens', '1 tbsp lemon'],
      ingredient_sections: [
        { heading: null, lines: ['1 cup greens'] },
        { heading: 'Dressing', lines: ['1 tbsp lemon'] },
      ],
      steps: ['Mix.'],
      notes: ['Serve chilled.'],
    })

    assert.ok(!('ingredient_lines' in payload))
    assert.equal(payload.ingredient_sections.length, 2)
    assert.equal(payload.title, 'Salad')
    assert.deepEqual(payload.notes, ['Serve chilled.'])
  })

  it('uses converted sections when only ingredient_lines exist', () => {
    const payload = buildNormalizationPayloadForModel({
      ingredient_lines: ['3 eggs', '1 cup milk'],
      steps: ['Whisk.', 'Cook.'],
    })

    assert.ok(!('ingredient_lines' in payload))
    assert.deepEqual(payload.ingredient_sections, [{ heading: null, lines: ['3 eggs', '1 cup milk'] }])
  })

  it('does not duplicate ingredients in payload JSON', () => {
    const payload = buildNormalizationPayloadForModel({
      ingredient_lines: ['2 tbsp oil', '1 tsp salt'],
      ingredient_sections: [{ heading: null, lines: ['2 tbsp oil', '1 tsp salt'] }],
    })
    const json = JSON.stringify(payload)
    assert.ok(!json.includes('ingredient_lines'))
    const parsed = JSON.parse(json)
    assert.equal(parsed.ingredient_sections.length, 1)
    assert.equal(parsed.ingredient_sections[0].lines.length, 2)
  })
})

describe('sanitizeNormalizedTips', () => {
  it('removes tips that exactly match raw input notes after trim', () => {
    const structured = {
      recipe: {
        tips: [
          'Reste bis zu 3 Tage im Kühlschrank aufbewahren.',
          'Store leftovers in an airtight container for up to 3 days.',
          'Store leftovers in an airtight container for up to 3 days.',
        ],
      },
    }
    sanitizeNormalizedTips(structured, {
      notes: ['Store leftovers in an airtight container for up to 3 days.'],
    })
    assert.deepEqual(structured.recipe.tips, [
      'Reste bis zu 3 Tage im Kühlschrank aufbewahren.',
    ])
  })

  it('dedupes exact tips after trim while preserving order', () => {
    const structured = {
      recipe: {
        tips: ['  Tipp eins  ', 'Tipp eins', 'Tipp zwei'],
      },
    }
    sanitizeNormalizedTips(structured, { notes: [] })
    assert.deepEqual(structured.recipe.tips, ['Tipp eins', 'Tipp zwei'])
  })

  it('leaves recipes without notes unchanged', () => {
    const structured = { recipe: { tips: ['Servieren Sie kalt.'] } }
    sanitizeNormalizedTips(structured, {})
    assert.deepEqual(structured.recipe.tips, ['Servieren Sie kalt.'])
  })
})

describe('mergeScrapedNotesIntoEnvelope', () => {
  it('adds raw notes only when LLM omitted all tips', () => {
    const structured = { recipe: { tips: [] } }
    mergeScrapedNotesIntoEnvelope(structured, {
      notes: ['Store chilled.', 'Reheat before serving.'],
    })
    assert.deepEqual(structured.recipe.tips, ['Store chilled.', 'Reheat before serving.'])
  })

  it('does not re-add raw notes when translated tips remain', () => {
    const structured = {
      recipe: { tips: ['Im Kühlschrank lagern.'] },
    }
    mergeScrapedNotesIntoEnvelope(structured, {
      notes: ['Store chilled.'],
    })
    assert.deepEqual(structured.recipe.tips, ['Im Kühlschrank lagern.'])
  })
})

describe('finalizeNormalizedTips', () => {
  it('removes English echoes and keeps German tips without re-adding raw notes', () => {
    const structured = {
      recipe: {
        tips: [
          'Reste bis zu 3 Tage aufbewahren.',
          'Store leftovers in an airtight container for up to 3 days.',
        ],
      },
    }
    finalizeNormalizedTips(structured, {
      notes: ['Store leftovers in an airtight container for up to 3 days.'],
    })
    assert.deepEqual(structured.recipe.tips, ['Reste bis zu 3 Tage aufbewahren.'])
  })
})

describe('realignNormalizedSteps', () => {
  const rawSteps = [
    'Cook the couscous or quinoa according to package directions.',
    'In the meantime, prepare the vegetables and drain and rinse the can of chickpeas.',
    'In a jar or bowl, combine all dressing ingredients until smooth. Now assemble. This works great to make salad jars by dispersing the ingredients evenly between 4 mason jars.',
    'Alternatively, assemble in a bowl, by adding the quinoa, vegetables, chickpeas, vegan feta, pistachios and dressing. Toss and store in the fridge for up to four days.',
  ]

  it('merges over-split normalized steps back to raw step count', () => {
    const structured = {
      recipe: {
        steps: [
          { index: 1, text: 'Koche den Couscous oder Quinoa nach den Anweisungen auf der Verpackung.' },
          { index: 2, text: 'Bereite in der Zwischenzeit das Gemüse vor und spüle die Kichererbsen ab.' },
          { index: 3, text: 'Vermische in einem Glas alle Dressing-Zutaten, bis es glatt ist. Jetzt assemble.' },
          { index: 4, text: 'Das funktioniert hervorragend für Salatgläser mit 4 Einmachgläsern.' },
          {
            index: 5,
            text: 'Alternativ kannst du alles in einer Schüssel zusammenstellen und im Kühlschrank aufbewahren.',
          },
        ],
      },
    }

    realignNormalizedSteps(structured, { steps: rawSteps })
    assert.equal(structured.recipe.steps.length, 4)
    assert.match(structured.recipe.steps[2].text, /Dressing/)
    assert.match(structured.recipe.steps[2].text, /Salatgläser/)
    assert.match(structured.recipe.steps[3].text, /^Alternativ/)
  })

  it('leaves matching step counts unchanged', () => {
    const structured = {
      recipe: {
        steps: [
          { index: 1, text: 'Schritt eins.' },
          { index: 2, text: 'Schritt zwei.' },
        ],
      },
    }
    realignNormalizedSteps(structured, { steps: ['Step one.', 'Step two.'] })
    assert.equal(structured.recipe.steps.length, 2)
    assert.equal(structured.recipe.steps[0].text, 'Schritt eins.')
  })
})

describe('normalization prompt wiring', () => {
  it('uses shared ingredient parsing prompt module', async () => {
    const { readFileSync } = await import('node:fs')
    const { fileURLToPath } = await import('node:url')
    const src = readFileSync(
      fileURLToPath(new URL('../../src/services/recipeNormalizationService.js', import.meta.url)),
      'utf8',
    )
    assert.ok(src.includes('buildIngredientParsingPromptBlock'))
    assert.ok(src.includes("unitLanguage: 'de'"))
    assert.ok(src.includes('includeCupHandling: true'))
  })
})
