/**
 * Wall-clock timing helpers for OpenAI chat completion calls (Observatory durationMs).
 * Not persisted locally — only passed through logAiTokenUsage → dual-write.
 */

/** @returns {number} high-resolution start mark */
export function openaiCallStart() {
  return performance.now()
}

/**
 * Elapsed whole milliseconds since `openaiCallStart()` (≥ 0).
 * @param {number} startedAt
 * @returns {number}
 */
export function elapsedMsSince(startedAt) {
  const ms = Math.round(performance.now() - startedAt)
  return Number.isFinite(ms) && ms > 0 ? ms : 0
}
