/**
 * One-shot backfill of local ai_token_usage rows into AI Usage Observatory.
 * Runs in-process against the app DB (HA add-on / container). Idempotent via UUID v5 eventId.
 */

import { createHash } from 'node:crypto'
import { buildEvent, createObservatoryClient } from '@nikolausstoll/ai-observatory-client'
import { getDb } from '../db/index.js'
import {
  buildObservatoryRequest,
  buildObservatoryResponsePayload,
  mapUsageKindToFeatureOperation,
  resolveObservatoryEnvironment,
  resolveObservatoryStatus,
} from './aiObservatoryService.js'

/** DNS namespace UUID (RFC 4122) for deterministic backfill eventIds. */
export const OBSERVATORY_BACKFILL_NAMESPACE = '6ba7b810-9dad-11d1-80b4-00c04fd430c8'

const DEFAULT_LIMIT = 50
const DEFAULT_BATCH_SIZE = 25
const DEFAULT_DELAY_MS = 0
const SAMPLE_SIZE = 3

/**
 * @param {string} namespaceUuid
 * @param {string} name
 * @returns {string}
 */
export function uuidV5(namespaceUuid, name) {
  const nsHex = String(namespaceUuid).replace(/-/g, '')
  if (!/^[0-9a-fA-F]{32}$/.test(nsHex)) {
    throw new Error('Invalid UUID namespace')
  }
  const nsBytes = Buffer.from(nsHex, 'hex')
  const hash = createHash('sha1').update(nsBytes).update(String(name), 'utf8').digest()
  hash[6] = (hash[6] & 0x0f) | 0x50
  hash[8] = (hash[8] & 0x3f) | 0x80
  const hex = hash.subarray(0, 16).toString('hex')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`
}

/**
 * Deterministic Observatory eventId for a local ai_token_usage row.
 * @param {number|string} localUsageId
 * @returns {string}
 */
export function observatoryBackfillEventId(localUsageId) {
  return uuidV5(
    OBSERVATORY_BACKFILL_NAMESPACE,
    `recipe-library:ai_token_usage:${localUsageId}`,
  )
}

/**
 * @returns {boolean}
 */
export function isObservatoryConfigured() {
  return createObservatoryClient().enabled
}

/**
 * SQLite `YYYY-MM-DD HH:MM:SS` (UTC) or ISO → ISO-8601 UTC.
 * @param {string|null|undefined} createdAt
 * @returns {string}
 */
export function createdAtToIsoUtc(createdAt) {
  if (createdAt == null || String(createdAt).trim() === '') {
    return new Date(0).toISOString()
  }
  const s = String(createdAt).trim()
  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}/.test(s)) {
    return new Date(`${s.replace(' ', 'T')}Z`).toISOString()
  }
  const d = new Date(s)
  if (Number.isNaN(d.getTime())) {
    return new Date(0).toISOString()
  }
  return d.toISOString()
}

/**
 * @param {unknown} value
 * @returns {unknown}
 */
function parseJsonField(value) {
  if (value == null) return null
  if (typeof value !== 'string') return value
  const trimmed = value.trim()
  if (!trimmed) return null
  try {
    return JSON.parse(trimmed)
  } catch {
    return value
  }
}

/**
 * Map one ai_token_usage row → Observatory event (no network).
 * Reuses feature/status/request/response helpers from aiObservatoryService.
 * Does not invent cached/reasoning tokens or durationMs.
 *
 * @param {{
 *   id: number,
 *   recipe_id?: number|null,
 *   prompt_tokens?: number|null,
 *   completion_tokens?: number|null,
 *   total_tokens?: number|null,
 *   request_json?: string|null,
 *   response_json?: string|null,
 *   model?: string|null,
 *   usage_kind?: string|null,
 *   created_at?: string|null,
 * }} row
 * @returns {import('@nikolausstoll/ai-observatory-client').ObservatoryEvent}
 */
export function buildBackfillEventFromRow(row) {
  const usageKindRaw =
    row.usage_kind != null && String(row.usage_kind).trim() !== ''
      ? String(row.usage_kind).trim()
      : 'unknown'
  const { feature, operation } = mapUsageKindToFeatureOperation(usageKindRaw)
  const responseJson = parseJsonField(row.response_json)
  const status = resolveObservatoryStatus(responseJson)
  const requestedModel =
    row.model != null && String(row.model).trim() !== ''
      ? String(row.model).trim()
      : 'unknown'

  /** @type {import('@nikolausstoll/ai-observatory-client').ObservatoryEventInput} */
  const partial = {
    eventId: observatoryBackfillEventId(row.id),
    timestamp: createdAtToIsoUtc(row.created_at),
    durationMs: 0,
    environment: resolveObservatoryEnvironment(),
    feature,
    operation,
    operationId: `backfill:${usageKindRaw}:${row.id}`,
    attemptNumber: 1,
    status,
    provider: 'openai',
    requestedModel,
    usage: {
      inputTokens: row.prompt_tokens ?? null,
      outputTokens: row.completion_tokens ?? null,
      totalTokens: row.total_tokens ?? null,
      rawUsage: {
        prompt_tokens: row.prompt_tokens ?? null,
        completion_tokens: row.completion_tokens ?? null,
        total_tokens: row.total_tokens ?? null,
      },
    },
    metadata: {
      recipeId: row.recipe_id ?? null,
      source: 'backfill',
      localUsageId: row.id,
    },
  }

  const request = buildObservatoryRequest(row.request_json)
  if (request) partial.request = request

  const response = buildObservatoryResponsePayload(row.response_json)
  if (response) partial.response = response

  if (status === 'error' && responseJson != null && typeof responseJson === 'object') {
    const errObj = /** @type {Record<string, unknown>} */ (responseJson)
    partial.error = {
      message: errObj.error != null ? String(errObj.error) : 'error',
    }
  }

  return buildEvent(partial)
}

/**
 * @param {object} [options]
 * @param {number} [options.limit]
 * @param {string|null} [options.since] ISO date / datetime lower bound on created_at
 * @returns {object[]}
 */
export function listAiTokenUsageForBackfill(options = {}) {
  const limit = Math.max(1, Math.min(Number(options.limit) || DEFAULT_LIMIT, 5000))
  const since = options.since != null && String(options.since).trim() !== ''
    ? String(options.since).trim()
    : null

  const db = getDb()
  if (since) {
    const sinceSqlite = since.includes('T')
      ? since.replace('T', ' ').replace(/Z$/, '').slice(0, 19)
      : since.slice(0, 19)
    return db
      .prepare(
        `
      SELECT id, recipe_id, prompt_tokens, completion_tokens, total_tokens,
             request_json, response_json, model, usage_kind, created_at
      FROM ai_token_usage
      WHERE created_at >= ?
      ORDER BY id ASC
      LIMIT ?
    `,
      )
      .all(sinceSqlite, limit)
  }

  return db
    .prepare(
      `
    SELECT id, recipe_id, prompt_tokens, completion_tokens, total_tokens,
           request_json, response_json, model, usage_kind, created_at
    FROM ai_token_usage
    ORDER BY id ASC
    LIMIT ?
  `,
    )
    .all(limit)
}

/**
 * @param {number} ms
 * @returns {Promise<void>}
 */
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * POST one event and classify Observatory response for backfill stats.
 * Uses shared client transport; injectible fetch for tests.
 *
 * @param {import('@nikolausstoll/ai-observatory-client').ObservatoryEvent} event
 * @param {{ fetch?: typeof fetch }} [options]
 * @returns {Promise<{ outcome: 'sent'|'duplicate'|'failed', httpStatus?: number, error?: string }>}
 */
export async function postBackfillEventWithResult(event, options = {}) {
  /** @type {{ httpStatus: number, body: any, networkError: string|null }} */
  let captured = { httpStatus: 0, body: null, networkError: null }
  const baseFetch = options.fetch ?? globalThis.fetch.bind(globalThis)

  const client = createObservatoryClient({
    warn: () => {},
    fetch: async (url, init) => {
      try {
        const res = await baseFetch(url, init)
        const text = await res.text().catch(() => '')
        let body = null
        try {
          body = text ? JSON.parse(text) : null
        } catch {
          body = { raw: text }
        }
        captured = { httpStatus: res.status, body, networkError: null }
        return new Response(text, {
          status: res.status,
          statusText: res.statusText,
          headers: res.headers,
        })
      } catch (err) {
        captured = {
          httpStatus: 0,
          body: null,
          networkError: err instanceof Error ? err.message : String(err),
        }
        throw err
      }
    },
  })

  if (!client.enabled) {
    return {
      outcome: 'failed',
      error: 'AI Observatory is not configured (AI_OBSERVATORY_URL / AI_OBSERVATORY_API_KEY)',
    }
  }

  await client.postEvent(event)

  if (captured.networkError) {
    return { outcome: 'failed', error: captured.networkError }
  }

  const { httpStatus, body } = captured
  if (httpStatus === 200 && body && body.duplicate === true) {
    return { outcome: 'duplicate', httpStatus }
  }
  if (httpStatus === 200) {
    return { outcome: 'sent', httpStatus }
  }
  const detail =
    body?.error != null
      ? String(body.error)
      : body?.details != null
        ? JSON.stringify(body.details).slice(0, 200)
        : body?.raw != null
          ? String(body.raw).slice(0, 200)
          : `HTTP ${httpStatus}`
  return { outcome: 'failed', httpStatus, error: detail }
}

/**
 * @param {object} [params]
 * @param {boolean} [params.dryRun]
 * @param {number} [params.limit]
 * @param {string|null} [params.since]
 * @param {number} [params.batchSize]
 * @param {number} [params.delayMs]
 * @param {typeof fetch} [params.fetch]
 */
export async function runObservatoryBackfill(params = {}) {
  if (!isObservatoryConfigured() && !params.dryRun) {
    const err = new Error(
      'AI Observatory is not configured. Set AI_OBSERVATORY_URL and AI_OBSERVATORY_API_KEY (or add-on options ai_observatory_url / ai_observatory_api_key).',
    )
    /** @type {Error & { statusCode?: number }} */
    const e = err
    e.statusCode = 503
    throw e
  }

  const dryRun = Boolean(params.dryRun)
  const limit = Math.max(1, Math.min(Number(params.limit) || DEFAULT_LIMIT, 5000))
  const batchSize = Math.max(1, Math.min(Number(params.batchSize) || DEFAULT_BATCH_SIZE, 500))
  const delayMs = Math.max(0, Math.min(Number(params.delayMs) || DEFAULT_DELAY_MS, 60_000))
  const since = params.since ?? null

  const rows = listAiTokenUsageForBackfill({ limit, since })
  const events = rows.map((row) => buildBackfillEventFromRow(row))

  /** @type {{ total: number, sent: number, duplicate: number, failed: number, skipped: number, dryRun: boolean, sample?: object[], errors?: { localUsageId: number, eventId: string, error: string }[] }} */
  const stats = {
    total: rows.length,
    sent: 0,
    duplicate: 0,
    failed: 0,
    skipped: 0,
    dryRun,
  }

  if (dryRun) {
    stats.skipped = rows.length
    stats.sample = events.slice(0, SAMPLE_SIZE).map((ev) => ({
      eventId: ev.eventId,
      timestamp: ev.timestamp,
      feature: ev.feature,
      operation: ev.operation,
      operationId: ev.operationId,
      status: ev.status,
      requestedModel: ev.requestedModel,
      usage: ev.usage,
      metadata: ev.metadata,
    }))
    return stats
  }

  /** @type {{ localUsageId: number, eventId: string, error: string }[]} */
  const errors = []

  for (let i = 0; i < events.length; i++) {
    const event = events[i]
    const row = rows[i]
    const result = await postBackfillEventWithResult(event, { fetch: params.fetch })
    if (result.outcome === 'sent') stats.sent += 1
    else if (result.outcome === 'duplicate') stats.duplicate += 1
    else {
      stats.failed += 1
      errors.push({
        localUsageId: row.id,
        eventId: event.eventId,
        error: result.error || 'unknown',
      })
    }

    if (delayMs > 0 && (i + 1) % batchSize === 0 && i + 1 < events.length) {
      await sleep(delayMs)
    }
  }

  if (errors.length) stats.errors = errors.slice(0, 50)
  return stats
}
