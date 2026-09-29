import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { normalizeOpenAiUsage } from '../../src/utils/openaiUsage.js'

describe('normalizeOpenAiUsage', () => {
  it('preserves cached and reasoning detail fields from OpenAI usage', () => {
    const fixture = {
      prompt_tokens: 2006,
      completion_tokens: 300,
      total_tokens: 2306,
      prompt_tokens_details: { cached_tokens: 1920 },
      completion_tokens_details: { reasoning_tokens: 50 },
    }

    const normalized = normalizeOpenAiUsage(fixture)
    assert.deepEqual(normalized, {
      prompt_tokens: 2006,
      completion_tokens: 300,
      total_tokens: 2306,
      prompt_tokens_details: { cached_tokens: 1920 },
      completion_tokens_details: { reasoning_tokens: 50 },
    })
  })

  it('returns null for missing usage', () => {
    assert.equal(normalizeOpenAiUsage(null), null)
    assert.equal(normalizeOpenAiUsage(undefined), null)
  })

  it('keeps extra provider fields for rawUsage', () => {
    const normalized = normalizeOpenAiUsage({
      prompt_tokens: 1,
      completion_tokens: 2,
      total_tokens: 3,
      extra_field: 'keep-me',
    })
    assert.equal(normalized.extra_field, 'keep-me')
  })
})
