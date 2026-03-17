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

export interface ParsedRecipeFromOcr {
  title: string
  introText: string
  ingredientsSections: { heading: string | null; items: string[] }[]
  steps: string[]
}

export interface RecipeListItem extends RecipeSourceInfo {
  id: number
  source_id: number | null
  source_type: string
  import_method: string
  extract_status: string | null
  status: 'draft' | 'confirmed'
  title: string
  description: string | null
  servings: number | null
  prep_time_min: number | null
  cook_time_min: number | null
  image_path: string | null
  parsed_recipe?: ParsedRecipeFromOcr | null
  created_at: string
  updated_at: string
}

export interface Recipe extends RecipeListItem {
  ingredients: { id: number; recipe_id: number; position: number; amount: string | null; unit: string | null; name: string }[]
  recipe_steps: { id: number; recipe_id: number; step_number: number; instruction: string }[]
}

export interface IngredientInput {
  amount?: string | null
  unit?: string | null
  name: string
  position?: number
}

export interface RecipeStepInput {
  step_number?: number
  instruction: string
}

export interface RecipeFormPayload {
  title: string
  description?: string | null
  servings?: number | null
  source_name?: string | null
  book_title?: string | null
  author?: string | null
  source_page?: string | null
  status?: 'draft' | 'confirmed'
  ingredients?: IngredientInput[]
  recipe_steps?: RecipeStepInput[]
}

export function listRecipes(): Promise<RecipeListItem[]> {
  return fetch(`${API_BASE}/recipes`).then((res) => handleResponse<RecipeListItem[]>(res))
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
