import { spawn } from 'child_process'
import path from 'path'
import fs from 'fs'
import os from 'os'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const BACKEND_DIR = path.join(__dirname, '..', '..')
const CROP_SCRIPT = path.join(BACKEND_DIR, 'scripts', 'crop_perspective.py')
const VENV_PYTHON = path.join(BACKEND_DIR, 'venv', 'bin', 'python3')

/**
 * Run perspective crop: input image + 4 points → Python script → overwrite output.
 *
 * Example Node → Python call with child_process:
 *   const python = 'python3'
 *   const args = [CROP_SCRIPT, inputPath, outputPath, x1, y1, x2, y2, x3, y3, x4, y4]
 *   spawn(python, args, { stdio: ['pipe', 'pipe', 'pipe'] })
 * CLI: python crop_perspective.py input.jpg output.jpg x1 y1 x2 y2 x3 y3 x4 y4
 * @param {string} inputPath - absolute path to image file
 * @param {string} outputPath - absolute path (can be same as input to overwrite)
 * @param {Array<{x: number, y: number}>} points - exactly 4 points in image coordinates
 * @returns {Promise<void>} - rejects on script error or non-zero exit
 */
export function cropPerspective(inputPath, outputPath, points) {
  if (!Array.isArray(points) || points.length !== 4) {
    return Promise.reject(new Error('Exactly 4 points (x,y) required'))
  }
  const flat = points.flatMap((p) => [Number(p.x), Number(p.y)])
  if (flat.some((n) => Number.isNaN(n))) {
    return Promise.reject(new Error('Invalid point coordinates'))
  }
  const python = process.env.CROP_PYTHON || (fs.existsSync(VENV_PYTHON) ? VENV_PYTHON : 'python3')
  const args = [CROP_SCRIPT, inputPath, outputPath, ...flat.map(String)]
  return new Promise((resolve, reject) => {
    const child = spawn(python, args, { stdio: ['pipe', 'pipe', 'pipe'] })
    let stderr = ''
    child.stderr.on('data', (chunk) => {
      stderr += chunk
      process.stderr.write(chunk)
    })
    child.on('error', (err) => reject(err))
    child.on('close', (code) => {
      if (code === 0) return resolve()
      reject(new Error(`crop_perspective.py exited with ${code}: ${stderr.trim() || 'unknown error'}`))
    })
  })
}

/**
 * Crop perspective from a buffer (e.g. in-memory image). Uses temp files, returns cropped buffer.
 * @param {Buffer} buffer - image bytes
 * @param {Array<{x: number, y: number}>} points - exactly 4 points in image coordinates
 * @param {string} [ext='jpg'] - input file extension for OpenCV (e.g. 'jpg', 'png', 'webp')
 * @returns {Promise<Buffer>} - cropped image as PNG buffer
 */
export async function cropPerspectiveBuffer(buffer, points, ext = 'jpg') {
  if (!Array.isArray(points) || points.length !== 4) {
    throw new Error('Exactly 4 points (x,y) required')
  }
  const tmpDir = os.tmpdir()
  const prefix = `crop-${Date.now()}-${Math.random().toString(36).slice(2, 8)}-`
  const inputPath = path.join(tmpDir, `${prefix}in.${ext.replace(/^\./, '')}`)
  const outputPath = path.join(tmpDir, `${prefix}out.png`)
  await fs.promises.writeFile(inputPath, buffer)
  try {
    await cropPerspective(inputPath, outputPath, points)
    const out = await fs.promises.readFile(outputPath)
    return out
  } finally {
    await fs.promises.unlink(inputPath).catch(() => {})
    await fs.promises.unlink(outputPath).catch(() => {})
  }
}
