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
}

export interface RecipeListItem extends RecipeSourceInfo {
  id: number
  source_id: number | null
  source_type: string
  import_method: string
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
  name?: string
  additional_info?: string | null
}

export interface Recipe extends RecipeListItem {
  ingredients: RecipeIngredient[]
  recipe_steps: { id: number; recipe_id: number; step_number: number; instruction: string }[]
  tips?: string[]
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
  ingredients?: IngredientInput[]
  recipe_steps?: RecipeStepInput[]
  tips?: string[]
}

export function listRecipes(): Promise<RecipeListItem[]> {
  return fetch(`${API_BASE}/recipes`).then((res) => handleResponse<RecipeListItem[]>(res))
}

export function listRecipesWithIngredients(): Promise<RecipeListItemWithIngredients[]> {
  return fetch(`${API_BASE}/recipes/with-ingredients`).then((res) =>
    handleResponse<RecipeListItemWithIngredients[]>(res)
  )
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
