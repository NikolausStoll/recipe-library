/**
 * Recipe-library adapter for AI Usage Observatory dual-write.
 * Shared transport lives in `@nikolausstoll/ai-observatory-client`.
 * Never throws; missing URL/key is a no-op.
 *
 * Observatory dimensions (strings are opaque to Observatory):
 * - feature = stable product area / capability (e.g. recipe-import)
 * - operation = kind of AI work inside that area (e.g. image-extraction)
 * - operationId = one concrete execution (set in buildObservatoryEvent / backfill)
 *
 * usage_kind → { feature, operation }:
 * | usage_kind            | feature               | operation          |
 * |-----------------------|-----------------------|--------------------|
 * | recipe_image_extract  | recipe-import         | image-extraction   |
 * | url_recipe_normalize  | recipe-import         | url-extraction     |
 * | text_recipe_extract   | recipe-import         | text-extraction    |
 * | recipe_tag            | recipe-enrichment     | tag-generation     |
 * | health_score          | recipe-enrichment     | health-score       |
 * | recipe_time_estimate  | recipe-enrichment     | time-estimate      |
 * | nutrition_estimate    | recipe-enrichment     | nutrition          |
 * | cup_conversion        | recipe-normalization  | cup-conversion     |
 * | (unknown / other)     | recipe-unknown        | kebab(usage_kind) or unknown |
 */

import {
  buildEvent,
  createObservatoryClient,
  resolveEnvironment,
} from "@nikolausstoll/ai-observatory-client";

export { resolveEnvironment as resolveObservatoryEnvironment };

/** @type {Readonly<Record<string, { feature: string, operation: string }>>} */
const USAGE_KIND_FEATURE_OPERATION = Object.freeze({
  recipe_image_extract: { feature: "recipe-import", operation: "image-extraction" },
  url_recipe_normalize: { feature: "recipe-import", operation: "url-extraction" },
  text_recipe_extract: { feature: "recipe-import", operation: "text-extraction" },
  recipe_tag: { feature: "recipe-enrichment", operation: "tag-generation" },
  health_score: { feature: "recipe-enrichment", operation: "health-score" },
  recipe_time_estimate: { feature: "recipe-enrichment", operation: "time-estimate" },
  nutrition_estimate: { feature: "recipe-enrichment", operation: "nutrition" },
  cup_conversion: { feature: "recipe-normalization", operation: "cup-conversion" },
});

/**
 * Map local ai_token_usage.usage_kind → Observatory feature + operation.
 * Known kinds use separate product-area / work-type strings; unknown kinds
 * fall back to feature `recipe-unknown` and a kebab operation (not feature===operation).
 *
 * @param {string|null|undefined} usageKind
 * @returns {{ feature: string, operation: string }}
 */
export function mapUsageKindToFeatureOperation(usageKind) {
  const kind =
    usageKind != null && String(usageKind).trim() !== ""
      ? String(usageKind).trim()
      : "unknown";

  const mapped = USAGE_KIND_FEATURE_OPERATION[kind];
  if (mapped) return { feature: mapped.feature, operation: mapped.operation };

  if (kind === "unknown") {
    return { feature: "recipe-unknown", operation: "unknown" };
  }

  const kebab = kind.replace(/_/g, "-");
  return { feature: "recipe-unknown", operation: kebab };
}

/**
 * @param {unknown} responseJson
 * @returns {"success"|"error"}
 */
export function resolveObservatoryStatus(responseJson) {
  if (
    responseJson != null &&
    typeof responseJson === "object" &&
    !Array.isArray(responseJson)
  ) {
    if ("error" in /** @type {Record<string, unknown>} */ (responseJson)) {
      return "error";
    }
  }
  return "success";
}

/**
 * @param {unknown} value
 * @returns {unknown}
 */
function tryParseJson(value) {
  if (typeof value !== "string") return value;
  const trimmed = value.trim();
  if (!trimmed) return value;
  try {
    return JSON.parse(trimmed);
  } catch {
    return value;
  }
}

/**
 * @param {unknown} requestJson
 * @returns {import("@nikolausstoll/ai-observatory-client").ObservatoryRequestResponse|undefined}
 */
export function buildObservatoryRequest(requestJson) {
  if (requestJson == null) return undefined;
  if (typeof requestJson === "string" && requestJson.trim() === "") return undefined;
  return { raw: tryParseJson(requestJson) };
}

/**
 * @param {unknown} responseJson
 * @returns {import("@nikolausstoll/ai-observatory-client").ObservatoryRequestResponse|undefined}
 */
