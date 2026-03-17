import './load-env.js'
import express from 'express'
import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'

import { initDb } from './db/index.js'
import apiRoutes from './routes/index.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const app = express()
const PORT = Number(process.env.PORT || process.env.BACKEND_PORT) || 8097
const STATIC_DIR = process.env.STATIC_DIR
const UPLOAD_DIR = process.env.UPLOAD_DIR || path.resolve(process.cwd(), 'data', 'uploads')

app.set('port', PORT)
app.use(express.json())

// CORS for local dev (frontend on different port)
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  if (req.method === 'OPTIONS') return res.sendStatus(204)
  next()
})

// API routes (e.g. /api/health, /api/upload)
app.use('/api', apiRoutes)

// Uploaded images (WebP) under /uploads
if (!path.isAbsolute(UPLOAD_DIR)) {
  const resolved = path.resolve(process.cwd(), UPLOAD_DIR)
  if (!fs.existsSync(resolved)) fs.mkdirSync(resolved, { recursive: true })
  app.use('/uploads', express.static(resolved))
} else {
  if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true })
  app.use('/uploads', express.static(UPLOAD_DIR))
}

// Static files (built frontend) in production
if (STATIC_DIR) {
  const staticPath = path.isAbsolute(STATIC_DIR) ? STATIC_DIR : path.resolve(process.cwd(), STATIC_DIR)
  app.use(express.static(staticPath))
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api') || req.path.startsWith('/uploads')) return next()
    res.sendFile(path.join(staticPath, 'index.html'), (err) => {
      if (err) next()
    })
  })
}

initDb()

app.listen(PORT, () => {
  console.log(`Backend listening on http://localhost:${PORT}`)
  if (process.env.DB_PATH) console.log(`DB_PATH: ${process.env.DB_PATH}`)
  if (STATIC_DIR) console.log(`Serving static from: ${STATIC_DIR}`)
})
