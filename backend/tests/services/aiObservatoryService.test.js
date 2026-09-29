import { describe, it, afterEach } from 'node:test'
import assert from 'node:assert/strict'

describe('aiObservatoryService', () => {
  afterEach(() => {
    delete process.env.AI_OBSERVATORY_URL
    delete process.env.AI_OBSERVATORY_API_KEY
    delete process.env.NODE_ENV
  })

  it('mapUsageKindToFeatureOperation separates feature and operation for known kinds', async () => {
    const {
      mapUsageKindToFeatureOperation,
    } = await import('../../src/services/aiObservatoryService.js')

    assert.deepEqual(mapUsageKindToFeatureOperation('recipe_image_extract'), {
      feature: 'recipe-import',
      operation: 'image-extraction',
    })
    assert.deepEqual(mapUsageKindToFeatureOperation('url_recipe_normalize'), {
      feature: 'recipe-import',
      operation: 'url-extraction',
    })
    assert.deepEqual(mapUsageKindToFeatureOperation('text_recipe_extract'), {
      feature: 'recipe-import',
      operation: 'text-extraction',
    })
    assert.deepEqual(mapUsageKindToFeatureOperation('recipe_tag'), {
      feature: 'recipe-enrichment',
      operation: 'tag-generation',
    })
    assert.deepEqual(mapUsageKindToFeatureOperation('health_score'), {
      feature: 'recipe-enrichment',
      operation: 'health-score',
    })
    assert.deepEqual(mapUsageKindToFeatureOperation('recipe_time_estimate'), {
      feature: 'recipe-enrichment',
      operation: 'time-estimate',
    })
    assert.deepEqual(mapUsageKindToFeatureOperation('nutrition_estimate'), {
      feature: 'recipe-enrichment',
      operation: 'nutrition',
    })
    assert.deepEqual(mapUsageKindToFeatureOperation('cup_conversion'), {
      feature: 'recipe-normalization',
      operation: 'cup-conversion',
    })
    assert.deepEqual(mapUsageKindToFeatureOperation(null), {
      feature: 'recipe-unknown',
      operation: 'unknown',
    })
    assert.deepEqual(mapUsageKindToFeatureOperation('some_future_kind'), {
      feature: 'recipe-unknown',
      operation: 'some-future-kind',
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
    assert.equal(event.feature, 'recipe-enrichment')
    assert.equal(event.operation, 'tag-generation')
    assert.match(event.operationId, /^recipe-enrichment:42:tag-generation:[0-9a-f-]{36}$/i)
    assert.equal(event.status, 'success')
    assert.equal(event.environment, 'test')
    assert.equal(event.requestedModel, 'gpt-4o-mini')
    assert.equal(event.attemptNumber, 1)
    assert.equal(event.durationMs, 0)
    assert.deepEqual(event.usage, {
      inputTokens: 10,
      outputTokens: 5,
      totalTokens: 15,
      cachedInputTokens: null,
      reasoningTokens: null,
      rawUsage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
    })
    assert.deepEqual(event.response, { output: { tags: ['vegan'] } })
    assert.equal(event.request, undefined)
    assert.deepEqual(event.metadata, { recipeId: 42 })
  })

  it('buildObservatoryEvent maps cached/reasoning tokens, request, response, durationMs', async () => {
    process.env.NODE_ENV = 'test'
    const { buildObservatoryEvent } = await import('../../src/services/aiObservatoryService.js')
    const openaiUsage = {
      prompt_tokens: 2006,
      completion_tokens: 300,
      total_tokens: 2306,
      prompt_tokens_details: { cached_tokens: 1920 },
      completion_tokens_details: { reasoning_tokens: 50 },
    }
    const event = buildObservatoryEvent({
      recipeId: 9,
      usage: openaiUsage,
      responseJson: { tags: ['vegan'], warnings: [] },
      meta: {
        model: 'gpt-4o-mini',
        usage_kind: 'recipe_tag',
        request_json: '{"title":"Soup"}',
        durationMs: 1843,
      },
    })

    assert.deepEqual(event.usage, {
      inputTokens: 2006,
      outputTokens: 300,
      totalTokens: 2306,
      cachedInputTokens: 1920,
      reasoningTokens: 50,
      rawUsage: openaiUsage,
    })
    assert.deepEqual(event.request, { raw: { title: 'Soup' } })
    assert.deepEqual(event.response, { output: { tags: ['vegan'], warnings: [] } })
    assert.equal(event.durationMs, 1843)
    assert.deepEqual(event.metadata, { recipeId: 9 })
  })

  it('buildObservatoryEvent keeps non-JSON request_json as raw string and sets error on failure', async () => {
    process.env.NODE_ENV = 'test'
    const { buildObservatoryEvent } = await import('../../src/services/aiObservatoryService.js')
    const event = buildObservatoryEvent({
      recipeId: 1,
      usage: null,
      responseJson: { error: 'timeout' },
      meta: {
        model: 'gpt-4o-mini',
        usage_kind: 'health_score',
        request_json: 'not-json {',
      },
    })

    assert.equal(event.status, 'error')
    assert.deepEqual(event.error, { message: 'timeout' })
    assert.deepEqual(event.request, { raw: 'not-json {' })
    assert.deepEqual(event.response, { output: { error: 'timeout' } })
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
        meta: {
          model: 'gpt-4o-mini',
          usage_kind: 'health_score',
          request_json: '{"a":1}',
          durationMs: 1843,
        },
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
      assert.equal(body.feature, 'recipe-enrichment')
      assert.equal(body.operation, 'health-score')
      assert.equal(body.durationMs, 1843)
      assert.equal(body.usage.inputTokens, 3)
      assert.equal(body.usage.outputTokens, 2)
      assert.deepEqual(body.request, { raw: { a: 1 } })
      assert.deepEqual(body.response, { output: { error: 'failed' } })
      assert.deepEqual(body.error, { message: 'failed' })
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
