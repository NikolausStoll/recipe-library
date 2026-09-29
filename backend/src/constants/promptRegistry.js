/**
 * Observatory prompt identity (`promptId` + `promptVersion`) per local `usage_kind`.
 *
 * `promptVersion` is a **monotonic integer**, not SemVer. Observatory only needs to know
 * which exact prompt text produced an event — there is no compatibility contract between
 * revisions. Start at 1 for the currently shipped text; **increment by 1 whenever that
 * prompt’s wording (or a shared block it embeds) changes**.
 *
 * When editing a prompt, update the matching entry here in the same change.
 * Shared blocks that force bumps on multiple kinds:
 * - `ingredientParsingPrompt.js` → recipe_image_extract, url_recipe_normalize, text_recipe_extract
 * - `ingredientCategories.js` (`formatCategoryListForPrompt`) → same three kinds
 *
 * See AGENTS.md → “Prompt versioning (Observatory)”.
 */

/** @typedef {{ promptId: string, promptVersion: number }} PromptMeta */

/** @type {Readonly<Record<string, PromptMeta>>} */
export const PROMPT_REGISTRY = Object.freeze({
  recipe_image_extract: {
    promptId: 'recipe-image-extraction',
    promptVersion: 1,
  },
  url_recipe_normalize: {
    promptId: 'url-recipe-normalization',
    promptVersion: 1,
  },
  text_recipe_extract: {
    promptId: 'text-recipe-extraction',
    promptVersion: 1,
  },
  recipe_tag: {
    promptId: 'recipe-tag-generation',
    promptVersion: 1,
  },
  health_score: {
    promptId: 'recipe-health-score',
    promptVersion: 1,
  },
  recipe_time_estimate: {
    promptId: 'recipe-time-estimate',
    promptVersion: 1,
  },
  nutrition_estimate: {
    promptId: 'recipe-nutrition-estimate',
    promptVersion: 1,
  },
  cup_conversion: {
    promptId: 'cup-conversion',
    promptVersion: 1,
  },
})

/**
 * @param {string|null|undefined} usageKind
 * @returns {PromptMeta|null}
 */
export function resolvePromptMeta(usageKind) {
  if (usageKind == null || String(usageKind).trim() === '') return null
  const kind = String(usageKind).trim()
  return PROMPT_REGISTRY[kind] ?? null
}
