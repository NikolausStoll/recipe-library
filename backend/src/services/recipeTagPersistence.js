/**
 * Normalized storage: one row per (recipe, tag).
 */

import { getDb } from '../db/index.js'

/**
 * @param {number} recipeId
 * @returns {string[]}
 */
export function getTagsForRecipe(recipeId) {
  const db = getDb()
  const rows = db
    .prepare('SELECT tag FROM recipe_tags WHERE recipe_id = ? ORDER BY tag')
    .all(Number(recipeId))
  return rows.map((r) => r.tag)
}

/**
 * @param {number[]} recipeIds
 * @returns {Map<number, string[]>}
 */
export function getTagsForRecipeIds(recipeIds) {
  const map = new Map()
  if (!recipeIds.length) return map
  const db = getDb()
  const placeholders = recipeIds.map(() => '?').join(', ')
  const rows = db
    .prepare(`SELECT recipe_id, tag FROM recipe_tags WHERE recipe_id IN (${placeholders}) ORDER BY recipe_id, tag`)
    .all(...recipeIds)
  for (const r of rows) {
    const id = r.recipe_id
    if (!map.has(id)) map.set(id, [])
    map.get(id).push(r.tag)
  }
  return map
}

/**
 * Replace all tags for a recipe.
 * @param {number|string} recipeId
 * @param {string[]} tags – already validated
 */
export function replaceRecipeTags(recipeId, tags) {
  const db = getDb()
  const id = Number(recipeId)
  const tx = db.transaction(() => {
    db.prepare('DELETE FROM recipe_tags WHERE recipe_id = ?').run(id)
    const ins = db.prepare('INSERT INTO recipe_tags (recipe_id, tag) VALUES (?, ?)')
    for (const t of tags) {
      if (typeof t === 'string' && t.trim()) ins.run(id, t.trim())
    }
  })
  tx()
}
