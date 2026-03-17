import { getDb } from '../db/index.js'

const RECIPE_COLUMNS = [
  'id', 'source_id', 'source_page', 'import_method', 'extract_status', 'status',
  'title', 'description', 'servings', 'prep_time_min', 'cook_time_min', 'image_path',
  'parsed_recipe_json',
  'created_at', 'updated_at',
]

const SOURCE_FIELDS = ['book_title', 'author', 'subtitle', 'year']

const SOURCE_KEYS = ['source_name', ...SOURCE_FIELDS]

function hasSourceFields(body) {
  if (!body) return false
  if (body.source_name != null && String(body.source_name).trim() !== '') return true
  return SOURCE_FIELDS.some(f => body[f] != null && String(body[f]).trim() !== '')
}

function hasAnySourceKey(body) {
  return body && SOURCE_KEYS.some(k => k in body)
}

function getSourcePayload(body) {
  const name = (body.book_title ?? body.source_name ?? '').trim() || 'Unnamed'
  return {
    name,
    book_title: (body.book_title ?? '').trim() || null,
    subtitle: (body.subtitle ?? '').trim() || null,
    author: (body.author ?? '').trim() || null,
    year: body.year != null ? Number(body.year) : null,
  }
}

/**
 * Create or update recipe_source from body. Returns sourceId or null.
 */
function resolveSource(db, body, existingSourceId = null) {
  if (!hasSourceFields(body)) return null
  const p = getSourcePayload(body)
  if (existingSourceId) {
    db.prepare(`
      UPDATE recipe_sources SET type = 'book', name = ?, book_title = ?, subtitle = ?, author = ?, year = ?
      WHERE id = ?
    `).run(p.name, p.book_title, p.subtitle, p.author, p.year, existingSourceId)
    return existingSourceId
  }
  db.prepare(`
    INSERT INTO recipe_sources (type, name, url, book_title, subtitle, author, year)
    VALUES ('book', ?, NULL, ?, ?, ?, ?)
  `).run(p.name, p.book_title, p.subtitle, p.author, p.year)
  return db.prepare('SELECT last_insert_rowid() as id').get().id
}

/**
 * List all recipes (without ingredients/steps). Includes source fields from recipe_sources.
 */
export function listRecipes() {
  const db = getDb()
  const rows = db.prepare(`
    SELECT r.id, r.source_id, r.source_page, r.import_method, r.extract_status, r.status,
           r.title, r.description, r.servings, r.prep_time_min, r.cook_time_min, r.image_path,
           r.parsed_recipe_json, r.created_at, r.updated_at,
           s.type AS source_type, s.name AS source_name, s.subtitle AS source_subtitle, s.book_title AS source_book_title,
           s.author AS source_author, s.year AS source_year, s.image_path AS source_image_path
    FROM recipes r LEFT JOIN recipe_sources s ON r.source_id = s.id
    ORDER BY r.updated_at DESC, r.id DESC
  `).all()
  return rows.map(row => ({
    ...rowToRecipe(row),
    source_type: row.source_type ?? 'manual',
    source_name: row.source_name ?? null,
    source_subtitle: row.source_subtitle ?? null,
    source_book_title: row.source_book_title ?? null,
    source_author: row.source_author ?? null,
    source_year: row.source_year ?? null,
    source_page: row.source_page ?? null,
    source_image_path: row.source_image_path ?? null,
  }))
}

/**
 * Get one recipe by id with ingredients and steps. Returns null if not found.
 */
export function getRecipeById(id) {
  const db = getDb()
  const recipeRow = db.prepare(`
    SELECT ${RECIPE_COLUMNS.join(', ')} FROM recipes WHERE id = ?
  `).get(Number(id))
  if (!recipeRow) return null

  const ingredients = db.prepare(`
    SELECT id, recipe_id, position, amount, unit, name FROM ingredients WHERE recipe_id = ? ORDER BY position, id
  `).all(Number(id))

  const recipeSteps = db.prepare(`
    SELECT id, recipe_id, step_number, instruction FROM recipe_steps WHERE recipe_id = ? ORDER BY step_number, id
  `).all(Number(id))

  let sourceData = null
  if (recipeRow.source_id) {
    const s = db.prepare('SELECT type, name, subtitle, book_title, author, year, image_path FROM recipe_sources WHERE id = ?').get(recipeRow.source_id)
    if (s) {
      sourceData = {
        source_type: s.type ?? 'manual',
        source_name: s.name,
        source_subtitle: s.subtitle ?? null,
        source_book_title: s.book_title ?? null,
        source_author: s.author ?? null,
        source_year: s.year ?? null,
        source_image_path: s.image_path ?? null,
      }
    }
  }
  return {
    ...rowToRecipe(recipeRow),
    source_type: sourceData?.source_type ?? 'manual',
    ...(sourceData || {}),
    ingredients: ingredients.map(row => ({
      id: row.id,
      recipe_id: row.recipe_id,
      position: row.position,
      amount: row.amount,
      unit: row.unit,
      name: row.name,
    })),
    recipe_steps: recipeSteps.map(row => ({
      id: row.id,
      recipe_id: row.recipe_id,
      step_number: row.step_number,
      instruction: row.instruction,
    })),
  }
}

