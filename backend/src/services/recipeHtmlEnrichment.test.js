/**
 * Unit tests for recipeHtmlEnrichment (no network).
 * Run: node --test src/services/recipeHtmlEnrichment.test.js
 */

import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import * as cheerio from 'cheerio'

import {
  countSectionLines,
  extractIngredientSections,
  extractInstructions,
  extractNotes,
  extractRecipeCardData,
  findRecipeCardContainer,
  flattenIngredientSections,
  normalizeHeadingText,
  shouldAcceptHtmlIngredientSections,
} from './recipeHtmlEnrichment.js'

function loadHtml(html) {
  return cheerio.load(html)
}

const WPRM_GROUPED_HTML = `<!DOCTYPE html>
<html><body>
<article class="entry-content">
  <h1>Potato Stacks</h1>
  <p>Unrelated blog intro about my vacation.</p>
  <div class="wprm-recipe-container">
    <h2 class="wprm-recipe-name">Potato Stacks</h2>
    <div class="wprm-recipe-ingredients-container">
      <h3>Ingredients</h3>
      <div class="wprm-recipe-ingredient-group">
        <div class="wprm-recipe-ingredient-group-name">Main</div>
        <div class="wprm-recipe-ingredient"><span class="wprm-recipe-ingredient-amount">4</span> <span class="wprm-recipe-ingredient-unit"></span> <span class="wprm-recipe-ingredient-name">potatoes</span></div>
        <div class="wprm-recipe-ingredient"><span class="wprm-recipe-ingredient-amount">2</span> <span class="wprm-recipe-ingredient-unit">tbsp</span> <span class="wprm-recipe-ingredient-name">olive oil</span></div>
      </div>
      <div class="wprm-recipe-ingredient-group">
        <div class="wprm-recipe-ingredient-group-name">Herb oil</div>
        <div class="wprm-recipe-ingredient"><span class="wprm-recipe-ingredient-amount">1/4</span> <span class="wprm-recipe-ingredient-unit">cup</span> <span class="wprm-recipe-ingredient-name">olive oil</span></div>
        <div class="wprm-recipe-ingredient"><span class="wprm-recipe-ingredient-amount">2</span> <span class="wprm-recipe-ingredient-unit">tbsp</span> <span class="wprm-recipe-ingredient-name">fresh thyme</span></div>
      </div>
    </div>
    <div class="wprm-recipe-instructions-container">
      <h3>Instructions</h3>
      <div class="wprm-recipe-instruction"><span class="wprm-recipe-instruction-text">Slice potatoes thinly.</span></div>
      <div class="wprm-recipe-instruction"><span class="wprm-recipe-instruction-text">Brush with herb oil and bake.</span></div>
    </div>
    <div class="wprm-recipe-notes-container">
      <h3>Notes</h3>
      <p>Store leftovers in an airtight container for up to 3 days.</p>
      <p>Reheat in the oven for best texture.</p>
    </div>
  </div>
  <section class="faq"><h2>FAQ</h2><p>Can I use sweet potatoes?</p></section>
  <section class="comments"><h2>Comments</h2><p>Leave a comment below.</p></section>
</article>
</body></html>`

const HTML_ONLY_HEADINGS = `<!DOCTYPE html>
<html><body>
<article class="entry-content">
  <h1>Weeknight Salad</h1>
  <p>Long blog story about farmers market visit and unrelated content.</p>
  <h2>Ingredients</h2>
  <ul>
    <li>2 cups mixed greens</li>
    <li>1 tbsp lemon juice</li>
    <li>2 tbsp olive oil</li>
  </ul>
  <h2>Instructions</h2>
  <ol>
    <li>Whisk dressing.</li>
    <li>Toss greens with dressing.</li>
  </ol>
  <h2>Notes</h2>
  <ul>
    <li>Add avocado just before serving.</li>
  </ul>
  <h2>Nutrition Facts</h2>
  <p>Calories: 120</p>
  <h2>Comments</h2>
  <p>Did you make this recipe?</p>
</article>
</body></html>`

const NOISE_PAGE = `<!DOCTYPE html>
<html><body>
<article>
  <h2>FAQ</h2><p>Common questions about our site.</p>
  <h2>Related Recipes</h2><ul><li>Other salad</li></ul>
  <h2>Equipment</h2><ul><li>Blender</li></ul>
</article>
</body></html>`

