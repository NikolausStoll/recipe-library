const API_BASE = '/api'

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }))
    throw new Error((err as { error?: string }).error || res.statusText)
  }
  if (res.status === 204) return undefined as T
  return res.json()
}

export interface RecipeSourceInfo {
  source_type?: string
  source_name?: string | null
  source_subtitle?: string | null
  source_book_title?: string | null
  source_author?: string | null
  source_year?: number | null
  source_page?: string | null
  source_image_path?: string | null
}

/** Single ingredient line from OCR (new schema) */
export interface ParsedIngredientItem {
  originalText?: string | null
  amount?: number | null
  amountMax?: number | null
  unit?: string | null
  ingredient?: string | null
  category?: string | null
  additionalInfo?: string | null
}

/** Single step from OCR (new schema) */
export interface ParsedRecipeStep {
  index: number
  text?: string | null
}

export interface ParsedRecipeFromOcr {
  title?: string | null
  subtitle?: string | null
  introText?: string | null
  language?: string | null
  servings?: { value?: number | null; unitText?: string | null } | null
  ingredientsSections: {
    heading: string | null
    items: ParsedIngredientItem[]
  }[]
  steps: ParsedRecipeStep[]
  tips?: string[] | null
  nutritionTotal?: { kcal?: number | null; protein?: number | null; carbs?: number | null; fat?: number | null } | null
  prepTimeMinutes?: number | null
  cookTimeMinutes?: number | null
}

export interface RecipeListItem extends RecipeSourceInfo {
  id: number
  source_id: number | null
  source_type: string
  import_method: string
  /** Controlled vocabulary tags (meal, cuisine, dish, diet, context); see GET /api/recipes/tag-options */
  tags?: string[]
  favorite: boolean
  would_cook_again: 'yes' | 'maybe' | 'no' | null
  extract_status: string | null
  extract_confidence?: number | null
  extract_warnings?: string[] | null
  extract_missing_fields?: string[] | null
  status: 'draft' | 'confirmed'
  title: string
  subtitle?: string | null
  description: string | null
  language?: string | null
  servings: number | null
  servings_value?: number | null
  servings_unit_text?: string | null
  nutrition_kcal?: number | null
  nutrition_protein?: number | null
  nutrition_carbs?: number | null
  nutrition_fat?: number | null
  prep_time_min: number | null
  cook_time_min: number | null
  prep_time_source?: 'original' | 'estimated' | null
  cook_time_source?: 'original' | 'estimated' | null
  prep_time_confidence?: number | null
  cook_time_confidence?: number | null
  image_path: string | null
  image_thumb_path?: string | null
  parsed_recipe?: ParsedRecipeFromOcr | null
  created_at: string
  updated_at: string
}

export interface RecipeListItemWithIngredients extends RecipeListItem {
  ingredients: RecipeIngredient[]
}

/** Ingredient row from API (matches RECIPE_JSON_SCHEMA + list form) */
export interface RecipeIngredient {
  id: number
  recipe_id: number
  section_id?: number
  section_heading?: string | null
  position: number
  original_text?: string | null
  amount?: number | null
  amount_max?: number | null
  unit?: string | null
  ingredient?: string | null
  category?: string | null
  name?: string
  additional_info?: string | null
}

export interface Recipe extends RecipeListItem {
  ingredients: RecipeIngredient[]
  recipe_steps: { id: number; recipe_id: number; step_number: number; instruction: string }[]
  tips?: string[]
  /** Latest persisted health estimate from recipe_health_scores; null if never estimated. */
  health_score?: RecipeHealthScoreResponse | null
}

export interface IngredientInput {
  amount?: string | number | null
  unit?: string | null
  name?: string | null
  ingredient?: string | null
  position?: number
  /** When set (edit flow), backend groups consecutive rows by section_id so sections are not merged by heading alone. */
  section_id?: number | null
  original_text?: string | null
  originalText?: string | null
  amount_max?: number | null
  amountMax?: number | null
  category?: string | null
  additional_info?: string | null
  additionalInfo?: string | null
  section_heading?: string | null
}

export interface RecipeStepInput {
  step_number?: number
  instruction: string
}

export interface RecipeFormPayload {
  title: string
  subtitle?: string | null
  description?: string | null
  language?: string | null
  servings?: number | null
  servings_value?: number | null
  servings_unit_text?: string | null
  source_id?: number | null
  source_name?: string | null
  book_title?: string | null
  author?: string | null
  source_page?: string | null
  status?: 'draft' | 'confirmed'
  would_cook_again?: 'yes' | 'maybe' | 'no' | null
  prep_time_min?: number | null
  cook_time_min?: number | null
  prep_time_source?: 'original' | 'estimated' | null
  cook_time_source?: 'original' | 'estimated' | null
  prep_time_confidence?: number | null
  cook_time_confidence?: number | null
  ingredients?: IngredientInput[]
  recipe_steps?: RecipeStepInput[]
  tips?: string[]
  /** Controlled tags; validated server-side. Omit on update to leave unchanged. */
  tags?: string[]
}