/**
 * Create a recipe. Optional body: ingredients[], recipe_steps[], source_page (recipe page in book), source_name and source fields (book_title, author, subtitle, year).
 */
export function createRecipe(body) {
  const db = getDb()
  const recipe = sanitizeRecipeInput(body)
  const now = new Date().toISOString().slice(0, 19).replace('T', ' ')

  let sourceId = recipe.source_id ?? null
  if (hasSourceFields(body)) {
    sourceId = resolveSource(db, body)
  }

  const result = db.prepare(`
    INSERT INTO recipes (source_id, source_page, import_method, extract_status, status, title, description, servings, prep_time_min, cook_time_min, image_path, created_at, updated_at)
    VALUES (?, ?, ?, ?, 'draft', ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    sourceId,
    (recipe.source_page ?? '').trim() || null,
    recipe.import_method ?? 'manual',
    recipe.extract_status ?? null,
    recipe.title ?? '',
    recipe.description ?? null,
    recipe.servings ?? null,
    recipe.prep_time_min ?? null,
    recipe.cook_time_min ?? null,
    recipe.image_path ?? null,
    now,
    now,
  )

  const id = result.lastInsertRowid

  if (Array.isArray(body.ingredients) && body.ingredients.length) {
    const insertIng = db.prepare(`
      INSERT INTO ingredients (recipe_id, position, amount, unit, name) VALUES (?, ?, ?, ?, ?)
    `)
    body.ingredients.forEach((ing, i) => {
      insertIng.run(id, ing.position ?? i, ing.amount ?? null, ing.unit ?? null, ing.name ?? '')
    })
  }

  if (Array.isArray(body.recipe_steps) && body.recipe_steps.length) {
    const insertStep = db.prepare(`
      INSERT INTO recipe_steps (recipe_id, step_number, instruction) VALUES (?, ?, ?)
    `)
    body.recipe_steps.forEach((step, i) => {
      insertStep.run(id, step.step_number ?? i + 1, step.instruction ?? '')
    })
  }

  return getRecipeById(id)
}

/**
 * Update a recipe by id. Optional body: ingredients[], recipe_steps[], source_page, source fields (source_name, book_title, author, subtitle, year).
 */
export function updateRecipe(id, body) {
  const db = getDb()
  const existingRow = db.prepare(`SELECT ${RECIPE_COLUMNS.join(', ')} FROM recipes WHERE id = ?`).get(Number(id))
  if (!existingRow) return null

  const recipe = sanitizeRecipeInput(body)
  let sourceId = recipe.source_id ?? existingRow.source_id ?? null
  if (body && hasSourceFields(body)) {
    sourceId = resolveSource(db, body, existingRow.source_id ?? undefined)
  } else if (body && hasAnySourceKey(body) && !(body.source_id != null)) {
    sourceId = null
  }

  const status = (body && (body.status === 'draft' || body.status === 'confirmed')) ? body.status : (existingRow.status ?? 'draft')
  const now = new Date().toISOString().slice(0, 19).replace('T', ' ')
  const title = (body && body.title !== undefined) ? (recipe.title ?? '') : existingRow.title
  const description = (body && 'description' in body) ? recipe.description : existingRow.description
  const servings = (body && 'servings' in body) ? recipe.servings : existingRow.servings
  const prep_time_min = (body && 'prep_time_min' in body) ? recipe.prep_time_min : existingRow.prep_time_min
  const cook_time_min = (body && 'cook_time_min' in body) ? recipe.cook_time_min : existingRow.cook_time_min
  const image_path = (body && 'image_path' in body) ? recipe.image_path : existingRow.image_path
  const import_method = (body && 'import_method' in body) ? (recipe.import_method ?? 'manual') : existingRow.import_method
  const extract_status = (body && 'extract_status' in body) ? recipe.extract_status : existingRow.extract_status
  const source_page = (body && 'source_page' in body) ? ((recipe.source_page ?? '').trim() || null) : (existingRow.source_page ?? null)

  db.prepare(`
    UPDATE recipes SET
      source_id = ?, source_page = ?, import_method = ?, extract_status = ?, status = ?,
      title = ?, description = ?, servings = ?, prep_time_min = ?, cook_time_min = ?, image_path = ?,
      updated_at = ?
    WHERE id = ?
  `).run(
    sourceId,
    source_page,
    import_method,
    extract_status,
    status,
    title ?? '',
    description ?? null,
    servings ?? null,
    prep_time_min ?? null,
    cook_time_min ?? null,
    image_path ?? null,
    now,
    Number(id),
  )

  if (Array.isArray(body.ingredients)) {
    db.prepare('DELETE FROM ingredients WHERE recipe_id = ?').run(Number(id))
    const insertIng = db.prepare(`
      INSERT INTO ingredients (recipe_id, position, amount, unit, name) VALUES (?, ?, ?, ?, ?)
    `)
    body.ingredients.forEach((ing, i) => {
      insertIng.run(Number(id), ing.position ?? i, ing.amount ?? null, ing.unit ?? null, ing.name ?? '')
    })
  }

  if (Array.isArray(body.recipe_steps)) {
    db.prepare('DELETE FROM recipe_steps WHERE recipe_id = ?').run(Number(id))
    const insertStep = db.prepare(`
      INSERT INTO recipe_steps (recipe_id, step_number, instruction) VALUES (?, ?, ?)
    `)
    body.recipe_steps.forEach((step, i) => {
      insertStep.run(Number(id), step.step_number ?? i + 1, step.instruction ?? '')
    })
  }

  return getRecipeById(id)
}

/**
 * Delete a recipe by id. Returns true if deleted, false if not found.
 */
export function deleteRecipe(id) {
  const db = getDb()
  const result = db.prepare('DELETE FROM recipes WHERE id = ?').run(Number(id))
  return result.changes > 0
}

/**
 * Set parsed recipe result (from text extraction). Updates parsed_recipe_json, optionally title and extract_status.
 */
export function setRecipeParsedRecipe(id, parsedRecipe, options = {}) {
  const db = getDb()
  const existing = db.prepare('SELECT id FROM recipes WHERE id = ?').get(Number(id))
  if (!existing) return null
  const json = JSON.stringify(parsedRecipe)
  const now = new Date().toISOString().slice(0, 19).replace('T', ' ')
  if (options.updateTitle && parsedRecipe.title?.trim()) {
    db.prepare(`
      UPDATE recipes SET parsed_recipe_json = ?, title = ?, extract_status = 'done', updated_at = ? WHERE id = ?
    `).run(json, parsedRecipe.title.trim(), now, id)
  } else {
    db.prepare(`
      UPDATE recipes SET parsed_recipe_json = ?, extract_status = 'done', updated_at = ? WHERE id = ?
    `).run(json, now, id)
  }
  return getRecipeById(id)
}

function rowToRecipe(row) {
  let parsed_recipe = null
  if (row.parsed_recipe_json) {
    try {
      parsed_recipe = JSON.parse(row.parsed_recipe_json)
    } catch (_) {}
  }
  return {
    id: row.id,
    source_id: row.source_id,
    source_page: row.source_page ?? null,
    import_method: row.import_method,
    extract_status: row.extract_status,
    status: row.status ?? 'draft',
    title: row.title,
    description: row.description,
    servings: row.servings,
    prep_time_min: row.prep_time_min,
    cook_time_min: row.cook_time_min,
    image_path: row.image_path,
    parsed_recipe,
    created_at: row.created_at,
    updated_at: row.updated_at,
  }
}

function sanitizeRecipeInput(body) {
  const allowed = [
    'source_id', 'source_page', 'import_method', 'extract_status', 'status',
    'title', 'description', 'servings', 'prep_time_min', 'cook_time_min', 'image_path',
  ]
  const out = {}
  for (const key of allowed) {
    if (body && key in body) out[key] = body[key]
  }
  return out
}
