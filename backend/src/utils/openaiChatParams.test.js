import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  modelSupportsCustomTemperature,
  clampOpenAiTemperature,
  buildOpenAiChatTemperature,
} from './openaiChatParams.js'

describe('modelSupportsCustomTemperature', () => {
  it('returns false only for gpt-5-nano variants', () => {
    for (const model of ['gpt-5-nano', 'gpt-5-nano-2025-08-07']) {
      assert.equal(modelSupportsCustomTemperature(model), false, model)
    }
  })

  it('returns true for other models including other gpt-5 variants', () => {
    for (const model of [
      'gpt-5',
      'gpt-5-mini',
      'gpt-5.4-nano',
      'gpt-5-chat-latest',
      'gpt-4o-mini',
      'gpt-4.1-mini',
      'o4-mini',
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

  it('includes temperature for gpt-5-mini', () => {
    assert.deepEqual(buildOpenAiChatTemperature('gpt-5-mini', 0.2), { temperature: 0.2 })
  })

  it('clamps temperature to max 0.3 by default', () => {
    assert.equal(clampOpenAiTemperature(0.9), 0.3)
    assert.equal(buildOpenAiChatTemperature('gpt-4.1-mini', 0.9).temperature, 0.3)
  })
})
