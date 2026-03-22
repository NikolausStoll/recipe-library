import fs from 'fs'
import { spawn } from 'child_process'

const OPTIONS_FILE = '/data/options.json'
let fileOptions = {}

if (fs.existsSync(OPTIONS_FILE)) {
  try {
    const raw = fs.readFileSync(OPTIONS_FILE, 'utf-8')
    fileOptions = JSON.parse(raw || '{}')
  } catch (error) {
    console.error('Failed to parse options.json:', error)
  }
}

/**
 * Home Assistant add-on: options.json keys override process.env; then defaults.
 * Keys mirror recipe-library/config.yaml `options` (snake_case).
 */
const resolveSetting = (envName, fallback, keys = []) => {
  for (const key of keys) {
    if (Object.prototype.hasOwnProperty.call(fileOptions, key)) {
      return fileOptions[key]
    }
  }
  return process.env[envName] ?? fallback
}

/** [envVar, optionKeys[], default] — matches .env.example / config.yaml defaults */
const OPTION_MAP = [
  ['PORT', ['port'], '8097'],
  ['DB_PATH', ['db_path', 'dbPath'], '/data/recipe-library.db'],
  ['STATIC_DIR', ['static_dir', 'staticDir'], '/app/public'],
  ['UPLOAD_DIR', ['upload_dir', 'uploadDir'], '/data/uploads'],
  ['IMAGE_QUALITY', ['image_quality'], '80'],
  ['IMAGE_MAX_DIMENSION', ['image_max_dimension'], '2400'],
  ['TEXT_IMAGE_MAX_DIMENSION', ['text_image_max_dimension'], '1400'],
  ['THUMBNAIL_MAX_DIMENSION', ['thumbnail_max_dimension'], '600'],
  ['RECIPE_URL_FETCH_TIMEOUT_MS', ['recipe_url_fetch_timeout_ms'], '25000'],
  ['RECIPE_URL_MAX_BYTES', ['recipe_url_max_bytes'], '2000000'],
  ['RECIPE_URL_USER_AGENT', ['recipe_url_user_agent'], 'RecipeLibrary/1.0'],
  ['OPENAI_API_KEY', ['openai_api_key'], ''],
  ['OPENAI_EXTRACT_MODEL', ['openai_extract_model'], 'gpt-4.1-mini'],
  ['OPENAI_EXTRACT_DETAIL', ['openai_extract_detail'], 'high'],
  ['OPENAI_NORMALIZE_MODEL_PRIMARY', ['openai_normalize_model_primary'], 'gpt-4o-mini'],
  ['OPENAI_NORMALIZE_TEMPERATURE', ['openai_normalize_temperature'], '0.2'],
  ['OPENAI_NUTRITION_MODEL', ['openai_nutrition_model'], 'gpt-4o-mini'],
  ['OPENAI_NUTRITION_MODEL_TEMPERATURE', ['openai_nutrition_model_temperature'], '0.2'],
  ['OPENAI_HEALTH_SCORE_MODEL', ['openai_health_score_model'], 'gpt-4o-mini'],
  ['OPENAI_HEALTH_SCORE_TEMPERATURE', ['openai_health_score_temperature'], '0.2'],
  ['OPENAI_TIME_ESTIMATE_MODEL', ['openai_time_estimate_model'], 'gpt-4o-mini'],
  ['OPENAI_TIME_ESTIMATE_TEMPERATURE', ['openai_time_estimate_temperature'], '0.2'],
  ['OPENAI_RECIPE_TAG_MODEL', ['openai_recipe_tag_model'], 'gpt-4o-mini'],
  ['OPENAI_RECIPE_TAG_TEMPERATURE', ['openai_recipe_tag_temperature'], '0.2'],
]

for (const [envName, keys, fallback] of OPTION_MAP) {
  const v = resolveSetting(envName, fallback, keys)
  process.env[envName] = v != null ? String(v) : ''
}

const backend = spawn('node', ['backend/src/server.js'], { stdio: 'inherit' })

backend.on('exit', (code) => {
  process.exit(code ?? 0)
})

backend.on('error', (err) => {
  console.error('Failed to start backend:', err)
  process.exit(1)
})
