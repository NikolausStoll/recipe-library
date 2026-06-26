/**
 * Tests for linking website sources from recipes.original_url.
 * Run: node --test tests/services/recipeSourceLink.test.js
 */

import assert from 'node:assert/strict'
import { after, before, describe, it } from 'node:test'

process.env.DB_PATH = ':memory:'

const { initDb } = await import('../../src/db/index.js')
const { createRecipe, updateRecipe, getRecipeById } = await import('../../src/services/recipeService.js')
const { listSources } = await import('../../src/services/sourceService.js')

before(() => {
  initDb()
})

after(() => {
  delete process.env.DB_PATH
})

describe('recipe source linking from original_url', () => {
  it('creates a website source when a manual recipe is saved with original_url', () => {
    const recipe = createRecipe({
      title: 'Manual with URL',
      original_url: 'https://example.com/recipes/pasta',
    })
    assert.equal(recipe.source_id != null, true)
    assert.equal(recipe.original_url, 'https://example.com/recipes/pasta')

    const sources = listSources().filter((s) => s.type === 'url')
    assert.equal(sources.length, 1)
    assert.equal(sources[0].domain, 'example.com')
  })

  it('links an existing recipe when original_url is added later', () => {
    const created = createRecipe({ title: 'No URL yet' })
    assert.equal(created.source_id, null)

    const updated = updateRecipe(created.id, {
      original_url: 'https://chef.example.org/dessert',
    })
    assert.equal(updated.source_id != null, true)
    assert.equal(updated.original_url, 'https://chef.example.org/dessert')

    const sources = listSources().filter((s) => s.domain === 'chef.example.org')
    assert.equal(sources.length, 1)
  })

  it('reuses an existing website source for the same domain', () => {
    const first = createRecipe({
      title: 'First',
      original_url: 'https://reuse.test/a',
    })
    const second = createRecipe({
      title: 'Second',
      original_url: 'https://reuse.test/b',
    })
    assert.equal(first.source_id, second.source_id)

    const row = getRecipeById(second.id)
    assert.equal(row.original_url, 'https://reuse.test/b')
  })

  it('keeps a cookbook source when original_url is also set', () => {
    const withBook = createRecipe({
      title: 'From book',
      source_name: 'Mein Kochbuch',
      book_title: 'Mein Kochbuch',
      original_url: 'https://books.example/recipe/1',
    })
    assert.equal(withBook.source_id != null, true)
    assert.equal(withBook.original_url, 'https://books.example/recipe/1')

    const sources = listSources()
    const book = sources.find((s) => s.name === 'Mein Kochbuch')
    const website = sources.find((s) => s.domain === 'books.example')
    assert.equal(book?.type, 'book')
    assert.equal(withBook.source_id, book?.id)
    assert.equal(website, undefined)
  })

  it('does not relink when update payload omits original_url', () => {
    const created = createRecipe({
      title: 'Stable link',
      original_url: 'https://stable.test/recipe',
    })
    const sourceId = created.source_id
    assert.equal(sourceId != null, true)

    const updated = updateRecipe(created.id, { title: 'Stable link renamed' })
    assert.equal(updated.source_id, sourceId)
  })
})
