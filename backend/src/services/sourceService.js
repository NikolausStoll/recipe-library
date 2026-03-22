import { getDb } from '../db/index.js'
import { getThumbnailPathIfExists } from '../utils/uploadPaths.js'

const SOURCE_TYPES = ['book', 'url', 'manual', 'other']

/**
 * List all recipe sources (e.g. for dropdowns). Ordered by name.
 */
export function listSources() {
  const db = getDb()
  const rows = db.prepare(`
    SELECT id, type, name, subtitle, url, book_title, author, year, image_path, image_processing_pending, created_at
    FROM recipe_sources
    ORDER BY name, id
  `).all()
  return rows.map(rowToSource)
}

/**
 * Get one source by id. Returns null if not found.
 */
export function getSourceById(id) {
  const db = getDb()
  const row = db.prepare(`
    SELECT id, type, name, subtitle, url, book_title, author, year, image_path, image_processing_pending, created_at
    FROM recipe_sources WHERE id = ?
  `).get(Number(id))
  return row ? rowToSource(row) : null
}

/**
 * Create a recipe source. Body: type, name (title), subtitle?, author?, year?, image_path?, url?, book_title? (alias for name when type=book).
 */
export function createSource(body) {
  const db = getDb()
  const p = sanitizeSourceInput(body)
  const type = SOURCE_TYPES.includes(p.type) ? p.type : 'book'
  const name = (p.name ?? p.book_title ?? '').trim() || 'Unnamed'
  db.prepare(`
    INSERT INTO recipe_sources (type, name, subtitle, url, book_title, author, year, image_path, image_processing_pending)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0)
  `).run(
    type,
    name,
    (p.subtitle ?? '').trim() || null,
    (p.url ?? '').trim() || null,
    (p.book_title ?? name).trim() || null,
    (p.author ?? '').trim() || null,
    p.year != null ? Number(p.year) : null,
    (p.image_path ?? '').trim() || null
  )
  const id = db.prepare('SELECT last_insert_rowid() as id').get().id
  return getSourceById(id)
}

/**
 * Set source cover URL and processing flag (internal: finalize deferred upload).
 * @param {number|string} id
 * @param {{ image_path: string | null, image_processing_pending: boolean }} params
 */
export function setSourceImagePathAndPending(id, { image_path, image_processing_pending }) {
  const db = getDb()
  const pending = image_processing_pending === true || image_processing_pending === 1 ? 1 : 0
  db.prepare(`UPDATE recipe_sources SET image_path = ?, image_processing_pending = ? WHERE id = ?`).run(
    image_path ?? null,
    pending,
    Number(id),
  )
  return getSourceById(id)
}

/**
 * Update a recipe source by id.
 */
export function updateSource(id, body) {
  const db = getDb()
  const existing = db.prepare('SELECT id FROM recipe_sources WHERE id = ?').get(Number(id))
  if (!existing) return null
  const p = sanitizeSourceInput(body)
  const type = p.type != null && SOURCE_TYPES.includes(p.type) ? p.type : undefined
  const name = p.name != null ? String(p.name).trim() || null : undefined
  const subtitle = p.subtitle !== undefined ? (String(p.subtitle).trim() || null) : undefined
  const url = p.url !== undefined ? (String(p.url).trim() || null) : undefined
  const book_title = p.book_title !== undefined ? (String(p.book_title).trim() || null) : undefined
  const author = p.author !== undefined ? (String(p.author).trim() || null) : undefined
  const year = p.year !== undefined ? (p.year === '' || p.year == null ? null : Number(p.year)) : undefined
  const image_path = p.image_path !== undefined ? (String(p.image_path).trim() || null) : undefined

  const updates = []
  const values = []
  if (type != null) { updates.push('type = ?'); values.push(type) }
  if (name != null) { updates.push('name = ?'); values.push(name) }
  if (subtitle !== undefined) { updates.push('subtitle = ?'); values.push(subtitle) }
  if (url !== undefined) { updates.push('url = ?'); values.push(url) }
  if (book_title !== undefined) { updates.push('book_title = ?'); values.push(book_title) }
  if (author !== undefined) { updates.push('author = ?'); values.push(author) }
  if (year !== undefined) { updates.push('year = ?'); values.push(year) }
  if (image_path !== undefined) {
    updates.push('image_path = ?')
    values.push(image_path)
    updates.push('image_processing_pending = ?')
    values.push(0)
  }
  if (updates.length) {
    values.push(Number(id))
    db.prepare(`UPDATE recipe_sources SET ${updates.join(', ')} WHERE id = ?`).run(...values)
  }
  return getSourceById(id)
}

/**
 * Delete a source. Returns false if any recipe references it (and does not delete).
 */
export function deleteSource(id) {
  const db = getDb()
  const refs = db.prepare('SELECT COUNT(*) as n FROM recipes WHERE source_id = ?').get(Number(id))
  if (refs.n > 0) return false
  const result = db.prepare('DELETE FROM recipe_sources WHERE id = ?').run(Number(id))
  return result.changes > 0
}

function rowToSource(row) {
  return {
    id: row.id,
    type: row.type ?? 'book',
    name: row.name,
    subtitle: row.subtitle ?? null,
    url: row.url ?? null,
    book_title: row.book_title ?? null,
    author: row.author ?? null,
    year: row.year ?? null,
    image_path: row.image_path ?? null,
    image_processing_pending: row.image_processing_pending === 1,
    image_thumb_path:
      row.image_processing_pending === 1 ? null : getThumbnailPathIfExists(row.image_path),
    created_at: row.created_at,
  }
}

function sanitizeSourceInput(body) {
  const allowed = ['type', 'name', 'subtitle', 'url', 'book_title', 'author', 'year', 'image_path']
  const out = {}
  if (!body) return out
  for (const key of allowed) {
    if (key in body) out[key] = body[key]
  }
  return out
}
