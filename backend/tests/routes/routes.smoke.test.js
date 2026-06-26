/**
 * Smoke tests for HTTP routes (in-memory DB, no OpenAI).
 * Run: node --test tests/routes/routes.smoke.test.js
 */

import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { after, before, describe, it } from 'node:test'
import { once } from 'node:events'
import express from 'express'

process.env.DB_PATH = ':memory:'

const { initDb } = await import('../../src/db/index.js')
const apiRouter = (await import('../../src/routes/index.js')).default
const { parseTranslateToGerman } = await import('../../src/services/extractRecipeService.js')

before(() => {
  initDb()
})

after(() => {
  delete process.env.DB_PATH
})

/**
 * @param {(baseUrl: string) => Promise<void>} fn
 */
async function withTestServer(fn) {
  const app = express()
  app.use(express.json())
  app.use('/api', apiRouter)
  const server = createServer(app)
  server.listen(0)
  await once(server, 'listening')
  const address = server.address()
  const port = typeof address === 'object' && address ? address.port : 0
  try {
    await fn(`http://127.0.0.1:${port}`)
  } finally {
    server.close()
  }
}

describe('GET /api/health', () => {
  it('returns ok status', async () => {
    await withTestServer(async (baseUrl) => {
      const res = await fetch(`${baseUrl}/api/health`)
      assert.equal(res.status, 200)
      const body = await res.json()
      assert.equal(body.status, 'ok')
    })
  })
})

describe('POST /api/recipes/:id/extract-from-images', () => {
  it('returns 400 when no images are uploaded for an existing recipe', async () => {
    await withTestServer(async (baseUrl) => {
      const { createRecipe } = await import('../../src/services/recipeService.js')
      const recipe = createRecipe({ title: 'Smoke test' })
      const res = await fetch(`${baseUrl}/api/recipes/${recipe.id}/extract-from-images`, { method: 'POST' })
      assert.equal(res.status, 400)
      const body = await res.json()
      assert.ok(body.error)
    })
  })

  it('returns 404 for unknown recipe id', async () => {
    await withTestServer(async (baseUrl) => {
      const res = await fetch(`${baseUrl}/api/recipes/99999/extract-from-images`, { method: 'POST' })
      assert.equal(res.status, 404)
      const body = await res.json()
      assert.ok(body.error)
    })
  })
})

describe('parseTranslateToGerman (multipart contract)', () => {
  it('matches route parsing for string and boolean values', () => {
    assert.equal(parseTranslateToGerman('true'), true)
    assert.equal(parseTranslateToGerman('false'), false)
    assert.equal(parseTranslateToGerman(undefined), false)
  })
})
