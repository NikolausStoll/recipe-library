import { getDb } from '../db/index.js'
import { getThumbnailPathIfExists } from '../utils/uploadPaths.js'
import {
  canonicalWebsiteSourceUrl,
  faviconUrlForDomain,
  normalizeDomainFromUrl,
} from '../utils/normalizeDomain.js'

const SOURCE_TYPES = ['book', 'url', 'manual', 'other']
const WEBSITE_SOURCE_TYPES = ['url']

/**
 * List all recipe sources (e.g. for dropdowns). Ordered by name.
 */
export function listSources() {
  const db = getDb()
  const rows = db.prepare(`
    SELECT s.id, s.type, s.name, s.subtitle, s.url, s.domain, s.favicon_url,
           s.book_title, s.author, s.year, s.image_path, s.image_processing_pending, s.created_at,
           COUNT(r.id) AS recipe_count
    FROM recipe_sources s
    LEFT JOIN recipes r ON r.source_id = s.id
    GROUP BY s.id
    ORDER BY s.type, s.name, s.id
  `).all()
  return rows.map(rowToSource)
}

/**
 * Get one source by id. Returns null if not found.
 */
export function getSourceById(id) {
  const db = getDb()
  const row = db.prepare(`
    SELECT s.id, s.type, s.name, s.subtitle, s.url, s.domain, s.favicon_url,
           s.book_title, s.author, s.year, s.image_path, s.image_processing_pending, s.created_at,
           (SELECT COUNT(*) FROM recipes r WHERE r.source_id = s.id) AS recipe_count
    FROM recipe_sources s WHERE s.id = ?
  `).get(Number(id))
  return row ? rowToSource(row) : null
}

/**
 * Find or create a website source keyed by normalized domain (not full recipe URL).
 * @param {string} url – recipe or site URL (domain is derived)
 * @param {{ name?: string }} [options]
 */
export function findOrCreateUrlSource(url, options = {}) {
  const normalized = url != null ? String(url).trim() : ''
  if (!normalized) return null

  const domain = normalizeDomainFromUrl(normalized)
  if (!domain) return null

  const db = getDb()
  const typeList = WEBSITE_SOURCE_TYPES.map(() => '?').join(', ')
  let existing = db
    .prepare(
      `SELECT id FROM recipe_sources WHERE type IN (${typeList}) AND domain = ? LIMIT 1`,
    )
    .get(...WEBSITE_SOURCE_TYPES, domain)

  if (!existing) {
    existing = db
      .prepare(
        `SELECT id FROM recipe_sources WHERE type IN (${typeList}) AND domain IS NULL AND (name = ? OR url = ? OR url LIKE ?) LIMIT 1`,
      )
      .get(...WEBSITE_SOURCE_TYPES, domain, normalized, `%://${domain}%`)
  }

  if (existing) {
    const src = getSourceById(existing.id)
    if (src && !src.domain) {
      db.prepare(
        `UPDATE recipe_sources SET domain = ?, name = ?, url = ?, favicon_url = COALESCE(favicon_url, ?) WHERE id = ?`,
      ).run(domain, domain, canonicalWebsiteSourceUrl(domain), faviconUrlForDomain(domain), src.id)
      return getSourceById(src.id)
    }
    return src
  }

  const name = options.name != null ? String(options.name).trim() : domain
  const siteUrl = canonicalWebsiteSourceUrl(domain)
  const favicon = faviconUrlForDomain(domain)

  db.prepare(`
    INSERT INTO recipe_sources (type, name, subtitle, url, domain, favicon_url, book_title, author, year, image_path, image_processing_pending)
    VALUES ('url', ?, NULL, ?, ?, ?, NULL, NULL, NULL, NULL, 0)
  `).run(name || domain, siteUrl, domain, favicon)

  const id = db.prepare('SELECT last_insert_rowid() as id').get().id
  return getSourceById(id)
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
    INSERT INTO recipe_sources (type, name, subtitle, url, domain, favicon_url, book_title, author, year, image_path, image_processing_pending)
    VALUES (?, ?, ?, ?, NULL, NULL, ?, ?, ?, ?, 0)
  `).run(
    type,
    name,
    (p.subtitle ?? '').trim() || null,
    (p.url ?? '').trim() || null,
    (p.book_title ?? name).trim() || null,
    (p.author ?? '').trim() || null,
    p.year != null ? Number(p.year) : null,
    (p.image_path ?? '').trim() || null,
  )
  const id = db.prepare('SELECT last_insert_rowid() as id').get().id
  return getSourceById(id)
}

/**
 * Set source cover URL and processing flag (internal: finalize deferred upload).
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
  const existing = db.prepare('SELECT id, type FROM recipe_sources WHERE id = ?').get(Number(id))
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
 * Delete a source.
 * @param {number|string} id
 * @param {{ unlinkRecipes?: boolean }} [options]
 * @returns {{ ok: true, unlinkedRecipeCount: number } | { ok: false, reason: 'not_found'|'in_use'|'unlink_not_allowed', recipeCount?: number, canUnlink?: boolean }}
 */
export function deleteSource(id, options = {}) {
  const db = getDb()
  const sourceId = Number(id)
  const source = db.prepare('SELECT id, type FROM recipe_sources WHERE id = ?').get(sourceId)
  if (!source) {
    return { ok: false, reason: 'not_found' }
  }

  const refs = db.prepare('SELECT COUNT(*) as n FROM recipes WHERE source_id = ?').get(sourceId)
  const recipeCount = refs?.n ?? 0
  const isWebsite = source.type === 'url'
  let unlinkedRecipeCount = 0

  if (recipeCount > 0) {
    if (options.unlinkRecipes && isWebsite) {
      const unlink = db.prepare('UPDATE recipes SET source_id = NULL WHERE source_id = ?').run(sourceId)
      unlinkedRecipeCount = unlink.changes
    } else {
      return {
        ok: false,
        reason: 'in_use',
        recipeCount,
        canUnlink: isWebsite,
      }
    }
  }

  const result = db.prepare('DELETE FROM recipe_sources WHERE id = ?').run(sourceId)
  if (result.changes < 1) {
    return { ok: false, reason: 'not_found' }
  }
  return { ok: true, unlinkedRecipeCount }
}

function rowToSource(row) {
  const type = row.type ?? 'book'
  return {
    id: row.id,
    type,
    source_kind: type === 'url' ? 'website' : type,
    name: row.name,
    subtitle: row.subtitle ?? null,
    url: row.url ?? null,
    domain: row.domain ?? null,
    favicon_url: row.favicon_url ?? null,
    book_title: row.book_title ?? null,
    author: row.author ?? null,
    year: row.year ?? null,
    image_path: row.image_path ?? null,
    image_processing_pending: row.image_processing_pending === 1,
    image_thumb_path:
      row.image_processing_pending === 1 ? null : getThumbnailPathIfExists(row.image_path),
    recipe_count: row.recipe_count != null ? Number(row.recipe_count) : undefined,
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
