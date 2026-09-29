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
    const {
      buildObservatoryEvent,
      resolveApplicationVersion,
    } = await import('../../src/services/aiObservatoryService.js')
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
    assert.equal(event.applicationVersion, resolveApplicationVersion())
    assert.equal(event.promptId, 'recipe-tag-generation')
    assert.equal(event.promptVersion, '1')
    assert.equal(event.subjectId, '42')
    assert.equal(event.subjectLabel, undefined)
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

  it('buildObservatoryEvent includes subjectId and subjectLabel when provided', async () => {
    process.env.NODE_ENV = 'test'
    const { buildObservatoryEvent } = await import('../../src/services/aiObservatoryService.js')
    const event = buildObservatoryEvent({
      recipeId: 123,
      usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
      responseJson: { ok: true },
      meta: {
        model: 'gpt-4o-mini',
        usage_kind: 'recipe_tag',
        subjectLabel: 'Kartoffelauflauf',
      },
    })

    assert.equal(event.subjectId, '123')
    assert.equal(event.subjectLabel, 'Kartoffelauflauf')
  })

  it('buildObservatoryEvent keeps subjectId when subjectLabel is absent', async () => {
    process.env.NODE_ENV = 'test'
    const { buildObservatoryEvent } = await import('../../src/services/aiObservatoryService.js')
    const event = buildObservatoryEvent({
      recipeId: 7,
      usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
      responseJson: { status: 'success' },
      meta: { model: 'gpt-4.1-mini', usage_kind: 'recipe_image_extract' },
    })

    assert.equal(event.subjectId, '7')
    assert.equal(event.subjectLabel, undefined)
  })

  it('buildObservatoryEvent omits subject when recipeId and subjectId are absent', async () => {
    process.env.NODE_ENV = 'test'
    const { buildObservatoryEvent } = await import('../../src/services/aiObservatoryService.js')
    const event = buildObservatoryEvent({
      recipeId: null,
      usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
      responseJson: { error: 'boom' },
      meta: { model: 'gpt-4o-mini', usage_kind: 'health_score' },
    })

    assert.equal(event.subjectId, undefined)
    assert.equal(event.subjectLabel, undefined)
    assert.equal(event.metadata, undefined)
  })

  it('subjectId stays stable when subjectLabel changes for the same recipe', async () => {
    process.env.NODE_ENV = 'test'
    const { buildObservatoryEvent } = await import('../../src/services/aiObservatoryService.js')
    const first = buildObservatoryEvent({
      recipeId: 123,
      usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
      responseJson: {},
      meta: { model: 'm', usage_kind: 'recipe_tag', subjectLabel: 'Kartoffelauflauf' },
    })
    const second = buildObservatoryEvent({
      recipeId: 123,
      usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
      responseJson: {},
      meta: {
        model: 'm',
        usage_kind: 'recipe_tag',
        subjectLabel: 'Kartoffelauflauf mit Paprika',
      },
    })

    assert.equal(first.subjectId, '123')
    assert.equal(second.subjectId, '123')
    assert.equal(first.subjectId, second.subjectId)
    assert.notEqual(first.subjectLabel, second.subjectLabel)
  })

  it('subjectFieldsFromRecipe maps recipe id and title', async () => {
    const {
      subjectFieldsFromRecipe,
      normalizeSubjectLabel,
    } = await import('../../src/services/aiObservatoryService.js')

    assert.deepEqual(subjectFieldsFromRecipe({ id: 9, title: 'Soup' }), {
      subjectId: '9',
      subjectLabel: 'Soup',
    })
    assert.deepEqual(subjectFieldsFromRecipe({ id: 9, title: '  ' }), {
      subjectId: '9',
    })
    assert.deepEqual(subjectFieldsFromRecipe(null), {})
    assert.equal(normalizeSubjectLabel('  Pasta  '), 'Pasta')
    assert.equal(normalizeSubjectLabel(''), undefined)
  })

  it('explicit meta.subjectId overrides recipeId-derived subject', async () => {
    process.env.NODE_ENV = 'test'
    const { buildObservatoryEvent } = await import('../../src/services/aiObservatoryService.js')
    const event = buildObservatoryEvent({
      recipeId: 1,
      usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
      responseJson: {},
      meta: {
        model: 'm',
        usage_kind: 'recipe_tag',
        subjectId: 'custom-subject',
        subjectLabel: 'Custom',
      },
    })
    assert.equal(event.subjectId, 'custom-subject')
    assert.equal(event.subjectLabel, 'Custom')
    assert.deepEqual(event.metadata, { recipeId: 1 })
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

  it('buildObservatoryEvent prefers observatory_request over request_json', async () => {
    process.env.NODE_ENV = 'test'
    const { buildObservatoryEvent } = await import('../../src/services/aiObservatoryService.js')
    const event = buildObservatoryEvent({
      recipeId: 3,
      usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
      responseJson: { ok: true },
      meta: {
        model: 'gpt-4.1-mini',
        usage_kind: 'recipe_image_extract',
        request_json: '{"should":"not-win"}',
        observatory_request: {
          input: { system: 'SYS', userText: 'USER' },
          metadata: { imageCount: 2 },
        },
      },
    })

    assert.deepEqual(event.request, {
      input: { system: 'SYS', userText: 'USER' },
      metadata: { imageCount: 2 },
    })
    assert.equal(event.promptId, 'recipe-image-extraction')
  })

  it('reportAiUsageToObservatory POSTs event then input artifacts', async () => {
    process.env.AI_OBSERVATORY_URL = 'http://obs.example'
    process.env.AI_OBSERVATORY_API_KEY = 'obs_key'
    process.env.NODE_ENV = 'test'

    const { reportAiUsageToObservatory } = await import('../../src/services/aiObservatoryService.js')
    const originalFetch = globalThis.fetch
    /** @type {Array<{ url: string, init?: RequestInit }>} */
    const calls = []
    globalThis.fetch = async (url, init) => {
      calls.push({ url: String(url), init })
      if (String(url).endsWith('/api/v1/events')) {
        return new Response(JSON.stringify({ received: true, duplicate: false }), { status: 200 })
      }
      return new Response(JSON.stringify({ artifactId: 'a1' }), { status: 200 })
    }
    try {
      reportAiUsageToObservatory({
        recipeId: 9,
        usage: { prompt_tokens: 2, completion_tokens: 1, total_tokens: 3 },
        responseJson: { status: 'success' },
        meta: {
          model: 'gpt-4.1-mini',
          usage_kind: 'recipe_image_extract',
          subjectLabel: 'Pasta Bake',
          observatory_request: {
            input: { system: 'S', userText: 'U' },
            metadata: { imageCount: 1 },
          },
        },
        artifacts: [
          {
            data: Buffer.from('fake-png'),
            role: 'input',
            label: 'recipe-page-1',
            filename: 'recipe-page-1.png',
            mimeType: 'image/png',
          },
        ],
      })
      await new Promise((r) => setTimeout(r, 80))
      assert.equal(calls.length, 2)
      assert.equal(calls[0].url, 'http://obs.example/api/v1/events')
      const eventBody = JSON.parse(String(calls[0].init?.body))
      assert.deepEqual(eventBody.request.input, { system: 'S', userText: 'U' })
      assert.equal(eventBody.subjectId, '9')
      assert.equal(eventBody.subjectLabel, 'Pasta Bake')
      assert.match(calls[1].url, /\/api\/v1\/events\/[0-9a-f-]+\/artifacts$/i)
      assert.equal(calls[1].init?.method, 'POST')
      assert.ok(calls[1].init?.body instanceof FormData)
      const headers = /** @type {Record<string, string>} */ (calls[1].init?.headers)
      assert.equal(headers.Authorization, 'Bearer obs_key')
      assert.equal(headers['Content-Type'], undefined)
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
