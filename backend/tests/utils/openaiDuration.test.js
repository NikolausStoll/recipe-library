import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { elapsedMsSince, openaiCallStart } from '../../src/utils/openaiDuration.js'

describe('openaiDuration', () => {
  it('elapsedMsSince returns non-negative whole milliseconds', async () => {
    const started = openaiCallStart()
    await new Promise((r) => setTimeout(r, 25))
    const ms = elapsedMsSince(started)
    assert.equal(Number.isInteger(ms), true)
    assert.ok(ms >= 20, `expected >= 20ms, got ${ms}`)
  })

  it('elapsedMsSince clamps invalid/negative to 0', () => {
    assert.equal(elapsedMsSince(performance.now() + 10_000), 0)
  })
})
