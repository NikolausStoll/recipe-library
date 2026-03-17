#!/usr/bin/env node
/**
 * Evaluate OpenAI vision quality: send one image to several model/detail configs.
 * Uses same prompt and schema as extractRecipeService (title, introText, ingredientsSections, steps).
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

const EXTRACT_PROMPT = `You are a recipe extractor. The user will provide one or more images containing recipe text (e.g. from a book, screenshot, or photo of a recipe).

Extract the recipe strictly into the following structure:
- title: The recipe title (one short line).
- introText: Any introduction or description before the ingredients list (can be empty string).
- ingredientsSections: An array of sections. Each section has:
  - heading: Optional section heading (e.g. "For the dough", "Sauce") or null for the main list.
  - items: Array of strings, each one ingredient line (amount, unit, name or free text).
- steps: Array of strings, each one preparation step in order.

Use the exact keys above. If the image has multiple pages, merge the content into one coherent recipe. Preserve the original language of the recipe.`

const RECIPE_JSON_SCHEMA = {
  type: 'object',
  properties: {
    title: { type: 'string', description: 'Recipe title' },
    introText: { type: 'string', description: 'Introduction or description before ingredients' },
    ingredientsSections: {
      type: 'array',
      description: 'Ingredient sections (main list and optional sub-sections)',
      items: {
        type: 'object',
        properties: {
          heading: { type: ['string', 'null'], description: 'Section heading or null' },
          items: {
            type: 'array',
            items: { type: 'string' },
            description: 'Ingredient lines',
          },
        },
        required: ['heading', 'items'],
        additionalProperties: false,
      },
    },
    steps: {
      type: 'array',
      items: { type: 'string' },
      description: 'Preparation steps in order',
    },
  },
  required: ['title', 'introText', 'ingredientsSections', 'steps'],
  additionalProperties: false,
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
      console.log('Title:', data.title || '(leer)')
      console.log('Intro:', data.introText || '(leer)')
      console.log('Ingredients:')
      for (const section of data.ingredientsSections ?? []) {
        if (section.heading) console.log('  ', section.heading)
        for (const item of section.items ?? []) console.log('    -', item)
      }
      console.log('Steps:')
      for (let i = 0; i < (data.steps?.length ?? 0); i++) {
        console.log(`  ${i + 1}.`, data.steps[i])
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
