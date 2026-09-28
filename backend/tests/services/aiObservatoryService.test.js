import { describe, it, afterEach } from 'node:test'
import assert from 'node:assert/strict'

describe('aiObservatoryService', () => {
  afterEach(() => {
    delete process.env.AI_OBSERVATORY_URL
    delete process.env.AI_OBSERVATORY_API_KEY
    delete process.env.NODE_ENV
  })

  it('mapUsageKindToFeatureOperation converts snake_case to kebab and defaults unknown', async () => {
    const {
      mapUsageKindToFeatureOperation,
    } = await import('../../src/services/aiObservatoryService.js')

    assert.deepEqual(mapUsageKindToFeatureOperation('recipe_image_extract'), {
      feature: 'recipe-image-extract',
      operation: 'recipe-image-extract',
    })
    assert.deepEqual(mapUsageKindToFeatureOperation(null), {
      feature: 'unknown',
      operation: 'unknown',
    })
  })

  it('resolveObservatoryStatus treats response.error as error', async () => {
    const { resolveObservatoryStatus } = await import('../../src/services/aiObservatoryService.js')
    assert.equal(resolveObservatoryStatus({ error: 'boom' }), 'error')
    assert.equal(resolveObservatoryStatus({ ok: true }), 'success')
    assert.equal(resolveObservatoryStatus(null), 'success')
  })

  it('resolveObservatoryEnvironment uses NODE_ENV or production', async () => {
    const { resolveObservatoryEnvironment } = await import('../../src/services/aiObservatoryService.js')
    delete process.env.NODE_ENV
    assert.equal(resolveObservatoryEnvironment(), 'production')
    process.env.NODE_ENV = 'development'
    assert.equal(resolveObservatoryEnvironment(), 'development')
  })

  it('buildObservatoryEvent maps tokens and required fields', async () => {
    process.env.NODE_ENV = 'test'
    const { buildObservatoryEvent } = await import('../../src/services/aiObservatoryService.js')
    const event = buildObservatoryEvent({
      recipeId: 42,
      usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
      responseJson: { tags: ['vegan'] },
      meta: { model: 'gpt-4o-mini', usage_kind: 'recipe_tag' },
    })

    assert.equal(typeof event.eventId, 'string')
    assert.match(event.eventId, /^[0-9a-f-]{36}$/i)
    assert.equal(event.provider, 'openai')
    assert.equal(event.feature, 'recipe-tag')
    assert.equal(event.operation, 'recipe-tag')
    assert.equal(event.status, 'success')
    assert.equal(event.environment, 'test')
    assert.equal(event.requestedModel, 'gpt-4o-mini')
    assert.equal(event.attemptNumber, 1)
    assert.equal(event.durationMs, 0)
    assert.deepEqual(event.usage, {
      inputTokens: 10,
      outputTokens: 5,
      totalTokens: 15,
      rawUsage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
    })
    assert.deepEqual(event.metadata, { recipeId: 42 })
  })

  it('reportAiUsageToObservatory is a no-op without URL/key', async () => {
    const { reportAiUsageToObservatory } = await import('../../src/services/aiObservatoryService.js')
    const originalFetch = globalThis.fetch
    let called = false
    globalThis.fetch = async () => {
      called = true
      return new Response('{}', { status: 200 })
    }
    try {
      reportAiUsageToObservatory({
        recipeId: 1,
        usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
        responseJson: {},
        meta: { model: 'm', usage_kind: 'test' },
      })
      await new Promise((r) => setTimeout(r, 20))
      assert.equal(called, false)
    } finally {
      globalThis.fetch = originalFetch
    }
  })

  it('reportAiUsageToObservatory POSTs when URL and key are set', async () => {
    process.env.AI_OBSERVATORY_URL = 'http://obs.example'
    process.env.AI_OBSERVATORY_API_KEY = 'obs_key'
    process.env.NODE_ENV = 'test'

    const { reportAiUsageToObservatory } = await import('../../src/services/aiObservatoryService.js')
    const originalFetch = globalThis.fetch
    /** @type {{ url?: string, init?: RequestInit }} */
    const seen = {}
    globalThis.fetch = async (url, init) => {
      seen.url = String(url)
      seen.init = init
      return new Response(JSON.stringify({ received: true }), { status: 200 })
    }
    try {
      reportAiUsageToObservatory({
        recipeId: 7,
        usage: { prompt_tokens: 3, completion_tokens: 2, total_tokens: 5 },
        responseJson: { error: 'failed' },
        meta: { model: 'gpt-4o-mini', usage_kind: 'health_score' },
      })
      await new Promise((r) => setTimeout(r, 50))
      assert.equal(seen.url, 'http://obs.example/api/v1/events')
      assert.equal(seen.init?.method, 'POST')
      const headers = /** @type {Record<string, string>} */ (seen.init?.headers)
      assert.equal(headers.Authorization, 'Bearer obs_key')
      assert.equal(headers['Content-Type'], 'application/json')
      const body = JSON.parse(String(seen.init?.body))
      assert.equal(body.provider, 'openai')
      assert.equal(body.status, 'error')
      assert.equal(body.feature, 'health-score')
      assert.equal(body.usage.inputTokens, 3)
      assert.equal(body.usage.outputTokens, 2)
    } finally {
      globalThis.fetch = originalFetch
    }
  })

  it('postObservatoryEvent swallows fetch errors', async () => {
    process.env.AI_OBSERVATORY_URL = 'http://obs.example'
    process.env.AI_OBSERVATORY_API_KEY = 'key'
    const { postObservatoryEvent } = await import('../../src/services/aiObservatoryService.js')
    const originalFetch = globalThis.fetch
    globalThis.fetch = async () => {
      throw new Error('network down')
    }
    try {
      await postObservatoryEvent({ eventId: 'x' })
    } finally {
      globalThis.fetch = originalFetch
    }
  })
})
