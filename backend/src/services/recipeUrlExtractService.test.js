/**
 * Unit tests for recipeUrlExtractService merge/enrichment (no network).
 * Run: node --test src/services/recipeUrlExtractService.test.js
 */

import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { scrapeRecipeFromHtmlForTest } from './recipeUrlExtractService.js'

const WPRM_WITH_JSONLD = `<!DOCTYPE html>
<html><body>
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "Recipe",
  "name": "Potato Stacks",
  "recipeIngredient": ["4 potatoes", "2 tbsp olive oil", "1/4 cup olive oil", "2 tbsp fresh thyme"],
  "recipeInstructions": ["Slice potatoes.", "Bake with herb oil."]
}
</script>
<div class="wprm-recipe-container">
  <div class="wprm-recipe-ingredient-group">
    <div class="wprm-recipe-ingredient-group-name">Main</div>
    <div class="wprm-recipe-ingredient"><span class="wprm-recipe-ingredient-amount">4</span> <span class="wprm-recipe-ingredient-name">potatoes</span></div>
    <div class="wprm-recipe-ingredient"><span class="wprm-recipe-ingredient-amount">2</span> <span class="wprm-recipe-ingredient-unit">tbsp</span> <span class="wprm-recipe-ingredient-name">olive oil</span></div>
  </div>
  <div class="wprm-recipe-ingredient-group">
    <div class="wprm-recipe-ingredient-group-name">Herb oil</div>
    <div class="wprm-recipe-ingredient"><span class="wprm-recipe-ingredient-amount">1/4</span> <span class="wprm-recipe-ingredient-unit">cup</span> <span class="wprm-recipe-ingredient-name">olive oil</span></div>
    <div class="wprm-recipe-ingredient"><span class="wprm-recipe-ingredient-amount">2</span> <span class="wprm-recipe-ingredient-unit">tbsp</span> <span class="wprm-recipe-ingredient-name">fresh thyme</span></div>
  </div>
  <div class="wprm-recipe-instruction-text">Slice potatoes.</div>
  <div class="wprm-recipe-instruction-text">Bake with herb oil.</div>
  <div class="wprm-recipe-notes-container"><p>Store up to 3 days.</p></div>
</div>
</body></html>`

const JSONLD_ONLY = `<!DOCTYPE html>
<html><body>
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "Recipe",
  "name": "Simple Pasta",
  "recipeIngredient": ["200 g pasta", "2 tbsp olive oil", "1 clove garlic"],
  "recipeInstructions": ["Boil pasta.", "Sauté garlic.", "Toss."]
}
</script>
</body></html>`

const MISMATCH_HTML = `<!DOCTYPE html>
<html><body>
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "Recipe",
  "name": "Soup",
  "recipeIngredient": ["1 onion", "2 carrots", "3 celery stalks", "4 cups broth"],
  "recipeInstructions": ["Chop.", "Simmer."]
}
</script>
<div class="wprm-recipe-container">
  <div class="wprm-recipe-ingredient"><span class="wprm-recipe-ingredient-name">1 onion</span></div>
</div>
</body></html>`

describe('scrapeRecipeFromHtmlForTest', () => {
  it('enriches JSON-LD with HTML groups and notes', () => {
    const result = scrapeRecipeFromHtmlForTest(WPRM_WITH_JSONLD, 'https://plantyou.com/potato-stacks')
    assert.equal(result.source, 'jsonld+html')
    assert.equal(result.recipe.ingredient_sections.length, 2)
    assert.equal(result.recipe.ingredient_sections[1].heading, 'Herb oil')
    assert.equal(result.recipe.notes.length, 1)
    assert.equal(result.recipe.ingredient_lines.length, 4)
  })

  it('keeps JSON-LD-only extraction working', () => {
    const result = scrapeRecipeFromHtmlForTest(JSONLD_ONLY, 'https://example.com/pasta')
    assert.equal(result.source, 'jsonld')
    assert.equal(result.recipe.ingredient_lines.length, 3)
    assert.equal(result.recipe.steps.length, 3)
  })

  it('rejects HTML groups when count mismatch is too large', () => {
    const result = scrapeRecipeFromHtmlForTest(MISMATCH_HTML, 'https://example.com/soup')
    assert.ok(result.warnings.some((w) => /count mismatch/i.test(w)))
    assert.equal(result.recipe.ingredient_lines.length, 4)
    assert.equal(result.recipe.ingredient_sections[0]?.heading, null)
  })
})
