import { getDb } from '../db/index.js'

const RECIPE_COLUMNS = [
  'id', 'source_id', 'source_page', 'import_method', 'extract_status', 'extract_confidence', 'extract_warnings', 'extract_missing_fields',
  'status', 'title', 'subtitle', 'description', 'language', 'servings_value', 'servings_unit_text',
  'nutrition_kcal', 'nutrition_protein', 'nutrition_carbs', 'nutrition_fat',
  'prep_time_min', 'cook_time_min', 'image_path',
  'created_at', 'updated_at',
]

const SOURCE_FIELDS = ['book_title', 'author', 'year']

const SOURCE_KEYS = ['source_name', ...SOURCE_FIELDS]

function hasSourceFields(body) {
  if (!body) return false
  if (body.source_name != null && String(body.source_name).trim() !== '') return true
  return SOURCE_FIELDS.some((field) => {
    const value = body[field]
    return value != null && String(value).trim() !== ''
  })
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
           r.title, r.subtitle, r.description, r.language, r.servings_value, r.servings_unit_text,
           r.prep_time_min, r.cook_time_min, r.image_path, r.created_at, r.updated_at,
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
 * Get one recipe by id with ingredients, steps, tips. Returns null if not found.
 * Builds parsed_recipe from normalized data for frontend display.
 */
export function getRecipeById(id) {
  const db = getDb()
  const recipeRow = db.prepare(`
    SELECT ${RECIPE_COLUMNS.join(', ')} FROM recipes WHERE id = ?
  `).get(Number(id))
  if (!recipeRow) return null

  const sections = db.prepare(`
    SELECT id, recipe_id, position, heading FROM recipe_ingredient_sections WHERE recipe_id = ? ORDER BY position, id
  `).all(Number(id))

  const allIngredients = []
  for (const sec of sections) {
    const items = db.prepare(`
      SELECT id, section_id, position, original_text, amount, amount_max, unit, ingredient, additional_info
      FROM ingredients WHERE section_id = ? ORDER BY position, id
    `).all(sec.id)
    allIngredients.push({ section: sec, items })
  }

  const recipeSteps = db.prepare(`
    SELECT id, recipe_id, step_number, instruction FROM recipe_steps WHERE recipe_id = ? ORDER BY step_number, id
  `).all(Number(id))

  const tips = db.prepare(`
    SELECT id, recipe_id, position, text FROM recipe_tips WHERE recipe_id = ? ORDER BY position, id
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

  const parsed_recipe = buildParsedRecipeFromRow(recipeRow, allIngredients, recipeSteps, tips)
  const flatIngredients = allIngredients.flatMap(({ section, items }) =>
    items.map((row) => ({
      id: row.id,
      recipe_id: recipeRow.id,
      section_id: row.section_id,
      position: row.position,
      section_heading: section.heading,
      original_text: row.original_text,
      amount: row.amount,
      amount_max: row.amount_max,
      unit: row.unit,
      ingredient: row.ingredient,
      name: row.ingredient,
      additional_info: row.additional_info,
    }))
  )

  return {
    ...rowToRecipe(recipeRow),
    source_type: sourceData?.source_type ?? 'manual',
    ...(sourceData || {}),
    ingredients: flatIngredients,
    recipe_steps: recipeSteps.map((row) => ({
      id: row.id,
      recipe_id: row.recipe_id,
      step_number: row.step_number,
      instruction: row.instruction,
    })),
    tips: tips.map((t) => t.text),
    parsed_recipe,
  }
}

function buildParsedRecipeFromRow(row, sectionsWithItems, steps, tips) {
  return {
    title: row.title ?? null,
    subtitle: row.subtitle ?? null,
    introText: row.description ?? null,
    language: row.language ?? null,
    servings: (row.servings_value != null || row.servings_unit_text != null)
      ? { value: row.servings_value ?? null, unitText: row.servings_unit_text ?? null }
      : null,
    ingredientsSections: sectionsWithItems.map(({ section, items }) => ({
      heading: section.heading ?? null,
      items: items.map((i) => ({
        originalText: i.original_text ?? null,
        amount: i.amount ?? null,
        amountMax: i.amount_max ?? null,
        unit: i.unit ?? null,
        ingredient: i.ingredient ?? null,
        additionalInfo: i.additional_info ?? null,
      })),
    })),
    steps: steps.map((s) => ({ index: s.step_number, text: s.instruction ?? null })),
    tips: tips.map((t) => t.text ?? ''),
    nutritionTotal: (row.nutrition_kcal != null || row.nutrition_protein != null || row.nutrition_carbs != null || row.nutrition_fat != null)
      ? {
          kcal: row.nutrition_kcal ?? null,
          protein: row.nutrition_protein ?? null,
          carbs: row.nutrition_carbs ?? null,
          fat: row.nutrition_fat ?? null,
        }
      : null,
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
    INSERT INTO recipes (source_id, source_page, import_method, extract_status, status, title, subtitle, description, language, servings_value, servings_unit_text, prep_time_min, cook_time_min, image_path, created_at, updated_at)
    VALUES (?, ?, ?, ?, 'draft', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    sourceId,
    (recipe.source_page ?? '').trim() || null,
    recipe.import_method ?? 'manual',
    recipe.extract_status ?? null,
    recipe.title ?? '',
    recipe.subtitle ?? null,
    recipe.description ?? null,
    recipe.language ?? null,
    recipe.servings_value ?? recipe.servings ?? null,
    recipe.servings_unit_text ?? null,
    recipe.prep_time_min ?? null,
    recipe.cook_time_min ?? null,
    recipe.image_path ?? null,
    now,
    now,
  )

  const id = result.lastInsertRowid

  if (Array.isArray(body.ingredients) && body.ingredients.length) {
    db.prepare('INSERT INTO recipe_ingredient_sections (recipe_id, position, heading) VALUES (?, 0, NULL)').run(id)
    const sectionId = db.prepare('SELECT id FROM recipe_ingredient_sections WHERE recipe_id = ? ORDER BY position, id DESC LIMIT 1').get(id).id
    const insertIng = db.prepare(`
      INSERT INTO ingredients (section_id, position, original_text, amount, amount_max, unit, ingredient, additional_info) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `)
    body.ingredients.forEach((ing, i) => {
      const amount = ing.amount != null ? (typeof ing.amount === 'number' ? ing.amount : parseFloat(String(ing.amount))) : null
      const amountMax = ing.amount_max ?? ing.amountMax ?? amount
      insertIng.run(
        sectionId,
        ing.position ?? i,
        ing.original_text ?? ing.originalText ?? null,
        amount,
        amountMax != null ? (typeof amountMax === 'number' ? amountMax : parseFloat(String(amountMax))) : null,
        ing.unit ?? null,
        (ing.ingredient ?? ing.name ?? '').trim() || null,
        ing.additional_info ?? ing.additionalInfo ?? null
      )
    })
  }

  if (Array.isArray(body.recipe_steps) && body.recipe_steps.length) {
    const insertStep = db.prepare(`
      INSERT INTO recipe_steps (recipe_id, step_number, instruction) VALUES (?, ?, ?)
    `)
    body.recipe_steps.forEach((step, i) => {
      insertStep.run(id, step.step_number ?? i + 1, (step.instruction ?? step.text ?? '').trim() || '')
    })
  }

  if (Array.isArray(body.tips) && body.tips.length) {
    const insertTip = db.prepare('INSERT INTO recipe_tips (recipe_id, position, text) VALUES (?, ?, ?)')
    body.tips.forEach((t, i) => {
      insertTip.run(id, i, typeof t === 'string' ? t : (t?.text ?? ''))
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
  const subtitle = (body && 'subtitle' in body) ? (recipe.subtitle ?? null) : existingRow.subtitle
  const description = (body && 'description' in body) ? recipe.description : existingRow.description
  const language = (body && 'language' in body) ? (recipe.language ?? null) : existingRow.language
  const servings_value = (body && ('servings' in body || 'servings_value' in body)) ? (recipe.servings_value ?? recipe.servings ?? null) : existingRow.servings_value
  const servings_unit_text = (body && 'servings_unit_text' in body) ? (recipe.servings_unit_text ?? null) : existingRow.servings_unit_text
  const prep_time_min = (body && 'prep_time_min' in body) ? recipe.prep_time_min : existingRow.prep_time_min
  const cook_time_min = (body && 'cook_time_min' in body) ? recipe.cook_time_min : existingRow.cook_time_min
  const image_path = (body && 'image_path' in body) ? recipe.image_path : existingRow.image_path
  const import_method = (body && 'import_method' in body) ? (recipe.import_method ?? 'manual') : existingRow.import_method
  const extract_status = (body && 'extract_status' in body) ? recipe.extract_status : existingRow.extract_status
  const source_page = (body && 'source_page' in body) ? ((recipe.source_page ?? '').trim() || null) : (existingRow.source_page ?? null)

  db.prepare(`
    UPDATE recipes SET
      source_id = ?, source_page = ?, import_method = ?, extract_status = ?, status = ?,
      title = ?, subtitle = ?, description = ?, language = ?, servings_value = ?, servings_unit_text = ?,
      prep_time_min = ?, cook_time_min = ?, image_path = ?,
      updated_at = ?
    WHERE id = ?
  `).run(
    sourceId,
    source_page,
    import_method,
    extract_status,
    status,
    title ?? '',
    subtitle ?? null,
    description ?? null,
    language ?? null,
    servings_value ?? null,
    servings_unit_text ?? null,
    prep_time_min ?? null,
    cook_time_min ?? null,
    image_path ?? null,
    now,
    Number(id),
  )

  if (Array.isArray(body.ingredients)) {
    const sectionIds = db.prepare('SELECT id FROM recipe_ingredient_sections WHERE recipe_id = ?').all(Number(id))
    for (const s of sectionIds) {
      db.prepare('DELETE FROM ingredients WHERE section_id = ?').run(s.id)
    }
    db.prepare('DELETE FROM recipe_ingredient_sections WHERE recipe_id = ?').run(Number(id))
    if (body.ingredients.length) {
      db.prepare('INSERT INTO recipe_ingredient_sections (recipe_id, position, heading) VALUES (?, 0, NULL)').run(Number(id))
      const sectionId = db.prepare('SELECT id FROM recipe_ingredient_sections WHERE recipe_id = ? ORDER BY position, id DESC LIMIT 1').get(Number(id)).id
      const insertIng = db.prepare(`
        INSERT INTO ingredients (section_id, position, original_text, amount, amount_max, unit, ingredient, additional_info) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `)
      body.ingredients.forEach((ing, i) => {
        const amount = ing.amount != null ? (typeof ing.amount === 'number' ? ing.amount : parseFloat(String(ing.amount))) : null
        const amountMax = ing.amount_max ?? ing.amountMax ?? amount
        insertIng.run(
          sectionId,
          ing.position ?? i,
          ing.original_text ?? ing.originalText ?? null,
          amount,
          amountMax != null ? (typeof amountMax === 'number' ? amountMax : parseFloat(String(amountMax))) : null,
          ing.unit ?? null,
          (ing.ingredient ?? ing.name ?? '').trim() || null,
          ing.additional_info ?? ing.additionalInfo ?? null
        )
      })
    }
  }

  if (Array.isArray(body.recipe_steps)) {
    db.prepare('DELETE FROM recipe_steps WHERE recipe_id = ?').run(Number(id))
    const insertStep = db.prepare(`
      INSERT INTO recipe_steps (recipe_id, step_number, instruction) VALUES (?, ?, ?)
    `)
    body.recipe_steps.forEach((step, i) => {
      insertStep.run(Number(id), step.step_number ?? i + 1, (step.instruction ?? step.text ?? '').trim() || '')
    })
  }

  if (Array.isArray(body.tips)) {
    db.prepare('DELETE FROM recipe_tips WHERE recipe_id = ?').run(Number(id))
    const insertTip = db.prepare('INSERT INTO recipe_tips (recipe_id, position, text) VALUES (?, ?, ?)')
    body.tips.forEach((t, i) => {
      insertTip.run(Number(id), i, typeof t === 'string' ? t : (t?.text ?? ''))
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
 * Set parsed recipe result (from text extraction). Writes extraction into normalized tables (recipe row + sections + ingredients + steps + tips).
 * parsedRecipe is the full extraction result { status, confidence, warnings, missingFields, recipe }.
 */
export function setRecipeParsedRecipe(id, parsedRecipe, options = {}) {
  const db = getDb()
  const existing = db.prepare('SELECT id FROM recipes WHERE id = ?').get(Number(id))
  if (!existing) return null

  const inner = parsedRecipe.recipe
  const now = new Date().toISOString().slice(0, 19).replace('T', ' ')
  const titleToSet = (options.updateTitle && inner?.title) ? inner.title.trim() : null

  db.prepare(`
    UPDATE recipes SET
      extract_status = 'done', extract_confidence = ?, extract_warnings = ?, extract_missing_fields = ?,
      title = COALESCE(?, title), subtitle = ?, description = ?, language = ?,
      servings_value = ?, servings_unit_text = ?,
      nutrition_kcal = ?, nutrition_protein = ?, nutrition_carbs = ?, nutrition_fat = ?,
      updated_at = ?
    WHERE id = ?
  `).run(
    parsedRecipe.confidence ?? null,
    JSON.stringify(parsedRecipe.warnings ?? []),
    JSON.stringify(parsedRecipe.missingFields ?? []),
    titleToSet,
    inner?.subtitle ?? null,
    inner?.introText ?? inner?.description ?? null,
    inner?.language ?? null,
    inner?.servings?.value ?? null,
    inner?.servings?.unitText ?? null,
    inner?.nutritionTotal?.kcal ?? null,
    inner?.nutritionTotal?.protein ?? null,
    inner?.nutritionTotal?.carbs ?? null,
    inner?.nutritionTotal?.fat ?? null,
    now,
    Number(id),
  )

  const recipeId = Number(id)
  const sectionIds = db.prepare('SELECT id FROM recipe_ingredient_sections WHERE recipe_id = ?').all(recipeId)
  for (const s of sectionIds) {
    db.prepare('DELETE FROM ingredients WHERE section_id = ?').run(s.id)
  }
  db.prepare('DELETE FROM recipe_ingredient_sections WHERE recipe_id = ?').run(recipeId)
  db.prepare('DELETE FROM recipe_steps WHERE recipe_id = ?').run(recipeId)
  db.prepare('DELETE FROM recipe_tips WHERE recipe_id = ?').run(recipeId)

  if (inner?.ingredientsSections?.length) {
    const insertSection = db.prepare('INSERT INTO recipe_ingredient_sections (recipe_id, position, heading) VALUES (?, ?, ?)')
    const insertIng = db.prepare(`
      INSERT INTO ingredients (section_id, position, original_text, amount, amount_max, unit, ingredient, additional_info) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `)
    inner.ingredientsSections.forEach((sec, si) => {
      insertSection.run(recipeId, si, sec.heading ?? null)
      const sectionId = db.prepare('SELECT last_insert_rowid() as id').get().id
      ;(sec.items ?? []).forEach((item, ii) => {
        insertIng.run(
          sectionId,
          ii,
          item.originalText ?? null,
          item.amount ?? null,
          item.amountMax ?? null,
          item.unit ?? null,
          item.ingredient ?? null,
          item.additionalInfo ?? null
        )
      })
    })
  }

  if (inner?.steps?.length) {
    const insertStep = db.prepare('INSERT INTO recipe_steps (recipe_id, step_number, instruction) VALUES (?, ?, ?)')
    inner.steps.forEach((step, i) => {
      insertStep.run(recipeId, step.index ?? i + 1, (step.text ?? '').trim() || '')
    })
  }

  if (inner?.tips?.length) {
    const insertTip = db.prepare('INSERT INTO recipe_tips (recipe_id, position, text) VALUES (?, ?, ?)')
    inner.tips.forEach((t, i) => {
      insertTip.run(recipeId, i, typeof t === 'string' ? t : '')
    })
  }

  return getRecipeById(id)
}

function rowToRecipe(row) {
  let extract_warnings = null
  let extract_missing_fields = null
  if (row.extract_warnings != null && String(row.extract_warnings).trim() !== '') {
    try {
      extract_warnings = JSON.parse(row.extract_warnings)
    } catch {
      extract_warnings = null
    }
  }
  if (row.extract_missing_fields != null && String(row.extract_missing_fields).trim() !== '') {
    try {
      extract_missing_fields = JSON.parse(row.extract_missing_fields)
    } catch {
      extract_missing_fields = null
    }
  }
  return {
    id: row.id,
    source_id: row.source_id,
    source_page: row.source_page ?? null,
    import_method: row.import_method,
    extract_status: row.extract_status,
    extract_confidence: row.extract_confidence != null ? Number(row.extract_confidence) : null,
    extract_warnings: Array.isArray(extract_warnings) ? extract_warnings : null,
    extract_missing_fields: Array.isArray(extract_missing_fields) ? extract_missing_fields : null,
    status: row.status ?? 'draft',
    title: row.title,
    subtitle: row.subtitle ?? null,
    description: row.description,
    language: row.language ?? null,
    servings: row.servings_value ?? null,
    servings_value: row.servings_value ?? null,
    servings_unit_text: row.servings_unit_text ?? null,
    nutrition_kcal: row.nutrition_kcal != null ? Number(row.nutrition_kcal) : null,
    nutrition_protein: row.nutrition_protein != null ? Number(row.nutrition_protein) : null,
    nutrition_carbs: row.nutrition_carbs != null ? Number(row.nutrition_carbs) : null,
    nutrition_fat: row.nutrition_fat != null ? Number(row.nutrition_fat) : null,
    prep_time_min: row.prep_time_min,
    cook_time_min: row.cook_time_min,
    image_path: row.image_path,
    created_at: row.created_at,
    updated_at: row.updated_at,
  }
}

function sanitizeRecipeInput(body) {
  const allowed = [
    'source_id', 'source_page', 'import_method', 'extract_status', 'status',
    'title', 'subtitle', 'description', 'language', 'servings', 'servings_value', 'servings_unit_text',
    'prep_time_min', 'cook_time_min', 'image_path',
  ]
  const out = {}
  for (const key of allowed) {
    if (body && key in body) out[key] = body[key]
  }
  return out
}
