#!/usr/bin/env node
/**
 * Ensures release identifiers stay aligned.
 * Home Assistant pulls: ghcr.io/.../recipe-library:<config.yaml version>
 * So frontend/backend package.json versions must match recipe-library/config.yaml.
 */
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

function configVersion() {
  const raw = readFileSync(join(root, 'recipe-library/config.yaml'), 'utf-8')
  const match = raw.match(/^version:\s*"([^"]+)"/m)
  if (!match) {
    throw new Error('Could not parse version from recipe-library/config.yaml')
  }
  return match[1]
}

function packageVersion(relPath) {
  const pkg = JSON.parse(readFileSync(join(root, relPath), 'utf-8'))
  if (!pkg.version) {
    throw new Error(`${relPath} is missing version`)
  }
  return pkg.version
}

const addon = configVersion()
const frontend = packageVersion('frontend/package.json')
const backend = packageVersion('backend/package.json')

const mismatches = []
if (addon !== frontend) {
  mismatches.push(`frontend/package.json=${frontend}`)
}
if (addon !== backend) {
  mismatches.push(`backend/package.json=${backend}`)
}

if (mismatches.length) {
  console.error(`Version mismatch: recipe-library/config.yaml=${addon}`)
  for (const line of mismatches) {
    console.error(`  ${line}`)
  }
  console.error(
    'Home Assistant installs ghcr.io/nikolausstoll/recipe-library:<config version>.'
  )
  console.error('Bump config.yaml, frontend/package.json, and backend/package.json together.')
  process.exit(1)
}

console.log(`Version sync OK: ${addon}`)
