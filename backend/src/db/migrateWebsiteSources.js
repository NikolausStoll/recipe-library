import {
  canonicalWebsiteSourceUrl,
  faviconUrlForDomain,
  normalizeDomainFromUrl,
  urlLooksLikeRecipePage,
} from '../utils/normalizeDomain.js'

function ensureColumn(database, table, column, ddl) {
  const cols = database.prepare(`PRAGMA table_info(${table})`).all()
  if (!cols.some((c) => c.name === column)) {
    database.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${ddl}`)
  }
}

/**
 * Schema extensions + one-time normalization for URL/website sources.
 */
export function migrateWebsiteSourcesSchema(database) {
  ensureColumn(database, 'recipes', 'original_url', 'TEXT')
  ensureColumn(database, 'recipe_sources', 'domain', 'TEXT')
  ensureColumn(database, 'recipe_sources', 'favicon_url', 'TEXT')
  database.exec(
    `CREATE INDEX IF NOT EXISTS idx_recipe_sources_domain ON recipe_sources(domain) WHERE domain IS NOT NULL`,
  )
}

/**
 * Deduplicate legacy URL sources by domain; move full URLs to recipes.original_url.
 */
export function migrateWebsiteSourcesData(database) {
  const urlSources = database
    .prepare(`SELECT id, name, url, domain FROM recipe_sources WHERE type = 'url' ORDER BY id`)
    .all()

  const byDomain = new Map()
  for (const src of urlSources) {
    const domain =
      (src.domain && String(src.domain).trim()) ||
      normalizeDomainFromUrl(src.url || src.name)
    if (!domain) continue
    if (!byDomain.has(domain)) byDomain.set(domain, [])
    byDomain.get(domain).push(src)
  }

  const updateSource = database.prepare(`
    UPDATE recipe_sources SET domain = ?, name = ?, url = ?, favicon_url = COALESCE(favicon_url, ?)
    WHERE id = ?
  `)
  const reassignRecipes = database.prepare('UPDATE recipes SET source_id = ? WHERE source_id = ?')
  const deleteSource = database.prepare('DELETE FROM recipe_sources WHERE id = ?')
  const setOriginalUrl = database.prepare(
    `UPDATE recipes SET original_url = ? WHERE id = ? AND (original_url IS NULL OR TRIM(original_url) = '')`,
  )

  for (const [domain, sources] of byDomain) {
    const canonical = sources[0]
    const siteUrl = canonicalWebsiteSourceUrl(domain)
    const favicon = faviconUrlForDomain(domain)

    for (const src of sources) {
      const fullUrl = src.url != null ? String(src.url).trim() : ''
      if (!fullUrl || !urlLooksLikeRecipePage(fullUrl)) continue
      const recipeRows = database.prepare('SELECT id FROM recipes WHERE source_id = ?').all(src.id)
      for (const row of recipeRows) {
        setOriginalUrl.run(fullUrl, row.id)
      }
    }

    for (const dup of sources.slice(1)) {
      reassignRecipes.run(canonical.id, dup.id)
      deleteSource.run(dup.id)
    }

    updateSource.run(domain, domain, siteUrl, favicon, canonical.id)
  }
}

export function runWebsiteSourceMigrations(database) {
  migrateWebsiteSourcesSchema(database)
  migrateWebsiteSourcesData(database)
}