export function buildObservatoryResponsePayload(responseJson) {
  if (responseJson == null) return undefined;
  if (typeof responseJson === "string") {
    const parsed = tryParseJson(responseJson);
    if (parsed !== responseJson && typeof parsed === "object") {
      return { output: parsed };
    }
    return { raw: responseJson };
  }
  return { output: responseJson };
}

/**
 * @param {object|null|undefined} usage
 * @returns {number|null}
 */
function resolveCachedInputTokens(usage) {
  if (!usage || typeof usage !== "object") return null;
  if (usage.cachedInputTokens != null) return Number(usage.cachedInputTokens);
  const details = usage.prompt_tokens_details;
  if (details != null && typeof details === "object" && details.cached_tokens != null) {
    return Number(details.cached_tokens);
  }
  return null;
}

/**
 * @param {object|null|undefined} usage
 * @returns {number|null}
 */
function resolveReasoningTokens(usage) {
  if (!usage || typeof usage !== "object") return null;
  if (usage.reasoningTokens != null) return Number(usage.reasoningTokens);
  const details = usage.completion_tokens_details;
  if (details != null && typeof details === "object" && details.reasoning_tokens != null) {
    return Number(details.reasoning_tokens);
  }
  return null;
}

/**
 * @param {object} params
 * @param {number|null|undefined} params.recipeId
 * @param {object|null|undefined} params.usage
 * @param {unknown} params.responseJson
 * @param {{
 *   model?: string|null,
 *   usage_kind?: string|null,
 *   request_json?: unknown,
 *   durationMs?: number|null,
 * }} params.meta
 */
export function buildObservatoryEvent({
  recipeId,
  usage,
  responseJson,
  meta = {},
}) {
  const { feature, operation } = mapUsageKindToFeatureOperation(meta.usage_kind);
  const recipePart = recipeId != null ? String(recipeId) : "none";
  const status = resolveObservatoryStatus(responseJson);
  const requestedModel =
    meta.model != null && String(meta.model).trim() !== ""
      ? String(meta.model)
      : "unknown";

  /** @type {import("@nikolausstoll/ai-observatory-client").ObservatoryEventInput} */
  const partial = {
    feature,
    operation,
    operationId: `${feature}:${recipePart}:${operation}`,
    status,
    provider: "openai",
    requestedModel,
  };

  if (meta.durationMs != null && Number.isFinite(Number(meta.durationMs))) {
    partial.durationMs = Number(meta.durationMs);
  }

  // Include eventId in operationId suffix for uniqueness (previous behaviour)
  const event = buildEvent(partial);
  event.operationId = `${feature}:${recipePart}:${operation}:${event.eventId}`;

  if (usage) {
    event.usage = {
      inputTokens: usage.prompt_tokens ?? null,
      outputTokens: usage.completion_tokens ?? null,
      totalTokens: usage.total_tokens ?? null,
      cachedInputTokens: resolveCachedInputTokens(usage),
      reasoningTokens: resolveReasoningTokens(usage),
      rawUsage: /** @type {Record<string, unknown>} */ (usage),
    };
  }

  const request = buildObservatoryRequest(meta.request_json);
  if (request) event.request = request;

  const response = buildObservatoryResponsePayload(responseJson);
  if (response) event.response = response;

  if (recipeId != null) {
    event.metadata = { recipeId };
  }

  if (status === "error" && responseJson != null && typeof responseJson === "object") {
    const errObj = /** @type {Record<string, unknown>} */ (responseJson);
    event.error = {
      message: errObj.error != null ? String(errObj.error) : "error",
    };
  }

  return event;
}

/**
 * POST one event. Resolves silently on any failure.
 * @param {import("@nikolausstoll/ai-observatory-client").ObservatoryEvent} event
 * @returns {Promise<void>}
 */
export async function postObservatoryEvent(event) {
  await createObservatoryClient().postEvent(event);
}

/**
 * Fire-and-forget dual-write after local ai_token_usage INSERT.
 * @param {object} params
 * @param {number|null|undefined} params.recipeId
 * @param {object|null|undefined} params.usage
 * @param {unknown} params.responseJson
 * @param {{
 *   model?: string|null,
 *   usage_kind?: string|null,
 *   request_json?: unknown,
 *   durationMs?: number|null,
 * }} params.meta
 */
export function reportAiUsageToObservatory({
  recipeId,
  usage,
  responseJson,
  meta = {},
}) {
  try {
    const client = createObservatoryClient();
    if (!client.enabled) return;
    client.report(
      buildObservatoryEvent({ recipeId, usage, responseJson, meta }),
    );
  } catch (err) {
    console.warn(
      "[ai-observatory] report failed:",
      err instanceof Error ? err.message : err,
    );
  }
}
