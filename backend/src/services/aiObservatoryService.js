/**
 * Recipe-library adapter for AI Usage Observatory dual-write.
 * Shared transport lives in `@nikolausstoll/ai-observatory-client`.
 * Never throws; missing URL/key is a no-op.
 */

import {
  buildEvent,
  createObservatoryClient,
  resolveEnvironment,
} from "@nikolausstoll/ai-observatory-client";

export { resolveEnvironment as resolveObservatoryEnvironment };

/**
 * @param {string|null|undefined} usageKind
 * @returns {{ feature: string, operation: string }}
 */
export function mapUsageKindToFeatureOperation(usageKind) {
  const kind =
    usageKind != null && String(usageKind).trim() !== ""
      ? String(usageKind).trim()
      : "unknown";
  const kebab = kind.replace(/_/g, "-");
  return { feature: kebab, operation: kebab };
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
 * @param {object} params
 * @param {number|null|undefined} params.recipeId
 * @param {{ prompt_tokens?: number, completion_tokens?: number, total_tokens?: number }|null|undefined} params.usage
 * @param {unknown} params.responseJson
 * @param {{ model?: string|null, usage_kind?: string|null }} params.meta
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

  // Include eventId in operationId suffix for uniqueness (previous behaviour)
  const event = buildEvent(partial);
  event.operationId = `${feature}:${recipePart}:${operation}:${event.eventId}`;

  if (usage) {
    event.usage = {
      inputTokens: usage.prompt_tokens ?? null,
      outputTokens: usage.completion_tokens ?? null,
      totalTokens: usage.total_tokens ?? null,
      rawUsage: /** @type {Record<string, unknown>} */ (usage),
    };
  }

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
 * @param {{ prompt_tokens?: number, completion_tokens?: number, total_tokens?: number }|null|undefined} params.usage
 * @param {unknown} params.responseJson
 * @param {{ model?: string|null, usage_kind?: string|null }} params.meta
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
