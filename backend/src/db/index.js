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

    CREATE TABLE IF NOT EXISTS extract_usage (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      recipe_id INTEGER REFERENCES recipes(id) ON DELETE SET NULL,
      prompt_tokens INTEGER,
      completion_tokens INTEGER,
      total_tokens INTEGER,
      response_json TEXT,
      request_json TEXT,
      model TEXT,
      extract_kind TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS recipe_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      recipe_id INTEGER NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
      cooked_date TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      UNIQUE(recipe_id, cooked_date)
    );

    CREATE INDEX IF NOT EXISTS idx_recipe_ingredient_sections_recipe_id ON recipe_ingredient_sections(recipe_id);
    CREATE INDEX IF NOT EXISTS idx_ingredients_section_id ON ingredients(section_id);
    CREATE INDEX IF NOT EXISTS idx_ingredients_ingredient ON ingredients(ingredient);
    CREATE INDEX IF NOT EXISTS idx_recipe_steps_recipe_id ON recipe_steps(recipe_id);
    CREATE INDEX IF NOT EXISTS idx_recipe_tips_recipe_id ON recipe_tips(recipe_id);
    CREATE INDEX IF NOT EXISTS idx_recipes_source_id ON recipes(source_id);
    CREATE INDEX IF NOT EXISTS idx_extract_usage_recipe_id ON extract_usage(recipe_id);
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
  addCol('extract_usage', 'response_json', 'TEXT')
  addCol('extract_usage', 'model', 'TEXT')
  addCol('extract_usage', 'extract_kind', 'TEXT')
  addCol('extract_usage', 'request_json', 'TEXT')

  // One-time migration: if old recipe schema (parsed_recipe_json, ingredients.name) exists, replace with RECIPE_JSON_SCHEMA-aligned schema
  const tableInfo = database.prepare('PRAGMA table_info(recipes)').all()
  const hasOldSchema = tableInfo.some((c) => c.name === 'parsed_recipe_json')
  if (hasOldSchema) {
    database.exec(`
      DROP TABLE IF EXISTS extract_usage;
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
      CREATE TABLE extract_usage (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        recipe_id INTEGER REFERENCES recipes(id) ON DELETE SET NULL,
        prompt_tokens INTEGER,
        completion_tokens INTEGER,
        total_tokens INTEGER,
        response_json TEXT,
        request_json TEXT,
        model TEXT,
        extract_kind TEXT,
        created_at TEXT DEFAULT (datetime('now'))
      );
      CREATE TABLE recipe_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        recipe_id INTEGER NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
        cooked_date TEXT NOT NULL,
        created_at TEXT DEFAULT (datetime('now')),
        UNIQUE(recipe_id, cooked_date)
      );
      CREATE INDEX IF NOT EXISTS idx_recipe_ingredient_sections_recipe_id ON recipe_ingredient_sections(recipe_id);
      CREATE INDEX IF NOT EXISTS idx_ingredients_section_id ON ingredients(section_id);
      CREATE INDEX IF NOT EXISTS idx_ingredients_ingredient ON ingredients(ingredient);
      CREATE INDEX IF NOT EXISTS idx_recipe_steps_recipe_id ON recipe_steps(recipe_id);
      CREATE INDEX IF NOT EXISTS idx_recipe_tips_recipe_id ON recipe_tips(recipe_id);
      CREATE INDEX IF NOT EXISTS idx_recipes_source_id ON recipes(source_id);
      CREATE INDEX IF NOT EXISTS idx_extract_usage_recipe_id ON extract_usage(recipe_id);
      CREATE INDEX IF NOT EXISTS idx_recipe_history_recipe_id ON recipe_history(recipe_id);
    `)
  }
}

export { dbPath }
export default { getDb, initDb, dbPath }
