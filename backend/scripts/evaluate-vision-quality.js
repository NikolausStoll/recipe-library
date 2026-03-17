#!/usr/bin/env node
/**
 * Evaluate OpenAI vision quality: send one image to several model/detail configs.
 * Uses same prompt and schema as extractRecipeService (status, confidence, recipe with ingredientsSections, steps, etc.).
 * Outputs structured recipe and token usage per config.
 *
 * Usage: node scripts/evaluate-vision-quality.js <path-to-image>
 *        npm run evaluate-vision -- <path-to-image>
 *
 * Requires OPENAI_API_KEY in env (e.g. from .env in project root).
 */

import dotenv from 'dotenv'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import OpenAI from 'openai'
import { EXTRACT_PROMPT, RECIPE_JSON_SCHEMA } from '../src/services/extractRecipeService.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
// .env can be in backend/ or project root (parent of backend)
dotenv.config({ path: path.resolve(__dirname, '..', '.env') })
dotenv.config({ path: path.resolve(__dirname, '../..', '.env') })

const imagePath = process.argv[2]
if (!imagePath) {
  console.error('Usage: node scripts/evaluate-vision-quality.js <path-to-image>')
  process.exit(1)
}

const resolvedPath = path.isAbsolute(imagePath) ? imagePath : path.resolve(process.cwd(), imagePath)
if (!fs.existsSync(resolvedPath)) {
  console.error('File not found:', resolvedPath)
  process.exit(1)
}

const imageBuffer = fs.readFileSync(resolvedPath)
const base64 = imageBuffer.toString('base64')
const mime = resolvedPath.toLowerCase().endsWith('.png') ? 'image/png' : 'image/jpeg'
const dataUrl = `data:${mime};base64,${base64}`

function formatItem(item) {
  if (typeof item === 'string') return item
  if (item?.originalText?.trim()) return item.originalText.trim()
  const parts = [item?.amount != null ? String(item.amount) : '', item?.unit ?? '', item?.ingredient ?? '', item?.additionalInfo ?? ''].filter(Boolean)
  return parts.join(' ').trim() || '—'
}

function formatStep(step) {
  if (typeof step === 'string') return step
  return step?.text?.trim() ?? '—'
}

const CONFIGS = [
  { label: '4o-mini (detail: low)', model: 'gpt-4o-mini', detail: 'low' },
  { label: '4.1-mini (detail: low)', model: 'gpt-4.1-mini', detail: 'low' },
  { label: '4.1-mini (detail: high)', model: 'gpt-4.1-mini', detail: 'high' },
]

async function run() {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    console.error('OPENAI_API_KEY is not set')
    process.exit(1)
  }

  const client = new OpenAI({ apiKey })
  console.log('Image:', resolvedPath)
  console.log('Size:', Math.round(imageBuffer.length / 1024), 'KB\n')
  console.log('---\n')

  for (const config of CONFIGS) {
    console.log('##', config.label)
    try {
      const response = await client.chat.completions.create({
        model: config.model,
        messages: [
          { role: 'system', content: EXTRACT_PROMPT },
          {
            role: 'user',
            content: [
              { type: 'text', text: 'Extract the recipe from this image. Return valid JSON matching the schema.' },
              {
                type: 'image_url',
                image_url: { url: dataUrl, detail: config.detail },
              },
            ],
          },
        ],
        response_format: {
          type: 'json_schema',
          json_schema: {
            name: 'recipe',
            strict: true,
            schema: RECIPE_JSON_SCHEMA,
          },
        },
      })

      const content = response.choices?.[0]?.message?.content
      const usage = response.usage

      if (!content) {
        console.log('(Keine Antwort)\n')
        continue
      }

      const data = JSON.parse(content)
      const recipe = data.recipe ?? null
      console.log('Status:', data.status ?? '?', 'Confidence:', data.confidence ?? '?')
      if (data.warnings?.length) console.log('Warnings:', data.warnings.join('; '))
      if (data.missingFields?.length) console.log('Missing:', data.missingFields.join('; '))
      if (!recipe) {
        console.log('Recipe: (null)')
      } else {
        console.log('Title:', recipe.title || '(leer)')
        console.log('Intro:', recipe.introText || '(leer)')
        console.log('Ingredients:')
        for (const section of recipe.ingredientsSections ?? []) {
          if (section.heading) console.log('  ', section.heading)
          for (const item of section.items ?? []) console.log('    -', formatItem(item))
        }
        console.log('Steps:')
        for (let i = 0; i < (recipe.steps?.length ?? 0); i++) {
          console.log(`  ${i + 1}.`, formatStep(recipe.steps[i]))
        }
      }

      if (usage) {
        console.log(
          '\nToken:',
          'Prompt =',
          usage.prompt_tokens,
          ', Completion =',
          usage.completion_tokens,
          ', Total =',
          usage.total_tokens
        )
      }
      console.log('\n---\n')
    } catch (err) {
      console.error('Fehler:', err.message)
      if (err.message?.includes('model')) console.error('  (Modell-Name ggf. anpassen, z.B. gpt-4.1-mini)')
      console.log('\n---\n')
    }
  }
}

run()
