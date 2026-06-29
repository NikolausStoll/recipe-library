/**
 * Post-extraction import pipeline: cup conversion → persist → tagging.
 * Normalization (URL) or vision extract (image) runs before this module.
 */

import * as recipeService from './recipeService.js'
import { logAiTokenUsage } from './extractRecipeService.js'
import { convertCupIngredients } from './cupConversionService.js'
import { convertImperialUnitsInEnvelope } from './imperialUnitConversionService.js'
import { generateRecipeTags } from './recipeTagGenerationService.js'
import { replaceRecipeTags } from './recipeTagPersistence.js'

/**
 * Cup conversion only (no DB). Used after normalization for extract-from-url preview.
 * @param {object} structured – extraction envelope
 * @returns {Promise<{ envelope: object, warnings: string[], cupConversion: object, cupAttempt: object | null }>}
 */
export async function applyPostNormalizationStages(structured) {
  const imperialResult = convertImperialUnitsInEnvelope(structured)
  const cupResult = await convertCupIngredients(imperialResult.envelope)
  const pipelineWarnings = [...(cupResult.warnings ?? [])]
  const envelope = {
    ...cupResult.envelope,
    warnings: [...(cupResult.envelope?.warnings ?? []), ...pipelineWarnings],
  }
  return {
    envelope,
    warnings: pipelineWarnings,
    cupConversion: cupResult.meta,
    cupAttempt: cupResult.attempt,
    imperialConversion: { convertedCount: imperialResult.convertedCount },
  }
}

/**
 * @param {number} recipeId
 * @returns {Promise<{ tags: string[], warnings: string[] }>}
 */
export async function awaitRecipeTagging(recipeId) {
  const warnings = []
  let tags = []

  try {
    const recipe = recipeService.getRecipeById(recipeId)
    if (!recipe) {
      warnings.push('Tag generation failed; recipe not found.')
      return { tags, warnings }
    }

    const result = await generateRecipeTags(recipe)
    replaceRecipeTags(recipeId, result.tags)
    tags = result.tags

    if (result.tokenUsage || result.tags) {
      logAiTokenUsage(recipeId, result.tokenUsage, { tags: result.tags, warnings: result.warnings }, {
        model: result.model,
        usage_kind: 'recipe_tag',
        request_json: result.requestPayload != null ? JSON.stringify(result.requestPayload) : null,
      })
    }

    if (result.warnings?.length) {
      const tagFailed = result.warnings.some(
        (w) =>
          w.includes('failed') ||
          w.includes('not set') ||
          w.includes('No content') ||
          w.includes('Invalid JSON'),
      )
      if (tagFailed) {
        warnings.push('Tag generation failed; tags were not updated.')
      } else {
        warnings.push(...result.warnings)
      }
    }
  } catch (e) {
    console.error('awaitRecipeTagging failed:', e)
    warnings.push('Tag generation failed; tags were not updated.')
  }

  return { tags, warnings }
}

/**
 * Cup conversion → persist structured recipe → await tagging.
 * @param {number} recipeId
 * @param {object} structured – extraction envelope (post-normalization or vision)
 * @param {{ updateTitle?: boolean }} [options]
 * @returns {Promise<{ recipe: object, warnings: string[], tags: string[], cupConversion: object }>}
 */
export async function finalizeImportedRecipe(recipeId, structured, options = {}) {
  const pipelineWarnings = []

  const imperialResult = convertImperialUnitsInEnvelope(structured)
  const cupResult = await convertCupIngredients(imperialResult.envelope)
  pipelineWarnings.push(...(cupResult.warnings ?? []))

  if (cupResult.attempt) {
    logAiTokenUsage(recipeId, cupResult.attempt.usage, cupResult.attempt.response, {
      model: cupResult.attempt.model,
      usage_kind: 'cup_conversion',
      request_json: cupResult.attempt.request_json,
    })
  }

  const mergedEnvelope = {
    ...cupResult.envelope,
    warnings: [...(cupResult.envelope?.warnings ?? []), ...pipelineWarnings],
  }

  recipeService.setRecipeParsedRecipe(recipeId, mergedEnvelope, options)

  const tagResult = await awaitRecipeTagging(recipeId)
  pipelineWarnings.push(...(tagResult.warnings ?? []))

  const recipe = recipeService.getRecipeById(recipeId)

  return {
    recipe,
    warnings: pipelineWarnings,
    tags: tagResult.tags,
    cupConversion: cupResult.meta,
  }
}
