import { getDb } from '../db/index.js'

/**
 * @typedef {{ id: number, ingredient: string, cups: number, grams: number, note: string | null, position: number, created_at: string, updated_at: string }} CupGramReference
 */

function mapRow(row) {
  if (!row) return null
  return {
    id: row.id,
    ingredient: row.ingredient,
    cups: Number(row.cups),
    grams: Number(row.grams),
    note: row.note ?? null,
    position: row.position,
    created_at: row.created_at,
    updated_at: row.updated_at,
  }
}

export function listCupGramReferences() {
  const db = getDb()
  const rows = db
    .prepare(
      `SELECT id, ingredient, cups, grams, note, position, created_at, updated_at
       FROM cup_gram_references
       ORDER BY position ASC, id ASC`
    )
    .all()
  return rows.map(mapRow)
}

export function getCupGramReferenceById(id) {
  const db = getDb()
  const row = db
    .prepare(
      `SELECT id, ingredient, cups, grams, note, position, created_at, updated_at
       FROM cup_gram_references WHERE id = ?`
    )
    .get(id)
  return mapRow(row)
}

/**
 * @param {{ ingredient: string, cups: number, grams: number, note?: string | null, position?: number }} body
 */
export function createCupGramReference(body) {
  const db = getDb()
  const ingredient = String(body.ingredient ?? '').trim()
  const cups = Number(body.cups)
  const grams = Number(body.grams)
  const note = body.note != null && String(body.note).trim() ? String(body.note).trim() : null
  const maxPos = db.prepare('SELECT COALESCE(MAX(position), -1) AS m FROM cup_gram_references').get()
  const position =
    body.position != null && Number.isFinite(Number(body.position))
      ? Math.max(0, Math.floor(Number(body.position)))
      : (maxPos?.m ?? -1) + 1
  const now = new Date().toISOString().slice(0, 19).replace('T', ' ')
  const result = db
    .prepare(
      `INSERT INTO cup_gram_references (ingredient, cups, grams, note, position, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
    .run(ingredient, cups, grams, note, position, now, now)
  return getCupGramReferenceById(result.lastInsertRowid)
}

/**
 * @param {number} id
 * @param {{ ingredient?: string, cups?: number, grams?: number, note?: string | null, position?: number }} body
 */
export function updateCupGramReference(id, body) {
  const existing = getCupGramReferenceById(id)
  if (!existing) return null
  const ingredient =
    body.ingredient !== undefined ? String(body.ingredient).trim() : existing.ingredient
  const cups = body.cups !== undefined ? Number(body.cups) : existing.cups
  const grams = body.grams !== undefined ? Number(body.grams) : existing.grams
  let note = existing.note
  if (body.note !== undefined) {
    note = body.note != null && String(body.note).trim() ? String(body.note).trim() : null
  }
  const position =
    body.position !== undefined && Number.isFinite(Number(body.position))
      ? Math.max(0, Math.floor(Number(body.position)))
      : existing.position
  const now = new Date().toISOString().slice(0, 19).replace('T', ' ')
  getDb()
    .prepare(
      `UPDATE cup_gram_references
       SET ingredient = ?, cups = ?, grams = ?, note = ?, position = ?, updated_at = ?
       WHERE id = ?`
    )
    .run(ingredient, cups, grams, note, position, now, id)
  return getCupGramReferenceById(id)
}

export function deleteCupGramReference(id) {
  const db = getDb()
  const result = db.prepare('DELETE FROM cup_gram_references WHERE id = ?').run(id)
  return result.changes > 0
}

/** True if any ingredient line mentions cup (English) — URL normalization only uses this. */
export function rawRecipeContainsCup(rawRecipe) {
  const lines = Array.isArray(rawRecipe?.ingredient_lines) ? rawRecipe.ingredient_lines : []
  const cupRe = /\bcups?\b/i
  for (const line of lines) {
    const text = typeof line === 'string' ? line : String(line ?? '')
    if (cupRe.test(text)) return true
  }
  return false
}

function formatCupsLabel(cups) {
  const n = Number(cups)
  if (!Number.isFinite(n) || n <= 0) return String(cups)
  if (n === 1) return '1 cup'
  const whole = Math.abs(n - Math.round(n)) < 1e-6
  return whole ? `${Math.round(n)} cups` : `${n} cups`
}

/**
 * Prompt block for LLM when raw recipe uses cup. Empty string if no references configured.
 */
export function formatCupGramReferencesForPrompt() {
  const refs = listCupGramReferences()
  if (!refs.length) return ''
  const lines = refs.map((r) => {
    const label = formatCupsLabel(r.cups)
    const ing = r.ingredient.trim()
    const note = r.note?.trim() ? ` (${r.note.trim()})` : ''
    return `- "${label} ${ing}" → ${Math.round(r.grams)} g${note}`
  })
  return `
Cup-to-gram references:

Use the following curated references first when ingredient and preparation state plausibly match. This list is not exhaustive.

If no curated reference matches, use general culinary knowledge for common solids. Prefer estimating common pantry items, grains, legumes, flour, sugar, nuts, seeds, chopped vegetables, and frozen vegetable mixes.

Be cautious with leafy greens, herbs, grated ingredients, loosely packed ingredients, mixed ingredients, or unclear preparation states. If uncertain, keep "Tasse".

Rules:
- Prefer the most specific match.
- Respect raw/cooked, dry/drained, chopped/sliced/grated, packed/loose, frozen.
- Do not force weak matches.
- Do not invent precise conversions for unusual, ambiguous, or highly preparation-dependent ingredients.
- Scale linearly.
- Round to practical kitchen values.
- Preserve original cup text in originalText.
- Keep preparation notes in additionalInfo.

References:
${lines.join('\n')}
`
}
