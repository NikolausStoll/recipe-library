import type { Recipe, RecipeFormPayload, ParsedRecipeFromOcr, RecipeHealthScoreResponse } from '../api/recipes'

export type RecipeFormInitial = Partial<RecipeFormPayload> & {
  source_type?: string | null
  source_subtitle?: string | null
  source_author?: string | null
  source_year?: number | null
  source_image_path?: string | null
  parsed_recipe?: ParsedRecipeFromOcr | null
  import_method?: string | null
  extract_confidence?: number | null
  extract_missing_fields?: string[] | null
  nutrition_kcal?: number | null
  nutrition_protein?: number | null
  nutrition_carbs?: number | null
  nutrition_fat?: number | null
  image_path?: string | null
  image_urls_json?: string | null
  image_processing_pending?: boolean
  prep_time_min?: number | null
  cook_time_min?: number | null
  prep_time_source?: 'original' | 'estimated' | null
  cook_time_source?: 'original' | 'estimated' | null
  prep_time_confidence?: number | null
  cook_time_confidence?: number | null
  health_score?: RecipeHealthScoreResponse | null
}

export function buildFormInitialFromRecipe(recipe: Recipe): RecipeFormInitial {
  return {
    title: recipe.title,
    subtitle: recipe.subtitle ?? '',
    description: recipe.description ?? '',
    servings: recipe.servings ?? null,
    source_id: recipe.source_id ?? null,
    source_type: recipe.source_type ?? null,
    source_url: recipe.source_url ?? null,
    original_url: recipe.original_url ?? null,
    source_domain: recipe.source_domain ?? null,
    source_name: recipe.source_name ?? null,
    source_subtitle: recipe.source_subtitle ?? null,
    source_author: recipe.source_author ?? null,
    source_year: recipe.source_year ?? null,
    source_image_path: recipe.source_image_path ?? null,
    source_page: recipe.source_page ?? '',
    image_path: recipe.image_path ?? null,
    image_processing_pending: recipe.image_processing_pending ?? false,
    would_cook_again: recipe.would_cook_again ?? null,
    ingredients: recipe.ingredients.map((ing) => ({
      amount: ing.amount != null ? String(ing.amount) : '',
      unit: ing.unit ?? '',
      name: ing.name ?? ing.ingredient ?? '',
      category: ing.category ?? null,
      section_id: ing.section_id ?? null,
      section_heading: ing.section_heading ?? null,
      original_text: ing.original_text ?? null,
      additional_info: ing.additional_info ?? (ing as { additionalInfo?: string | null }).additionalInfo ?? null,
    })),
    recipe_steps: recipe.recipe_steps.map((s) => ({ instruction: s.instruction ?? '' })),
    parsed_recipe: recipe.parsed_recipe ?? null,
    extract_confidence: recipe.extract_confidence ?? null,
    extract_missing_fields: recipe.extract_missing_fields ?? null,
    nutrition_kcal: recipe.nutrition_kcal ?? null,
    nutrition_protein: recipe.nutrition_protein ?? null,
    nutrition_carbs: recipe.nutrition_carbs ?? null,
    nutrition_fat: recipe.nutrition_fat ?? null,
    tips: recipe.tips ?? [],
    import_method: recipe.import_method ?? 'manual',
    prep_time_min: recipe.prep_time_min ?? null,
    cook_time_min: recipe.cook_time_min ?? null,
    prep_time_source: recipe.prep_time_source ?? null,
    cook_time_source: recipe.cook_time_source ?? null,
    prep_time_confidence: recipe.prep_time_confidence ?? null,
    cook_time_confidence: recipe.cook_time_confidence ?? null,
    tags: recipe.tags ?? [],
    image_urls_json: recipe.image_urls_json ?? null,
    health_score: recipe.health_score ?? null,
  }
}

export function buildFormInitialFromImportedRecipe(recipe: Recipe): RecipeFormInitial {
  const pr = recipe.parsed_recipe
  type Ing = {
    amount: string
    unit: string
    name: string
    category?: string | null
    section_id?: number | null
    section_heading?: string | null
    original_text?: string | null
    additional_info?: string | null
  }
  const ingredients: Ing[] = []
  if (recipe.ingredients?.length) {
    for (const ing of recipe.ingredients) {
      ingredients.push({
        amount: ing.amount != null ? String(ing.amount) : '',
        unit: ing.unit ?? '',
        name: ing.name ?? ing.ingredient ?? '',
        category: ing.category ?? null,
        section_id: ing.section_id ?? null,
        section_heading: ing.section_heading ?? null,
        original_text: ing.original_text ?? null,
        additional_info: ing.additional_info ?? (ing as { additionalInfo?: string | null }).additionalInfo ?? null,
      })
    }
  } else if (pr?.ingredientsSections?.length) {
    for (const section of pr.ingredientsSections) {
      for (const item of section.items ?? []) {
        ingredients.push({
          amount: item.amount != null ? String(item.amount) : '',
          unit: (item as { unit?: string }).unit ?? '',
          name: (item as { ingredient?: string }).ingredient ?? (item as { originalText?: string }).originalText ?? '',
          category: (item as { category?: string | null }).category ?? null,
          section_heading: section.heading ?? null,
          original_text: (item as { originalText?: string | null }).originalText ?? null,
          additional_info: (item as { additionalInfo?: string | null }).additionalInfo ?? null,
        })
      }
    }
  }
  if (ingredients.length === 0) ingredients.push({ amount: '', unit: '', name: '', additional_info: '' })

  const recipe_steps = (pr?.steps ?? []).map((s) => ({ instruction: s?.text?.trim() ?? '' }))
  if (recipe_steps.length === 0) recipe_steps.push({ instruction: '' })

  return {
    title: recipe.title ?? '',
    subtitle: recipe.subtitle ?? '',
    description: pr?.introText ?? recipe.description ?? '',
    servings: pr?.servings?.value ?? recipe.servings ?? null,
    source_id: recipe.source_id ?? null,
    source_type: recipe.source_type ?? null,
    source_url: recipe.source_url ?? null,
    original_url: recipe.original_url ?? null,
    source_domain: recipe.source_domain ?? null,
    source_name: recipe.source_name ?? null,
    source_page: recipe.source_page ?? '',
    ingredients,
    recipe_steps,
    parsed_recipe: pr ?? null,
    extract_confidence: recipe.extract_confidence ?? null,
    extract_missing_fields: recipe.extract_missing_fields ?? null,
    nutrition_kcal: recipe.nutrition_kcal ?? pr?.nutritionTotal?.kcal ?? null,
    nutrition_protein: recipe.nutrition_protein ?? pr?.nutritionTotal?.protein ?? null,
    nutrition_carbs: recipe.nutrition_carbs ?? pr?.nutritionTotal?.carbs ?? null,
    nutrition_fat: recipe.nutrition_fat ?? pr?.nutritionTotal?.fat ?? null,
    tips: recipe.tips ?? [],
    import_method: recipe.import_method ?? 'manual',
    prep_time_min: recipe.prep_time_min ?? null,
    cook_time_min: recipe.cook_time_min ?? null,
    prep_time_source: recipe.prep_time_source ?? null,
    cook_time_source: recipe.cook_time_source ?? null,
    prep_time_confidence: recipe.prep_time_confidence ?? null,
    cook_time_confidence: recipe.cook_time_confidence ?? null,
    tags: recipe.tags ?? [],
    image_path: recipe.image_path ?? null,
    image_urls_json: recipe.image_urls_json ?? null,
    image_processing_pending: recipe.image_processing_pending ?? false,
  }
}
