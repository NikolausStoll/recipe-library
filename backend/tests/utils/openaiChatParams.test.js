import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  modelSupportsCustomTemperature,
  clampOpenAiTemperature,
  buildOpenAiChatTemperature,
} from '../../src/utils/openaiChatParams.js'

describe('modelSupportsCustomTemperature', () => {
  it('returns false for all gpt-5 family variants', () => {
    for (const model of [
      'gpt-5',
      'gpt-5-2025-08-07',
      'gpt-5-mini',
      'gpt-5-nano-2025-08-07',
      'gpt-5.4-mini',
      'gpt-5.6-luna',
      'gpt-5-chat-latest',
    ]) {
      assert.equal(modelSupportsCustomTemperature(model), false, model)
    }
  })

  it('returns false for o-series reasoning model variants', () => {
    for (const model of ['o1', 'o1-mini', 'o3-2025-04-16', 'o4-mini']) {
      assert.equal(modelSupportsCustomTemperature(model), false, model)
    }
  })

  it('returns true for non-reasoning models', () => {
    for (const model of [
      'gpt-4o-mini',
      'gpt-4.1-mini',
      'gpt-5x-compatible',
    ]) {
      assert.equal(modelSupportsCustomTemperature(model), true, model)
    }
  })
})

describe('buildOpenAiChatTemperature', () => {
  it('omits temperature for gpt-5-nano', () => {
    assert.deepEqual(buildOpenAiChatTemperature('gpt-5-nano', 0.1), {})
  })

  it('includes clamped temperature for gpt-4o-mini', () => {
    assert.deepEqual(buildOpenAiChatTemperature('gpt-4o-mini', 0.2), { temperature: 0.2 })
  })

  it('omits temperature for gpt-5-mini', () => {
    assert.deepEqual(buildOpenAiChatTemperature('gpt-5-mini', 0.2), {})
  })

  it('omits temperature for GPT-5.6 variants', () => {
    for (const model of ['gpt-5.6-luna', 'gpt-5.6-terra', 'gpt-5.6-sol', 'gpt-5.6']) {
      assert.deepEqual(buildOpenAiChatTemperature(model, 0), {})
    }
  })

  it('includes zero temperature for supported models', () => {
    assert.deepEqual(buildOpenAiChatTemperature('gpt-4o-mini', 0), { temperature: 0 })
  })

  it('clamps temperature to max 0.3 by default', () => {
    assert.equal(clampOpenAiTemperature(0.9), 0.3)
    assert.equal(buildOpenAiChatTemperature('gpt-4.1-mini', 0.9).temperature, 0.3)
  })
})