export function listRecipes(): Promise<RecipeListItem[]> {
  return fetch(`${API_BASE}/recipes`).then((res) => handleResponse<RecipeListItem[]>(res))
}

export function listRecipesWithIngredients(): Promise<RecipeListItemWithIngredients[]> {
  return fetch(`${API_BASE}/recipes/with-ingredients`).then((res) => handleResponse<RecipeListItemWithIngredients[]>(res))
}

export function listRecipesWithIngredientsFiltered(options?: { favoriteOnly?: boolean }): Promise<RecipeListItemWithIngredients[]> {
  const favoriteOnly = options?.favoriteOnly === true
  const url = favoriteOnly ? `${API_BASE}/recipes/with-ingredients?favorite=1` : `${API_BASE}/recipes/with-ingredients`
  return fetch(url).then((res) => handleResponse<RecipeListItemWithIngredients[]>(res))
}

export function setRecipeFavorite(id: number, favorite: boolean): Promise<{ recipe: Recipe }> {
  return fetch(`${API_BASE}/recipes/${id}/favorite`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ favorite }),
  }).then((res) => handleResponse<{ recipe: Recipe }>(res))
}

/** Raw scrape from a webpage (JSON-LD / HTML); no LLM. */
export type RecipeUrlExtractSource = 'jsonld' | 'jsonld+html' | 'html' | 'none'

export interface RawRecipeFromUrl {
  title: string | null
  description: string | null
  servings_raw: string | null
  prep_time_min: number | null
  cook_time_min: number | null
  total_time_min: number | null
  ingredient_lines: string[]
  steps: string[]
  image_urls: string[]
}

export interface RecipeUrlExtractResult {
  source: RecipeUrlExtractSource
  warnings: string[]
  fetched_url: string
  recipe: RawRecipeFromUrl
}

/** Same envelope as vision extract: status, confidence, inner recipe for DB/parsed_recipe flows */
export interface NormalizedUrlRecipeEnvelope {
  status: 'success' | 'partial' | 'failed'
  confidence: number
  warnings: string[]
  missingFields: string[]
  recipe: ParsedRecipeFromOcr | null
}

export interface RecipeUrlExtractResultWithNormalize extends RecipeUrlExtractResult {
  structured: NormalizedUrlRecipeEnvelope
  normalize_model: string
  normalize_usage: {
    prompt_tokens: number
    completion_tokens: number
    total_tokens: number
  } | null
}

export function extractRecipeFromUrl(
  url: string,
  options?: { normalize?: boolean }
): Promise<RecipeUrlExtractResult | RecipeUrlExtractResultWithNormalize> {
  return fetch(`${API_BASE}/recipes/extract-from-url`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url, normalize: options?.normalize === true }),
  }).then((res) => handleResponse<RecipeUrlExtractResult | RecipeUrlExtractResultWithNormalize>(res))
}

/** Scrape + LLM normalize + create draft recipe; usage logged server-side in ai_token_usage. */
export interface RecipeUrlImportResult {
  recipe: Recipe
  scrape: {
    source: RecipeUrlExtractSource
    warnings: string[]
    fetched_url: string
  }
}

export function importRecipeFromUrl(url: string): Promise<RecipeUrlImportResult> {
  return fetch(`${API_BASE}/recipes/import-from-url`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url }),
  }).then((res) => handleResponse<RecipeUrlImportResult>(res))
}

export function getRecipe(id: number): Promise<Recipe> {
  return fetch(`${API_BASE}/recipes/${id}`).then((res) => handleResponse<Recipe>(res))
}

export function createRecipe(payload: RecipeFormPayload): Promise<Recipe> {
  return fetch(`${API_BASE}/recipes`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  }).then((res) => handleResponse<Recipe>(res))
}

