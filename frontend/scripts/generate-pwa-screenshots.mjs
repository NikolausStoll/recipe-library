/**
 * One-off helper: generate PWA install screenshots with correct pixel dimensions.
 * Run from repo root: node frontend/scripts/generate-pwa-screenshots.mjs
 */
import sharp from 'sharp'
import { mkdir } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const outDir = join(__dirname, '../public/screenshots')

const MOBILE = { width: 390, height: 844, label: 'Mobile' }
const DESKTOP = { width: 1280, height: 720, label: 'Desktop' }

function screenshotSvg(width, height, label) {
  const titleY = Math.round(height * 0.38)
  const subY = titleY + 48
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#f7f6f4"/>
      <stop offset="100%" stop-color="#eeeeff"/>
    </linearGradient>
  </defs>
  <rect width="100%" height="100%" fill="url(#bg)"/>
  <rect x="${width * 0.08}" y="${height * 0.12}" width="${width * 0.84}" height="${height * 0.2}" rx="12" fill="#ffffff" stroke="#e2e4ea"/>
  <text x="50%" y="${titleY}" text-anchor="middle" font-family="system-ui,sans-serif" font-size="${Math.round(width * 0.07)}" font-weight="600" fill="#1d1f25">Recipe Library</text>
  <text x="50%" y="${subY}" text-anchor="middle" font-family="system-ui,sans-serif" font-size="${Math.round(width * 0.035)}" fill="#6f7583">${label} preview</text>
  <rect x="${width * 0.08}" y="${height * 0.38}" width="${width * 0.84}" height="${height * 0.48}" rx="14" fill="#ffffff" stroke="#e2e4ea"/>
  <circle cx="${width * 0.2}" cy="${height * 0.52}" r="${Math.min(width, height) * 0.06}" fill="#5f5ce6" opacity="0.2"/>
  <rect x="${width * 0.32}" y="${height * 0.48}" width="${width * 0.5}" height="12" rx="6" fill="#e2e4ea"/>
  <rect x="${width * 0.32}" y="${height * 0.54}" width="${width * 0.38}" height="10" rx="5" fill="#e2e4ea"/>
  <rect x="${width * 0.32}" y="${height * 0.62}" width="${width * 0.42}" height="10" rx="5" fill="#e2e4ea"/>
</svg>`
}

async function writeScreenshot({ width, height, label }, filename) {
  const svg = screenshotSvg(width, height, label)
  await sharp(Buffer.from(svg)).png().toFile(join(outDir, filename))
  console.log(`Wrote ${filename} (${width}x${height})`)
}

await mkdir(outDir, { recursive: true })
await writeScreenshot(MOBILE, 'mobile.png')
await writeScreenshot(DESKTOP, 'desktop.png')
