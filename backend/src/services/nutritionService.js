import OpenAI from 'openai'
import { getDb } from '../db/index.js'
import { getRecipeById } from './recipeService.js'

const NUTRITION_PROMPT = `Estimate nutrition for the full recipe and return JSON only.

Rules:
- Use realistic household cooking assumptions.
- Prefer a plausible mid-range estimate, not a low/conservative estimate.
- Use the first/main ingredient when alternatives are listed.
- If an amount is a range, use the midpoint.
- Ignore water, salt, and negligible spices unless they materially affect nutrition.
- Use structured ingredient fields as primary input.
- Use originalText only to clarify ambiguous cases.
- Do not invent missing ingredient amounts.
- If data is incomplete, return the best reasonable estimate and mention uncertainty in notes.
- Treat ingredient amounts as raw/uncooked unless the ingredient or originalText explicitly states a cooked/prepared form.
- For pasta, rice, grains, legumes, and potatoes, assume weights are raw/uncooked unless explicitly stated otherwise.
- Never substitute cooked nutrition values for raw/uncooked starches.
- Do not reduce kcal or carbs because an ingredient absorbs water during cooking.
- Use realistic household conversions for spoon/cup units.
- Use a quick plausibility check on major calorie sources before returning the result.

Output:
- Round kcal to whole numbers.
- Round protein_g, carbs_g, and fat_g to 1 decimal place.
- Return JSON only.`

const NUTRITION_JSON_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['estimated', 'nutritionTotal', 'notes'],
  properties: {
    estimated: { type: 'boolean' },
    nutritionTotal: {
      type: ['object', 'null'],
      additionalProperties: false,
      required: ['kcal', 'protein_g', 'carbs_g', 'fat_g'],
      properties: {
        kcal: { type: ['number', 'null'] },
        protein_g: { type: ['number', 'null'] },
        carbs_g: { type: ['number', 'null'] },
        fat_g: { type: ['number', 'null'] },
      },
    },
    notes: { type: 'array', items: { type: 'string' } },
  },
}

const DEFAULT_MODEL = 'gpt-4o-mini'

function buildNutritionPayload(recipe) {
  return {
    ingredients: (recipe.ingredients ?? []).map((ing) => ({
      amount: ing.amount ?? null,
      amountMax: ing.amount_max ?? ing.amount ?? null,
      unit: ing.unit ?? null,
      ingredient: ing.ingredient ?? ing.name ?? null,
      additionalInfo: ing.additional_info ?? null,
      originalText: ing.original_text ?? null,
    })),
  }
}

function parseNutritionResponse(content) {
  if (!content) return null
  try {
    return JSON.parse(content)
  } catch (error) {
    throw new Error('Failed to parse nutrition JSON response')
  }
}

export async function estimateRecipeNutrition(id) {
  const recipe = getRecipeById(id)
  if (!recipe) throw new Error('Recipe not found')

  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) throw new Error('OPENAI_API_KEY is not set')

  const payload = buildNutritionPayload(recipe)
  console.log('[nutrition] payload:', payload)
  const client = new OpenAI({ apiKey })
  const model = process.env.OPENAI_NUTRITION_MODEL || DEFAULT_MODEL

  const response = await client.chat.completions.create({
    model,
    temperature: 0.2,
    messages: [
      { role: 'system', content: NUTRITION_PROMPT },
      { role: 'user', content: JSON.stringify(payload) },
    ],    
    response_format: {
      type: 'json_schema',
      json_schema: {
        name: 'recipe',
        strict: true,
        schema: NUTRITION_JSON_SCHEMA,
      },
    },
  })

  const choice = response.choices?.[0]
  if (!choice?.message?.content) {
    throw new Error('No nutrition content returned from OpenAI')
  }

  const estimation = parseNutritionResponse(choice.message.content)
  console.log('[nutrition] estimation:', estimation)
  const total = estimation?.nutritionTotal ?? {}

  const db = getDb()
  db.prepare(`
    UPDATE recipes SET
      nutrition_kcal = ?, nutrition_protein = ?, nutrition_carbs = ?, nutrition_fat = ?
    WHERE id = ?
  `).run(
    total.kcal ?? null,
    total.protein_g ?? null,
    total.carbs_g ?? null,
    total.fat_g ?? null,
    Number(id)
  )

  if (Array.isArray(estimation?.notes) && estimation.notes.length) {
    console.log(`[nutrition] Recipe ${id} notes:`, estimation.notes)
  }

  return {
    nutritionTotal: total,
    model,
    tokenUsage: response.usage
      ? {
          prompt_tokens: response.usage.prompt_tokens,
          completion_tokens: response.usage.completion_tokens,
          total_tokens: response.usage.total_tokens,
        }
      : null,
    notes: Array.isArray(estimation?.notes) ? estimation.notes : [],
  }
}
