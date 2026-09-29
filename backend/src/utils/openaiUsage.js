/**
 * Normalize OpenAI chat.completions `usage` without dropping detail fields.
 * Preserves prompt_tokens_details / completion_tokens_details (cached + reasoning)
 * and any other provider fields for Observatory `rawUsage`.
 *
 * @param {object|null|undefined} usage
 * @returns {{
 *   prompt_tokens: number|null,
 *   completion_tokens: number|null,
 *   total_tokens: number|null,
 *   prompt_tokens_details?: object,
 *   completion_tokens_details?: object,
 * }|null}
 */
export function normalizeOpenAiUsage(usage) {
  if (!usage || typeof usage !== 'object') return null
  return {
    ...usage,
    prompt_tokens: usage.prompt_tokens ?? null,
    completion_tokens: usage.completion_tokens ?? null,
    total_tokens: usage.total_tokens ?? null,
    ...(usage.prompt_tokens_details != null
      ? { prompt_tokens_details: usage.prompt_tokens_details }
      : {}),
    ...(usage.completion_tokens_details != null
      ? { completion_tokens_details: usage.completion_tokens_details }
      : {}),
  }
}