describe('normalizeHeadingText', () => {
  it('normalizes punctuation and case', () => {
    assert.equal(normalizeHeadingText('  Ingredients:  '), 'ingredients')
    assert.equal(normalizeHeadingText('Tips &amp; Notes'), 'tips & notes')
  })
})

describe('shouldAcceptHtmlIngredientSections', () => {
  it('accepts when counts match', () => {
    const warnings = []
    assert.equal(shouldAcceptHtmlIngredientSections(4, 4, warnings), true)
    assert.equal(warnings.length, 0)
  })

  it('accepts when above 75% threshold', () => {
    const warnings = []
    assert.equal(shouldAcceptHtmlIngredientSections(3, 4, warnings), true)
  })

  it('rejects large mismatch', () => {
    const warnings = []
    assert.equal(shouldAcceptHtmlIngredientSections(1, 10, warnings), false)
    assert.match(warnings[0], /count mismatch/)
  })
})

describe('WPRM grouped extraction (plantyou-style)', () => {
  it('finds recipe card and Herb oil group', () => {
    const $ = loadHtml(WPRM_GROUPED_HTML)
    const card = findRecipeCardContainer($)
    assert.ok(card)
    const sections = extractIngredientSections($, card)
    assert.equal(sections.length, 2)
    assert.equal(sections[1].heading, 'Herb oil')
    assert.equal(countSectionLines(sections), 4)
  })

  it('extracts notes but not FAQ/comments', () => {
    const $ = loadHtml(WPRM_GROUPED_HTML)
    const card = findRecipeCardContainer($)
    const notes = extractNotes($, card)
    assert.equal(notes.length, 2)
    assert.match(notes[0], /airtight container/)
    assert.ok(!notes.some((n) => /comment/i.test(n)))
  })

  it('extracts instructions from card', () => {
    const $ = loadHtml(WPRM_GROUPED_HTML)
    const card = findRecipeCardContainer($)
    const steps = extractInstructions($, card)
    assert.equal(steps.length, 2)
  })
})

describe('extractRecipeCardData', () => {
  it('returns grouped ingredients and notes for WPRM card', () => {
    const $ = loadHtml(WPRM_GROUPED_HTML)
    const warnings = []
    const data = extractRecipeCardData($, 'https://plantyou.com/potato-stacks', warnings)
    assert.equal(data.cardFound, true)
    assert.equal(data.ingredient_sections.length, 2)
    assert.equal(flattenIngredientSections(data.ingredient_sections).length, 4)
    assert.equal(data.notes.length, 2)
    assert.equal(data.steps.length, 2)
  })

  it('warns when card missing', () => {
    const $ = loadHtml(NOISE_PAGE)
    const warnings = []
    const data = extractRecipeCardData($, 'https://example.com', warnings)
    assert.equal(data.cardFound, false)
    assert.ok(warnings.some((w) => /container not found/i.test(w)))
  })
})

describe('HTML-only heading extraction', () => {
  it('extracts ingredients, steps, notes from article', () => {
    const $ = loadHtml(HTML_ONLY_HEADINGS)
    const card = findRecipeCardContainer($)
    assert.ok(card)
    const sections = extractIngredientSections($, card)
    assert.equal(countSectionLines(sections), 3)
    const steps = extractInstructions($, card)
    assert.equal(steps.length, 2)
    const notes = extractNotes($, card)
    assert.equal(notes.length, 1)
    assert.match(notes[0], /avocado/)
  })

  it('does not treat nutrition or comments as notes', () => {
    const $ = loadHtml(HTML_ONLY_HEADINGS)
    const card = findRecipeCardContainer($)
    const notes = extractNotes($, card)
    assert.ok(!notes.some((n) => /calories/i.test(n)))
    assert.ok(!notes.some((n) => /did you make/i.test(n)))
  })
})

describe('noise exclusion', () => {
  it('does not extract FAQ/equipment as recipe content', () => {
    const $ = loadHtml(NOISE_PAGE)
    const card = findRecipeCardContainer($)
    if (card) {
      const sections = extractIngredientSections($, card)
      const notes = extractNotes($, card)
      assert.equal(countSectionLines(sections), 0)
      assert.equal(notes.length, 0)
    }
  })
})
