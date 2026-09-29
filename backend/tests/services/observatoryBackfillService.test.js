import { describe, it, afterEach, before, after } from 'node:test'
import assert from 'node:assert/strict'

process.env.DB_PATH = ':memory:'

const { initDb, getDb } = await import('../../src/db/index.js')
const {
  OBSERVATORY_BACKFILL_NAMESPACE,
  OBSERVATORY_BACKFILL_CREATED_BEFORE,
  observatoryBackfillEventId,
  uuidV5,
  createdAtToIsoUtc,
  buildBackfillEventFromRow,
  listAiTokenUsageForBackfill,
  runObservatoryBackfill,
} = await import('../../src/services/observatoryBackfillService.js')

before(() => {
  initDb()
})

after(() => {
  delete process.env.DB_PATH
})

describe('observatoryBackfillService', () => {
  afterEach(() => {
    delete process.env.AI_OBSERVATORY_URL
    delete process.env.AI_OBSERVATORY_API_KEY
    delete process.env.NODE_ENV
    getDb().prepare('DELETE FROM ai_token_usage').run()
  })

  it('observatoryBackfillEventId is stable UUID v5 from namespace + name', () => {
    const a = observatoryBackfillEventId(42)
    const b = observatoryBackfillEventId(42)
    const c = observatoryBackfillEventId(43)
    assert.equal(a, b)
    assert.notEqual(a, c)
    assert.match(a, /^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i)
    assert.equal(
      a,
      uuidV5(OBSERVATORY_BACKFILL_NAMESPACE, 'recipe-library:ai_token_usage:42'),
    )
  })

  it('createdAtToIsoUtc converts SQLite UTC datetime', () => {
    assert.equal(createdAtToIsoUtc('2026-03-15 14:30:00'), '2026-03-15T14:30:00.000Z')
  })

  it('buildBackfillEventFromRow maps columns without inventing cached/reasoning/duration', () => {
    process.env.NODE_ENV = 'test'
    const event = buildBackfillEventFromRow({
      id: 7,
      recipe_id: 99,
      prompt_tokens: 100,
      completion_tokens: 20,
      total_tokens: 120,
      request_json: '{"title":"Soup"}',
      response_json: '{"tags":["vegan"]}',
      model: 'gpt-4o-mini',
      usage_kind: 'recipe_tag',
      created_at: '2026-01-10 08:00:00',
    })

    assert.equal(event.eventId, observatoryBackfillEventId(7))
    assert.equal(event.timestamp, '2026-01-10T08:00:00.000Z')
    assert.equal(event.durationMs, 0)
    assert.equal(event.environment, 'test')
    assert.equal(event.feature, 'recipe-enrichment')
    assert.equal(event.operation, 'tag-generation')
    assert.equal(event.promptId, 'recipe-tag-generation')
    assert.equal(event.operationId, 'backfill:recipe_tag:7')
    assert.equal(event.promptVersion, undefined)
    assert.equal(typeof event.applicationVersion, 'string')
    assert.ok(event.applicationVersion.length > 0)
    assert.equal(event.attemptNumber, 1)
    assert.equal(event.status, 'success')
    assert.equal(event.provider, 'openai')
    assert.equal(event.requestedModel, 'gpt-4o-mini')
    assert.deepEqual(event.usage, {
      inputTokens: 100,
      outputTokens: 20,
      totalTokens: 120,
      rawUsage: {
        prompt_tokens: 100,
        completion_tokens: 20,
        total_tokens: 120,
      },
    })
    assert.equal(event.usage.cachedInputTokens, undefined)
    assert.equal(event.usage.reasoningTokens, undefined)
    assert.deepEqual(event.request, { raw: { title: 'Soup' } })
    assert.deepEqual(event.response, { output: { tags: ['vegan'] } })
    assert.deepEqual(event.metadata, {
      recipeId: 99,
      source: 'backfill',
      localUsageId: 7,
    })
  })

  it('buildBackfillEventFromRow treats response.error as error status', () => {
    process.env.NODE_ENV = 'test'
    const event = buildBackfillEventFromRow({
      id: 1,
      recipe_id: null,
      prompt_tokens: 1,
      completion_tokens: 1,
      total_tokens: 2,
      response_json: JSON.stringify({ error: 'timeout' }),
      model: null,
      usage_kind: null,
      created_at: '2026-02-01 00:00:00',
    })
    assert.equal(event.status, 'error')
    assert.equal(event.feature, 'recipe-unknown')
    assert.equal(event.operation, 'unknown')
    assert.equal(event.requestedModel, 'unknown')
    assert.equal(event.operationId, 'backfill:unknown:1')
    assert.deepEqual(event.error, { message: 'timeout' })
  })

  it('listAiTokenUsageForBackfill only includes rows before 2026-09-28', () => {
    const db = getDb()
    const insert = db.prepare(
      `
      INSERT INTO ai_token_usage (
        recipe_id, prompt_tokens, completion_tokens, total_tokens,
        response_json, request_json, model, usage_kind, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    )
    insert.run(null, 1, 1, 2, '{}', null, 'm', 'recipe_tag', '2026-09-27 23:59:59')
    insert.run(null, 1, 1, 2, '{}', null, 'm', 'recipe_tag', '2026-09-28 00:00:00')
    insert.run(null, 1, 1, 2, '{}', null, 'm', 'recipe_tag', '2026-09-29 12:00:00')

    const rows = listAiTokenUsageForBackfill({ limit: 100 })
    assert.equal(OBSERVATORY_BACKFILL_CREATED_BEFORE, '2026-09-28 00:00:00')
    assert.equal(rows.length, 1)
    assert.equal(rows[0].created_at, '2026-09-27 23:59:59')
  })

  it('dryRun counts rows and returns sample without network', async () => {
    process.env.NODE_ENV = 'test'
    const db = getDb()
    const insert = db
      .prepare(
        `
      INSERT INTO ai_token_usage (
        recipe_id, prompt_tokens, completion_tokens, total_tokens,
        response_json, request_json, model, usage_kind, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
      )
      .run(null, 10, 5, 15, '{"ok":true}', null, 'gpt-4o-mini', 'health_score', '2026-04-01 12:00:00')
    const localId = Number(insert.lastInsertRowid)

    let fetchCalled = false
    const stats = await runObservatoryBackfill({
      dryRun: true,
      limit: 10,
      fetch: async () => {
        fetchCalled = true
        return new Response('{}', { status: 200 })
      },
    })

    assert.equal(fetchCalled, false)
    assert.equal(stats.dryRun, true)
    assert.equal(stats.total, 1)
    assert.equal(stats.sent, 0)
    assert.equal(stats.duplicate, 0)
    assert.equal(stats.failed, 0)
    assert.equal(stats.skipped, 1)
    assert.ok(Array.isArray(stats.sample))
    assert.equal(stats.sample.length, 1)
    assert.equal(stats.sample[0].eventId, observatoryBackfillEventId(localId))
    assert.equal(stats.sample[0].operationId, `backfill:health_score:${localId}`)
  })

  it('run without Observatory config throws 503 (non-dryRun)', async () => {
    delete process.env.AI_OBSERVATORY_URL
    delete process.env.AI_OBSERVATORY_API_KEY
    await assert.rejects(
      () => runObservatoryBackfill({ dryRun: false, limit: 1 }),
      (err) => err.statusCode === 503 && /not configured/i.test(err.message),
    )
  })

  it('live post classifies sent vs duplicate', async () => {
    process.env.AI_OBSERVATORY_URL = 'http://obs.example'
    process.env.AI_OBSERVATORY_API_KEY = 'key'
    process.env.NODE_ENV = 'test'

    const db = getDb()
    const insert = db
      .prepare(
        `
      INSERT INTO ai_token_usage (
        recipe_id, prompt_tokens, completion_tokens, total_tokens,
        response_json, request_json, model, usage_kind, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
      )
      .run(null, 3, 2, 5, '{}', null, 'm', 'recipe_tag', '2026-05-01 10:00:00')
    const localId = Number(insert.lastInsertRowid)
    const expectedEventId = observatoryBackfillEventId(localId)

    const stats = await runObservatoryBackfill({
      dryRun: false,
      limit: 10,
      fetch: async (_url, init) => {
        const body = JSON.parse(String(init.body))
        assert.equal(body.eventId, expectedEventId)
        assert.equal(body.metadata.source, 'backfill')
        assert.equal(body.metadata.localUsageId, localId)
        return new Response(
          JSON.stringify({ eventId: body.eventId, received: true, duplicate: false }),
          { status: 200 },
        )
      },
    })

    assert.equal(stats.total, 1)
    assert.equal(stats.sent, 1)
    assert.equal(stats.duplicate, 0)
    assert.equal(stats.failed, 0)

    const stats2 = await runObservatoryBackfill({
      dryRun: false,
      limit: 10,
      fetch: async (_url, init) => {
        const body = JSON.parse(String(init.body))
        assert.equal(body.eventId, expectedEventId)
        return new Response(
          JSON.stringify({ eventId: body.eventId, received: false, duplicate: true }),
          { status: 200 },
        )
      },
    })
    assert.equal(stats2.sent, 0)
    assert.equal(stats2.duplicate, 1)
  })
})
