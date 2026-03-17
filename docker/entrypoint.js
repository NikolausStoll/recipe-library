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

const resolveSetting = (envName, fallback, keys = []) => {
  for (const key of keys) {
    if (fileOptions[key] != null) {
      return fileOptions[key]
    }
  }
  return process.env[envName] ?? fallback
}

const port = resolveSetting('PORT', '8097', ['port'])
const dbPath = resolveSetting('DB_PATH', '/data/recipe-library.db', ['db_path', 'dbPath'])
const staticDir = resolveSetting('STATIC_DIR', '/app/public', ['static_dir', 'staticDir'])

process.env.PORT = String(port)
process.env.DB_PATH = String(dbPath)
process.env.STATIC_DIR = String(staticDir)

const backend = spawn('node', ['backend/src/server.js'], { stdio: 'inherit' })

backend.on('exit', code => {
  process.exit(code ?? 0)
})

backend.on('error', err => {
  console.error('Failed to start backend:', err)
  process.exit(1)
})
