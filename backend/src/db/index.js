import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import Database from 'better-sqlite3'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const dbPath = process.env.DB_PATH || ':memory:'
let db = null

/**
 * Returns the singleton DB instance (lazy init).
 * initDb() should be called before the first use.
 */
export function getDb() {
  if (!db) {
    if (dbPath !== ':memory:') {
      const resolved = path.isAbsolute(dbPath) ? dbPath : path.resolve(process.cwd(), dbPath)
      const dir = path.dirname(resolved)
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
    }
    db = new Database(dbPath)
    db.pragma('foreign_keys = ON')
  }
  return db
}

/**
 * Creates database tables if they do not exist.
 * Safe to call multiple times. DB can be deleted and recreated; this rebuilds schema.
 */
export function initDb() {
  const database = getDb()

  // Before CREATE TABLE IF NOT EXISTS ai_token_usage: migrate legacy extract_usage so we never get two tables.
  try {
    const legacy = database
      .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='extract_usage'")
      .get()
    const modern = database
      .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='ai_token_usage'")
      .get()
    if (legacy && !modern) {
      database.exec('ALTER TABLE extract_usage RENAME TO ai_token_usage')
    }
  } catch (_) {}
  try {
    const ai = database.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='ai_token_usage'").get()
    if (ai) {
      const cols = database.prepare('PRAGMA table_info(ai_token_usage)').all()
      if (cols.some((c) => c.name === 'extract_kind')) {
        database.exec('ALTER TABLE ai_token_usage RENAME COLUMN extract_kind TO usage_kind')
      }
    }
  } catch (_) {}

  database.exec(`
    CREATE TABLE IF NOT EXISTS recipe_sources (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT NOT NULL DEFAULT 'book' CHECK (type IN ('book', 'url', 'manual', 'other')),
      name TEXT NOT NULL,
      subtitle TEXT,
      url TEXT,
      book_title TEXT,
      author TEXT,
      year INTEGER,
      image_path TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS recipes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      source_id INTEGER REFERENCES recipe_sources(id),
      source_page TEXT,
      import_method TEXT NOT NULL DEFAULT 'manual' CHECK (import_method IN ('manual', 'url', 'image')),
      extract_status TEXT CHECK (extract_status IS NULL OR extract_status IN ('pending', 'done', 'failed')),
      extract_confidence REAL,
      extract_warnings TEXT,
      extract_missing_fields TEXT,
      status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'confirmed')),
      favorite INTEGER NOT NULL DEFAULT 0 CHECK (favorite IN (0, 1)),
      would_cook_again TEXT,
      title TEXT NOT NULL,
      subtitle TEXT,
      description TEXT,
      language TEXT,
      servings_value REAL,
      servings_unit_text TEXT,
      nutrition_kcal REAL,
      nutrition_protein REAL,
      nutrition_carbs REAL,
      nutrition_fat REAL,
      prep_time_min INTEGER,
      cook_time_min INTEGER,
      image_path TEXT,
      image_urls_json TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS recipe_ingredient_sections (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      recipe_id INTEGER NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
      position INTEGER NOT NULL DEFAULT 0,
      heading TEXT
    );

    CREATE TABLE IF NOT EXISTS ingredients (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      section_id INTEGER NOT NULL REFERENCES recipe_ingredient_sections(id) ON DELETE CASCADE,
      position INTEGER NOT NULL DEFAULT 0,
      original_text TEXT,
      amount REAL,
      amount_max REAL,
      unit TEXT,
      ingredient TEXT,
      category TEXT,
      additional_info TEXT
    );

    CREATE TABLE IF NOT EXISTS recipe_steps (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      recipe_id INTEGER NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
      step_number INTEGER NOT NULL,
      instruction TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS recipe_tips (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      recipe_id INTEGER NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
      position INTEGER NOT NULL DEFAULT 0,
      text TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS ai_token_usage (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      recipe_id INTEGER REFERENCES recipes(id) ON DELETE SET NULL,
      prompt_tokens INTEGER,
      completion_tokens INTEGER,
      total_tokens INTEGER,
      response_json TEXT,
      request_json TEXT,
      model TEXT,
      usage_kind TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS recipe_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      recipe_id INTEGER NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
      cooked_date TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      UNIQUE(recipe_id, cooked_date)
    );

    CREATE TABLE IF NOT EXISTS recipe_health_scores (
      recipe_id INTEGER PRIMARY KEY REFERENCES recipes(id) ON DELETE CASCADE,
      health_score REAL,
      confidence REAL,
      summary TEXT,
      positives_json TEXT NOT NULL DEFAULT '[]',
      concerns_json TEXT NOT NULL DEFAULT '[]',
      improvement_tips_json TEXT NOT NULL DEFAULT '[]',
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_recipe_ingredient_sections_recipe_id ON recipe_ingredient_sections(recipe_id);
    CREATE INDEX IF NOT EXISTS idx_ingredients_section_id ON ingredients(section_id);
    CREATE INDEX IF NOT EXISTS idx_ingredients_ingredient ON ingredients(ingredient);
    CREATE INDEX IF NOT EXISTS idx_recipe_steps_recipe_id ON recipe_steps(recipe_id);
    CREATE INDEX IF NOT EXISTS idx_recipe_tips_recipe_id ON recipe_tips(recipe_id);
    CREATE INDEX IF NOT EXISTS idx_recipes_source_id ON recipes(source_id);
    CREATE INDEX IF NOT EXISTS idx_ai_token_usage_recipe_id ON ai_token_usage(recipe_id);
    CREATE INDEX IF NOT EXISTS idx_recipe_history_recipe_id ON recipe_history(recipe_id);
  `)

  // Migrations for existing DBs
  const addCol = (table, col, def) => {
    try {
      database.run(`ALTER TABLE ${table} ADD COLUMN ${col} ${def}`)
    } catch (_) {}
  }
  addCol('recipe_sources', 'subtitle', 'TEXT')
  addCol('recipe_sources', 'year', 'INTEGER')
  addCol('recipe_sources', 'image_path', 'TEXT')
  addCol('recipes', 'image_urls_json', 'TEXT')
  addCol('recipes', 'favorite', 'INTEGER DEFAULT 0')
  addCol('recipes', 'would_cook_again', 'TEXT')
  addCol('ingredients', 'category', 'TEXT')

  addCol('ai_token_usage', 'response_json', 'TEXT')
  addCol('ai_token_usage', 'model', 'TEXT')
  addCol('ai_token_usage', 'usage_kind', 'TEXT')
  addCol('ai_token_usage', 'request_json', 'TEXT')

  database.exec(`
    CREATE TABLE IF NOT EXISTS recipe_health_scores (
      recipe_id INTEGER PRIMARY KEY REFERENCES recipes(id) ON DELETE CASCADE,
      health_score REAL,
      confidence REAL,
      summary TEXT,
      positives_json TEXT NOT NULL DEFAULT '[]',
      concerns_json TEXT NOT NULL DEFAULT '[]',
      improvement_tips_json TEXT NOT NULL DEFAULT '[]',
      updated_at TEXT DEFAULT (datetime('now'))
    );
  `)

  try {
    database.exec('CREATE INDEX IF NOT EXISTS idx_ai_token_usage_recipe_id ON ai_token_usage(recipe_id)')
  } catch (_) {}

  try {
    if (database.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='ai_token_usage'").get()) {
      database.run(`UPDATE ai_token_usage SET usage_kind = 'recipe_image_extract' WHERE usage_kind = 'vision'`)
      database.run(`UPDATE ai_token_usage SET usage_kind = 'url_recipe_normalize' WHERE usage_kind = 'url_normalize'`)
    }
  } catch (_) {}

  try {
    const hCols = database.prepare('PRAGMA table_info(recipe_health_scores)').all()
    const names = hCols.map((c) => c.name)
    if (names.includes('model')) {
      database.exec('ALTER TABLE recipe_health_scores DROP COLUMN model')
    }
  } catch (_) {}
  try {
    const hCols = database.prepare('PRAGMA table_info(recipe_health_scores)').all()
    const names = hCols.map((c) => c.name)
    if (names.includes('token_usage_json')) {
      database.exec('ALTER TABLE recipe_health_scores DROP COLUMN token_usage_json')
    }
  } catch (_) {}
  try {
    const hCols = database.prepare('PRAGMA table_info(recipe_health_scores)').all()
    const names = hCols.map((c) => c.name)
    if (names.includes('used_fallback')) {
      database.exec('ALTER TABLE recipe_health_scores DROP COLUMN used_fallback')
    }
  } catch (_) {}
  try {
    const hCols = database.prepare('PRAGMA table_info(recipe_health_scores)').all()
    const names = hCols.map((c) => c.name)
    if (names.includes('warning')) {
      database.exec('ALTER TABLE recipe_health_scores DROP COLUMN warning')
    }
  } catch (_) {}
  try {
    database.exec('DELETE FROM recipe_health_scores WHERE health_score IS NULL')
  } catch (_) {}

  // Ensure new column(s) exist even if ALTER TABLE was ignored.
  // This keeps the server running instead of failing later on "no such column" errors.
  const recipesTableCols = database.prepare('PRAGMA table_info(recipes)').all()
  const hasWouldCookAgain = recipesTableCols.some((c) => c.name === 'would_cook_again')
  if (!hasWouldCookAgain) {
    const existingCols = recipesTableCols.map((c) => c.name).filter((name) => name !== 'would_cook_again')
    try {
      database.pragma('foreign_keys = OFF')
      database.exec(`
        ALTER TABLE recipes RENAME TO recipes_old;
        CREATE TABLE recipes (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          source_id INTEGER REFERENCES recipe_sources(id),
          source_page TEXT,
          import_method TEXT NOT NULL DEFAULT 'manual' CHECK (import_method IN ('manual', 'url', 'image')),
          extract_status TEXT CHECK (extract_status IS NULL OR extract_status IN ('pending', 'done', 'failed')),
          extract_confidence REAL,
          extract_warnings TEXT,
          extract_missing_fields TEXT,
          status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'confirmed')),
          favorite INTEGER NOT NULL DEFAULT 0 CHECK (favorite IN (0, 1)),
          would_cook_again TEXT,
          title TEXT NOT NULL,
          subtitle TEXT,
          description TEXT,
          language TEXT,
          servings_value REAL,
          servings_unit_text TEXT,
          nutrition_kcal REAL,
          nutrition_protein REAL,
          nutrition_carbs REAL,
          nutrition_fat REAL,
          prep_time_min INTEGER,
          cook_time_min INTEGER,
          image_path TEXT,
          image_urls_json TEXT,
          created_at TEXT DEFAULT (datetime('now')),
          updated_at TEXT DEFAULT (datetime('now'))
        );
        INSERT INTO recipes (${existingCols.join(', ')})
          SELECT ${existingCols.join(', ')} FROM recipes_old;
        DROP TABLE recipes_old;
      `)
      database.pragma('foreign_keys = ON')

      database.exec(`
        CREATE INDEX IF NOT EXISTS idx_recipes_source_id ON recipes(source_id);
      `)
    } catch (_) {
      // Leave DB as-is; the server may fail if the column is still missing.
    }
  }

  const ingredientsTableCols = database.prepare('PRAGMA table_info(ingredients)').all()
  const hasIngredientCategory = ingredientsTableCols.some((c) => c.name === 'category')
  if (!hasIngredientCategory && ingredientsTableCols.length) {
    const existingCols = ingredientsTableCols.map((c) => c.name).filter((name) => name !== 'category')
    try {
      database.pragma('foreign_keys = OFF')
      database.exec(`
        ALTER TABLE ingredients RENAME TO ingredients_old;
        CREATE TABLE ingredients (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          section_id INTEGER NOT NULL REFERENCES recipe_ingredient_sections(id) ON DELETE CASCADE,
          position INTEGER NOT NULL DEFAULT 0,
          original_text TEXT,
          amount REAL,
          amount_max REAL,
          unit TEXT,
          ingredient TEXT,
          category TEXT,
          additional_info TEXT
        );
        INSERT INTO ingredients (${existingCols.join(', ')})
          SELECT ${existingCols.join(', ')} FROM ingredients_old;
        DROP TABLE ingredients_old;
      `)
      database.pragma('foreign_keys = ON')
      database.exec(`
        CREATE INDEX IF NOT EXISTS idx_ingredients_section_id ON ingredients(section_id);
        CREATE INDEX IF NOT EXISTS idx_ingredients_ingredient ON ingredients(ingredient);
      `)
    } catch (_) {
      // Leave DB as-is; the server may fail if the column is still missing.
    }
  }

  // One-time migration: if old recipe schema (parsed_recipe_json, ingredients.name) exists, replace with RECIPE_JSON_SCHEMA-aligned schema
  const tableInfo = database.prepare('PRAGMA table_info(recipes)').all()
  const hasOldSchema = tableInfo.some((c) => c.name === 'parsed_recipe_json')
  if (hasOldSchema) {
    database.exec(`
      DROP TABLE IF EXISTS extract_usage;
      DROP TABLE IF EXISTS ai_token_usage;
      DROP TABLE IF EXISTS recipe_tips;
      DROP TABLE IF EXISTS ingredients;
      DROP TABLE IF EXISTS recipe_steps;
      DROP TABLE IF EXISTS recipe_ingredient_sections;
      DROP TABLE IF EXISTS recipes;
    `)
    database.exec(`
      CREATE TABLE recipes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        source_id INTEGER REFERENCES recipe_sources(id),
        source_page TEXT,
        import_method TEXT NOT NULL DEFAULT 'manual' CHECK (import_method IN ('manual', 'url', 'image')),
        extract_status TEXT CHECK (extract_status IS NULL OR extract_status IN ('pending', 'done', 'failed')),
        extract_confidence REAL,
        extract_warnings TEXT,
        extract_missing_fields TEXT,
        status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'confirmed')),
        favorite INTEGER NOT NULL DEFAULT 0 CHECK (favorite IN (0, 1)),
        would_cook_again TEXT,
        title TEXT NOT NULL,
        subtitle TEXT,
        description TEXT,
        language TEXT,
        servings_value REAL,
        servings_unit_text TEXT,
        nutrition_kcal REAL,
        nutrition_protein REAL,
        nutrition_carbs REAL,
        nutrition_fat REAL,
        prep_time_min INTEGER,
        cook_time_min INTEGER,
        image_path TEXT,
        image_urls_json TEXT,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now'))
      );
      CREATE TABLE recipe_ingredient_sections (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        recipe_id INTEGER NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
        position INTEGER NOT NULL DEFAULT 0,
        heading TEXT
      );
      CREATE TABLE ingredients (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        section_id INTEGER NOT NULL REFERENCES recipe_ingredient_sections(id) ON DELETE CASCADE,
        position INTEGER NOT NULL DEFAULT 0,
        original_text TEXT,
        amount REAL,
        amount_max REAL,
        unit TEXT,
        ingredient TEXT,
        category TEXT,
        additional_info TEXT
      );
      CREATE TABLE recipe_steps (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        recipe_id INTEGER NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
        step_number INTEGER NOT NULL,
        instruction TEXT NOT NULL
      );
      CREATE TABLE recipe_tips (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        recipe_id INTEGER NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
        position INTEGER NOT NULL DEFAULT 0,
        text TEXT NOT NULL
      );
      CREATE TABLE ai_token_usage (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        recipe_id INTEGER REFERENCES recipes(id) ON DELETE SET NULL,
        prompt_tokens INTEGER,
        completion_tokens INTEGER,
        total_tokens INTEGER,
        response_json TEXT,
        request_json TEXT,
        model TEXT,
        usage_kind TEXT,
        created_at TEXT DEFAULT (datetime('now'))
      );
      CREATE TABLE recipe_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        recipe_id INTEGER NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
        cooked_date TEXT NOT NULL,
        created_at TEXT DEFAULT (datetime('now')),
        UNIQUE(recipe_id, cooked_date)
      );
      CREATE TABLE recipe_health_scores (
        recipe_id INTEGER PRIMARY KEY REFERENCES recipes(id) ON DELETE CASCADE,
        health_score REAL,
        confidence REAL,
        summary TEXT,
        positives_json TEXT NOT NULL DEFAULT '[]',
        concerns_json TEXT NOT NULL DEFAULT '[]',
        improvement_tips_json TEXT NOT NULL DEFAULT '[]',
        updated_at TEXT DEFAULT (datetime('now'))
      );
      CREATE INDEX IF NOT EXISTS idx_recipe_ingredient_sections_recipe_id ON recipe_ingredient_sections(recipe_id);
      CREATE INDEX IF NOT EXISTS idx_ingredients_section_id ON ingredients(section_id);
      CREATE INDEX IF NOT EXISTS idx_ingredients_ingredient ON ingredients(ingredient);
      CREATE INDEX IF NOT EXISTS idx_recipe_steps_recipe_id ON recipe_steps(recipe_id);
      CREATE INDEX IF NOT EXISTS idx_recipe_tips_recipe_id ON recipe_tips(recipe_id);
      CREATE INDEX IF NOT EXISTS idx_recipes_source_id ON recipes(source_id);
      CREATE INDEX IF NOT EXISTS idx_ai_token_usage_recipe_id ON ai_token_usage(recipe_id);
      CREATE INDEX IF NOT EXISTS idx_recipe_history_recipe_id ON recipe_history(recipe_id);
    `)
  }
}

export { dbPath }
export default { getDb, initDb, dbPath }
