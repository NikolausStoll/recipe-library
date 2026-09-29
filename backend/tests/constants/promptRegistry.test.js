import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { PROMPT_REGISTRY, resolvePromptMeta } from '../../src/constants/promptRegistry.js'

describe('promptRegistry', () => {
  it('covers every known usage_kind with promptId and integer promptVersion', () => {
    const expectedKinds = [
      'recipe_image_extract',
      'url_recipe_normalize',
      'text_recipe_extract',
      'recipe_tag',
      'health_score',
      'recipe_time_estimate',
      'nutrition_estimate',
      'cup_conversion',
    ]
    assert.deepEqual(Object.keys(PROMPT_REGISTRY).sort(), [...expectedKinds].sort())
    for (const kind of expectedKinds) {
      const meta = resolvePromptMeta(kind)
      assert.ok(meta, kind)
      assert.equal(typeof meta.promptId, 'string')
      assert.ok(meta.promptId.length > 0)
      assert.equal(typeof meta.promptVersion, 'number')
      assert.ok(Number.isInteger(meta.promptVersion) && meta.promptVersion >= 1)
    }
  })

  it('resolvePromptMeta returns null for unknown/empty kinds', () => {
    assert.equal(resolvePromptMeta(null), null)
    assert.equal(resolvePromptMeta(''), null)
    assert.equal(resolvePromptMeta('not_a_real_kind'), null)
  })
})
