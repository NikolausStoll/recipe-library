/**
 * Loads .env from project root and backend/ (independent of process cwd).
 * Must be imported first so DB_PATH etc. are set before db/index.js runs.
 */
import dotenv from 'dotenv'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const backendDir = path.resolve(__dirname, '..')
const rootDir = path.resolve(backendDir, '..')

dotenv.config({ path: path.join(rootDir, '.env') })
dotenv.config({ path: path.join(backendDir, '.env') })
