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
      status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'confirmed')),
      title TEXT NOT NULL,
      description TEXT,
      servings INTEGER,
      prep_time_min INTEGER,
      cook_time_min INTEGER,
      image_path TEXT,
      parsed_recipe_json TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS ingredients (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      recipe_id INTEGER NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
      position INTEGER NOT NULL DEFAULT 0,
      amount TEXT,
      unit TEXT,
      name TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS recipe_steps (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      recipe_id INTEGER NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
      step_number INTEGER NOT NULL,
      instruction TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS extract_usage (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      recipe_id INTEGER REFERENCES recipes(id) ON DELETE SET NULL,
      prompt_tokens INTEGER,
      completion_tokens INTEGER,
      total_tokens INTEGER,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_ingredients_recipe_id ON ingredients(recipe_id);
    CREATE INDEX IF NOT EXISTS idx_recipe_steps_recipe_id ON recipe_steps(recipe_id);
    CREATE INDEX IF NOT EXISTS idx_recipes_source_id ON recipes(source_id);
    CREATE INDEX IF NOT EXISTS idx_extract_usage_recipe_id ON extract_usage(recipe_id);
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
  addCol('recipes', 'source_page', 'TEXT')

  const dropCol = (table, col) => {
    try {
      database.run(`ALTER TABLE ${table} DROP COLUMN ${col}`)
    } catch (_) {}
  }
  dropCol('recipe_sources', 'page')
  dropCol('recipe_sources', 'publisher')
  dropCol('recipe_sources', 'edition')
  dropCol('recipe_sources', 'source_note')
  dropCol('recipes', 'source_type')
}

export { dbPath }
export default { getDb, initDb, dbPath }
