/**
 * Extract structured recipe from one or more recipe-text images using OpenAI vision.
 * Uses a fixed prompt and JSON schema; logs token usage to extract_usage table.
 */

import OpenAI from 'openai'
import { getDb } from '../db/index.js'

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

/**
 * @param {Buffer[]} imageBuffers - One or more images (recipe text)
 * @returns {Promise<{ recipe: { title: string, introText: string, ingredientsSections: Array<{ heading: string|null, items: string[] }>, steps: string[] }, usage?: { prompt_tokens: number, completion_tokens: number, total_tokens: number } }>}
 */
export async function extractRecipeFromImages(imageBuffers) {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) throw new Error('OPENAI_API_KEY is not set')

  const client = new OpenAI({ apiKey })
  const imageContents = imageBuffers.map((buf) => ({
    type: 'image_url',
    image_url: { 
      url: `data:image/webp;base64,${buf.toString('base64')}`, 
      detail: process.env.OPENAI_EXTRACT_DETAIL || 'high'
    },
  }))

  const response = await client.chat.completions.create({
    model: process.env.OPENAI_EXTRACT_MODEL || 'gpt-4o-mini',
    messages: [
      { role: 'system', content: EXTRACT_PROMPT },
      {
        role: 'user',
        content: [
          { type: 'text', text: 'Extract the recipe from the following image(s). Return valid JSON matching the schema.' },
          ...imageContents,
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

  const choice = response.choices?.[0]
  if (!choice?.message?.content) throw new Error('No content in OpenAI response')
  const recipe = JSON.parse(choice.message.content)
  const usage = response.usage
    ? {
        prompt_tokens: response.usage.prompt_tokens,
        completion_tokens: response.usage.completion_tokens,
        total_tokens: response.usage.total_tokens,
      }
    : undefined
  return { recipe, usage }
}

/**
 * Log token usage for an extract run to extract_usage table.
 */
export function logExtractUsage(recipeId, usage) {
  if (!usage) return
  const db = getDb()
  const now = new Date().toISOString().slice(0, 19).replace('T', ' ')
  db.prepare(`
    INSERT INTO extract_usage (recipe_id, prompt_tokens, completion_tokens, total_tokens, created_at)
    VALUES (?, ?, ?, ?, ?)
  `).run(recipeId, usage.prompt_tokens, usage.completion_tokens, usage.total_tokens, now)
}
