/**
 * Recipe-library adapter for AI Usage Observatory dual-write.
 * Shared transport lives in `@nikolausstoll/ai-observatory-client`.
 * Never throws; missing URL/key is a no-op.
 *
 * Observatory dimensions (strings are opaque to Observatory):
 * - feature = stable product area / capability (e.g. recipe-import)
 * - operation = kind of AI work inside that area (e.g. image-extraction)
 * - operationId = one concrete execution (set in buildObservatoryEvent / backfill)
 * - applicationVersion = app release (backend package.json)
 * - promptId / promptVersion = which exact prompt text (see `constants/promptRegistry.js`)
 * - subjectId / subjectLabel = optional domain object (recipe id / title at event time)
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

import { createRequire } from "node:module";
import {
  buildEvent,
  createObservatoryClient,
  resolveEnvironment,
} from "@nikolausstoll/ai-observatory-client";
import { resolvePromptMeta } from "../constants/promptRegistry.js";

export { resolveEnvironment as resolveObservatoryEnvironment };

const require = createRequire(import.meta.url);

/**
 * Recipe Library release version sent as Observatory `applicationVersion`.
 * @returns {string}
 */
export function resolveApplicationVersion() {
  try {
    const pkg = require("../../package.json");
    if (pkg?.version != null && String(pkg.version).trim() !== "") {
      return String(pkg.version).trim();
    }
  } catch {
    // ignore
  }
  return "unknown";
}

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
 * Optional Observatory subject fields from a recipe row/object already in hand.
 * Does not look up the DB. Empty/missing title → subjectId only (or empty object).
 *
 * @param {{ id?: number|string|null, title?: string|null }|null|undefined} recipe
 * @returns {{ subjectId?: string, subjectLabel?: string }}
 */
export function subjectFieldsFromRecipe(recipe) {
  if (recipe == null || recipe.id == null || String(recipe.id).trim() === "") {
    return {};
  }
  /** @type {{ subjectId?: string, subjectLabel?: string }} */
  const fields = { subjectId: String(recipe.id) };
  const label = normalizeSubjectLabel(recipe.title);
  if (label !== undefined) fields.subjectLabel = label;
  return fields;
}

/**
 * @param {unknown} value
 * @returns {string|undefined}
 */
export function normalizeSubjectLabel(value) {
  if (value == null) return undefined;
  const trimmed = String(value).trim();
  return trimmed !== "" ? trimmed : undefined;
}

/**
 * Resolve subjectId / subjectLabel for an Observatory event.
 * Prefer explicit meta; otherwise derive subjectId from recipeId when present.
 *
 * @param {number|string|null|undefined} recipeId
 * @param {{ subjectId?: string|null, subjectLabel?: string|null }} [meta]
 * @returns {{ subjectId?: string, subjectLabel?: string }}
 */
