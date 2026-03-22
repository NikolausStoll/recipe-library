/**
 * Recipe images: uploaded file (`image_path`) or remote URLs from URL import (`image_urls_json`, best first).
 */

export function firstImageUrlFromJson(imageUrlsJson: string | null | undefined): string | null {
  if (!imageUrlsJson || typeof imageUrlsJson !== 'string') return null
  try {
    const urls = JSON.parse(imageUrlsJson) as unknown
    if (!Array.isArray(urls)) return null
    for (const u of urls) {
      if (typeof u === 'string' && u.trim()) return u.trim()
    }
  } catch {
    /* ignore */
  }
  return null
}

/** Thumbnail or upload path for list cards; falls back to first remote URL when no upload. */
export function getRecipeCardImageUrl(recipe: {
  image_processing_pending?: boolean
  image_path?: string | null
  image_thumb_path?: string | null
  image_urls_json?: string | null
}): string | null {
  if (recipe.image_processing_pending) return null
  if (recipe.image_path) return recipe.image_thumb_path ?? recipe.image_path
  return firstImageUrlFromJson(recipe.image_urls_json)
}

/** Full-size hero: upload path or first remote URL (no thumbnail). */
export function getRecipeHeroImageUrl(recipe: {
  image_processing_pending?: boolean
  image_path?: string | null
  image_urls_json?: string | null
}): string | null {
  if (recipe.image_processing_pending) return null
  if (recipe.image_path) return recipe.image_path
  return firstImageUrlFromJson(recipe.image_urls_json)
}

/** Editor preview: same as hero (full path or best remote URL). */
export function getRecipeFormPreviewUrl(recipe: {
  image_path?: string | null
  image_urls_json?: string | null
}): string | null {
  if (recipe.image_path) return recipe.image_path
  return firstImageUrlFromJson(recipe.image_urls_json)
}
