import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  PRICING_USD_PER_1M,
  resolvePricingKey,
  computeRequestCostUsd,
  computeRequestCostCents,
} from '../../src/utils/extractUsagePricing.js'

describe('resolvePricingKey', () => {
  it('resolves exact model ids', () => {
    for (const key of Object.keys(PRICING_USD_PER_1M)) {
      assert.equal(resolvePricingKey(key), key)
    }
  })

  it('resolves dated API model strings', () => {
    assert.equal(resolvePricingKey('gpt-4o-mini-2024-07-18'), 'gpt-4o-mini')
    assert.equal(resolvePricingKey('gpt-4.1-mini-2025-04-14'), 'gpt-4.1-mini')
    assert.equal(resolvePricingKey('gpt-5.4-mini-2026-01-01'), 'gpt-5.4-mini')
  })

  it('prefers more specific gpt-5.x variants over gpt-5', () => {
    assert.equal(resolvePricingKey('gpt-5.6-luna-2026-08-01'), 'gpt-5.6-luna')
    assert.equal(resolvePricingKey('gpt-5.4'), 'gpt-5.4')
    assert.equal(resolvePricingKey('gpt-5.4-mini'), 'gpt-5.4-mini')
    assert.equal(resolvePricingKey('gpt-5.1'), 'gpt-5.1')
    assert.equal(resolvePricingKey('gpt-5'), 'gpt-5')
  })

  it('returns null for unknown models', () => {
    assert.equal(resolvePricingKey('gpt-3.5-turbo'), null)
    assert.equal(resolvePricingKey(null), null)
  })
})

describe('computeRequestCostUsd', () => {
  it('computes cost from input and output rates per 1M tokens', () => {
    // gpt-4o-mini: $0.15 in / $0.60 out per 1M
    const usd = computeRequestCostUsd(1_000_000, 1_000_000, 'gpt-4o-mini')
    assert.equal(usd, 0.15 + 0.6)
  })

  it('returns zero cost when token counts are zero', () => {
    assert.equal(computeRequestCostUsd(0, 0, 'gpt-4o-mini'), 0)
  })

  it('computes gpt-5.2 pricing', () => {
    const usd = computeRequestCostUsd(1_000_000, 1_000_000, 'gpt-5.2')
    assert.equal(usd, 1.75 + 14.0)
  })

  it('computes gpt-5.6-luna pricing', () => {
    const usd = computeRequestCostUsd(1_000_000, 1_000_000, 'gpt-5.6-luna')
    assert.equal(usd, 0.2 + 1.2)
  })

  it('returns null for unknown model', () => {
    assert.equal(computeRequestCostUsd(1000, 1000, 'unknown-model'), null)
  })
})

describe('computeRequestCostCents', () => {
  it('converts USD to cents', () => {
    const cents = computeRequestCostCents(0, 1_000_000, 'gpt-4o-mini')
    assert.equal(cents, 60)
  })

  it('rounds fractional cents', () => {
    const cents = computeRequestCostCents(1, 0, 'gpt-4o-mini')
    assert.equal(cents, 0.000015)
  })
})