export function updateRecipe(id: number, payload: RecipeFormPayload): Promise<Recipe> {
  return fetch(`${API_BASE}/recipes/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  }).then((res) => handleResponse<Recipe>(res))
}

export function deleteRecipe(id: number): Promise<void> {
  return fetch(`${API_BASE}/recipes/${id}`, { method: 'DELETE' }).then((res) =>
    handleResponse<void>(res)
  )
}

export interface ExtractRecipeResult {
  recipe: Recipe
  usage: { prompt_tokens: number; completion_tokens: number; total_tokens: number } | null
}

export interface NutritionEstimateResult {
  nutritionTotal: {
    kcal?: number | null
    protein_g?: number | null
    carbs_g?: number | null
    fat_g?: number | null
  }
  notes: string[]
  model: string
  tokenUsage: { prompt_tokens: number; completion_tokens: number; total_tokens: number } | null
}

/** Points in original image coords; null = no crop for that image */
export type CropPoints = Array<{ x: number; y: number }> | null

export function extractRecipeFromImages(
  recipeId: number,
  imageFiles: File[],
  pointsPerImage?: CropPoints[]
): Promise<ExtractRecipeResult> {
  const form = new FormData()
  imageFiles.forEach((file) => form.append('images', file))
  if (pointsPerImage && pointsPerImage.length === imageFiles.length) {
    form.append('points', JSON.stringify(pointsPerImage))
  }
  return fetch(`${API_BASE}/recipes/${recipeId}/extract-from-images`, {
    method: 'POST',
    body: form,
  }).then((res) => handleResponse<ExtractRecipeResult>(res))
}

export function estimateRecipeNutrition(recipeId: number): Promise<NutritionEstimateResult> {
  return fetch(`${API_BASE}/recipes/${recipeId}/estimate-nutrition`, {
    method: 'POST',
  }).then((res) => handleResponse<NutritionEstimateResult>(res))
}

/** Practical everyday health estimate (not medical advice). Persisted in recipe_health_scores after POST .../estimate-health-score */
export interface RecipeHealthScoreEstimate {
  healthScore: number | null
  summary: string | null
  positives: string[]
  concerns: string[]
  improvementTips: string[]
  confidence: number | null
}

export interface RecipeHealthScoreResponse {
  estimate: RecipeHealthScoreEstimate
  model: string | null
  tokenUsage: { prompt_tokens: number; completion_tokens: number; total_tokens: number } | null
  /** Echo of structured JSON sent to the model (also stored in ai_token_usage.request_json). */
  requestPayload?: Record<string, unknown>
}

/** By recipe id: estimates, persists to DB, returns the estimate. Body-only POST does not persist. */
export function postRecipeHealthScore(recipeId: number): Promise<RecipeHealthScoreResponse> {
  return fetch(`${API_BASE}/recipes/${recipeId}/estimate-health-score`, {
    method: 'POST',
  }).then((res) => handleResponse<RecipeHealthScoreResponse>(res))
}

export type RecipeTimeSource = 'original' | 'estimated' | null

export interface RecipeTimeEstimatePayload {
  prepTimeMinutes: number | null
  prepTimeConfidence: number
  cookTimeMinutes: number | null
  cookTimeConfidence: number
}

export interface PendingOriginalTimeReplace {
  current: number
  suggested: number
  confidence: number
}

export interface RecipeTimeEstimateSuccess {
  recipe: Recipe
  estimate: RecipeTimeEstimatePayload
  /** Present when original imported times still need user confirmation to overwrite */
  pendingOriginalReplace: {
    prep?: PendingOriginalTimeReplace
    cook?: PendingOriginalTimeReplace
  } | null
}

function coerceEstimateFromResponse(raw: unknown): RecipeTimeEstimatePayload | null {
  if (!raw || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>
  const num = (v: unknown) =>
    typeof v === 'number' && !Number.isNaN(v) ? Math.round(v) : null
  const conf = (v: unknown) =>
    typeof v === 'number' && !Number.isNaN(v) ? Math.min(1, Math.max(0, v)) : 0
  const prepTimeMinutes = num(o.prepTimeMinutes ?? o.prep_time_minutes)
  const cookTimeMinutes = num(o.cookTimeMinutes ?? o.cook_time_minutes)
  return {
    prepTimeMinutes,
    prepTimeConfidence: conf(o.prepTimeConfidence ?? o.prep_time_confidence),
    cookTimeMinutes,
    cookTimeConfidence: conf(o.cookTimeConfidence ?? o.cook_time_confidence),
  }
}

/** Same rules as backend `recipeTimeReplaceConflicts` + pending payload. */
function buildPendingOriginalReplaceFromRecipe(
  recipe: Recipe,
  estimate: RecipeTimeEstimatePayload
): RecipeTimeEstimateSuccess['pendingOriginalReplace'] {
  const pending: NonNullable<RecipeTimeEstimateSuccess['pendingOriginalReplace']> = {}
  if (
    recipe.prep_time_source === 'original' &&
    recipe.prep_time_min != null &&
    estimate.prepTimeMinutes != null
  ) {
    pending.prep = {
      current: recipe.prep_time_min,
      suggested: estimate.prepTimeMinutes,
      confidence: estimate.prepTimeConfidence,
    }
  }
  if (
    recipe.cook_time_source === 'original' &&
    recipe.cook_time_min != null &&
    estimate.cookTimeMinutes != null
  ) {
    pending.cook = {
      current: recipe.cook_time_min,
      suggested: estimate.cookTimeMinutes,
      confidence: estimate.cookTimeConfidence,
    }
  }
  return Object.keys(pending).length > 0 ? pending : null
}

/**
 * AI estimate for prep/cook minutes (gpt-4o-mini). First call runs the model and applies non-original fields.
 * Use `use_client_estimate` + same `estimate` from the prior response to apply after user confirms overwriting originals.
 */
export async function estimateRecipeTimes(
  recipeId: number,
  options?: {
    replace_prep_if_original?: boolean
    replace_cook_if_original?: boolean
    apply_prep?: boolean
    apply_cook?: boolean
    /** Skip LLM; apply `estimate` from a previous response (after user confirms) */
    use_client_estimate?: boolean
    estimate?: RecipeTimeEstimatePayload
  }
): Promise<RecipeTimeEstimateSuccess> {
  const res = await fetch(`${API_BASE}/recipes/${recipeId}/estimate-times`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      replace_prep_if_original: options?.replace_prep_if_original === true,
      replace_cook_if_original: options?.replace_cook_if_original === true,
      apply_prep: options?.apply_prep !== false,
      apply_cook: options?.apply_cook !== false,
      use_client_estimate: options?.use_client_estimate === true,
      estimate: options?.estimate ?? undefined,
    }),
  })
  const data = await res.json().catch(() => ({}))

  if (res.ok) {
    return data as RecipeTimeEstimateSuccess
  }

  // Older backends returned HTTP 409 after the LLM when originals blocked apply. Current API returns 200 + pendingOriginalReplace.
  if (res.status === 409) {
    const payload = data as { error?: string; estimate?: unknown; recipe?: Recipe }
    const est = coerceEstimateFromResponse(payload.estimate)
    if (est && (est.prepTimeMinutes != null || est.cookTimeMinutes != null)) {
      let recipe = payload.recipe
      if (!recipe) {
        try {
          recipe = await getRecipe(recipeId)
        } catch {
          recipe = undefined
        }
      }
      if (recipe) {
        const pending = buildPendingOriginalReplaceFromRecipe(recipe, est)
        if (pending) {
          return {
            recipe,
            estimate: est,
            pendingOriginalReplace: pending,
          }
        }
      }
    }
  }

  const errMsg = (data as { error?: string }).error || res.statusText
  const hint =
    res.status === 409
      ? ' Restart the backend (or rebuild Docker) so POST /api/recipes/:id/estimate-times returns 200 with pendingOriginalReplace instead of 409.'
      : ''
  throw new Error(errMsg + hint)
}

export interface RecipeTagOptionsResponse {
  groups: {
    meal_type: string[]
    cuisine: string[]
    dish_type: string[]
    diet: string[]
    context: string[]
  }
  all_allowed: string[]
}

export function getRecipeTagOptions(): Promise<RecipeTagOptionsResponse> {
  return fetch(`${API_BASE}/recipes/tag-options`).then((res) => handleResponse<RecipeTagOptionsResponse>(res))
}

export interface GenerateRecipeTagsResponse {
  recipe: Recipe
  tags: string[]
  warnings: string[]
  fallbacks?: { meal?: boolean; dish?: boolean }
}

/** AI tag assignment from structured recipe data (separate from extract). Persists tags. */
export function postGenerateRecipeTags(recipeId: number): Promise<GenerateRecipeTagsResponse> {
  return fetch(`${API_BASE}/recipes/${recipeId}/generate-tags`, { method: 'POST' }).then((res) =>
    handleResponse<GenerateRecipeTagsResponse>(res)
  )
}

/** Same scoring as by id, but with a structured recipe object in the body (no DB row). */
export function postRecipeHealthScorePayload(recipe: Record<string, unknown>): Promise<RecipeHealthScoreResponse> {
  return fetch(`${API_BASE}/recipes/estimate-health-score`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ recipe }),
  }).then((res) => handleResponse<RecipeHealthScoreResponse>(res))
}

export interface RecipeHistoryResponse {
  history: string[]
}

export function postRecipeCooked(recipeId: number): Promise<RecipeHistoryResponse> {
  return fetch(`${API_BASE}/recipes/${recipeId}/cook`, { method: 'POST' }).then((res) =>
    handleResponse<RecipeHistoryResponse>(res)
  )
}

export function getRecipeHistory(recipeId: number): Promise<RecipeHistoryResponse> {
  return fetch(`${API_BASE}/recipes/${recipeId}/history`).then((res) =>
    handleResponse<RecipeHistoryResponse>(res)
  )
}