export function resolveObservatorySubject(recipeId, meta = {}) {
  /** @type {{ subjectId?: string, subjectLabel?: string }} */
  const subject = {};

  const explicitId =
    meta.subjectId != null && String(meta.subjectId).trim() !== ""
      ? String(meta.subjectId).trim()
      : undefined;
  if (explicitId !== undefined) {
    subject.subjectId = explicitId;
  } else if (recipeId != null && String(recipeId).trim() !== "") {
    subject.subjectId = String(recipeId);
  }

  const label = normalizeSubjectLabel(meta.subjectLabel);
  if (label !== undefined) subject.subjectLabel = label;

  return subject;
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
 *   observatory_request?: unknown,
 *   durationMs?: number|null,
 *   subjectId?: string|null,
 *   subjectLabel?: string|null,
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

  const { subjectId, subjectLabel } = resolveObservatorySubject(recipeId, meta);

  /** @type {import("@nikolausstoll/ai-observatory-client").ObservatoryEventInput} */
  const partial = {
    feature,
    operation,
    operationId: `${feature}:${recipePart}:${operation}`,
    status,
    provider: "openai",
    requestedModel,
    applicationVersion: resolveApplicationVersion(),
  };

  // Prefer client `subject` ergonomics; buildEvent flattens to subjectId / subjectLabel.
  if (subjectId !== undefined || subjectLabel !== undefined) {
    partial.subject = {};
    if (subjectId !== undefined) partial.subject.id = subjectId;
    if (subjectLabel !== undefined) partial.subject.label = subjectLabel;
  }

  const promptMeta = resolvePromptMeta(meta.usage_kind);
  if (promptMeta) {
    partial.promptId = promptMeta.promptId;
    partial.promptVersion = String(promptMeta.promptVersion);
  }

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

  const request = resolveObservatoryRequestPayload(meta);
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
 * Prefer `observatory_request` (Observatory-only) over persisted `request_json`.
 * @param {{ request_json?: unknown, observatory_request?: unknown }} [meta]
 * @returns {import("@nikolausstoll/ai-observatory-client").ObservatoryRequestResponse|undefined}
 */
function resolveObservatoryRequestPayload(meta = {}) {
  if (meta.observatory_request != null) {
    const value = meta.observatory_request;
    if (
      value != null &&
      typeof value === "object" &&
      !Array.isArray(value) &&
      ("input" in value || "raw" in value || "output" in value || "metadata" in value)
    ) {
      return /** @type {import("@nikolausstoll/ai-observatory-client").ObservatoryRequestResponse} */ (
        value
      );
    }
    return { input: value };
  }
  return buildObservatoryRequest(meta.request_json);
}

/**
 * Map Recipe Library artifact shape → shared client `uploadArtifact` input.
 * @param {{
 *   data: import("@nikolausstoll/ai-observatory-client").ArtifactBinary,
 *   role?: string,
 *   label?: string,
 *   filename?: string,
 *   mimeType?: string,
 *   contentType?: string,
 * }} artifact
 * @returns {import("@nikolausstoll/ai-observatory-client").UploadArtifactInput|null}
 */
function toClientArtifactInput(artifact) {
  if (!artifact?.data) return null;
  const role = artifact.role === "output" ? "output" : "input";
  /** @type {import("@nikolausstoll/ai-observatory-client").UploadArtifactInput} */
  const input = { role, data: artifact.data };
  const mimeType = artifact.mimeType ?? artifact.contentType;
  if (mimeType != null && String(mimeType).trim() !== "") {
    input.mimeType = String(mimeType).trim();
  }
  if (artifact.filename != null && String(artifact.filename).trim() !== "") {
    input.filename = String(artifact.filename).trim();
  }
  if (artifact.label != null && String(artifact.label).trim() !== "") {
    input.label = String(artifact.label).trim();
  }
  return input;
}

/**
 * POST event then optional artifacts via `@nikolausstoll/ai-observatory-client`. Never throws.
 * @param {import("@nikolausstoll/ai-observatory-client").ObservatoryEvent} event
 * @param {Array<{
 *   data: import("@nikolausstoll/ai-observatory-client").ArtifactBinary,
 *   role?: string,
 *   label?: string,
 *   filename?: string,
 *   mimeType?: string,
 *   contentType?: string,
 * }>} [artifacts]
 * @param {import("@nikolausstoll/ai-observatory-client").ObservatoryClientOptions} [options]
 */
export async function postObservatoryEventWithArtifacts(
  event,
  artifacts = [],
  options = {},
) {
  const client = createObservatoryClient(options);
  if (!client.enabled) return;
  await client.postEvent(event);
  if (!Array.isArray(artifacts) || artifacts.length === 0) return;
  for (const artifact of artifacts) {
    const input = toClientArtifactInput(artifact);
    if (!input) continue;
    await client.uploadArtifact(event.eventId, input);
  }
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
 * Optional `artifacts` are uploaded with the shared client after the event
 * (`uploadArtifact` → POST …/events/{eventId}/artifacts).
 * @param {object} params
 * @param {number|null|undefined} params.recipeId
 * @param {object|null|undefined} params.usage
 * @param {unknown} params.responseJson
 * @param {{
 *   model?: string|null,
 *   usage_kind?: string|null,
 *   request_json?: unknown,
 *   observatory_request?: unknown,
 *   durationMs?: number|null,
 *   subjectId?: string|null,
 *   subjectLabel?: string|null,
 * }} params.meta
 * @param {Array<{
 *   data: import("@nikolausstoll/ai-observatory-client").ArtifactBinary,
 *   role?: string,
 *   label?: string,
 *   filename?: string,
 *   mimeType?: string,
 *   contentType?: string,
 * }>} [params.artifacts]
 */
export function reportAiUsageToObservatory({
  recipeId,
  usage,
  responseJson,
  meta = {},
  artifacts = [],
}) {
  try {
    const client = createObservatoryClient();
    if (!client.enabled) return;
    const event = buildObservatoryEvent({ recipeId, usage, responseJson, meta });
    void postObservatoryEventWithArtifacts(event, artifacts).catch((err) => {
      console.warn(
        "[ai-observatory] report failed:",
        err instanceof Error ? err.message : err,
      );
    });
  } catch (err) {
    console.warn(
      "[ai-observatory] report failed:",
      err instanceof Error ? err.message : err,
    );
  }
}
