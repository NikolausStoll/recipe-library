import OpenAI from 'openai'
import { RECIPE_JSON_SCHEMA, parseTranslateToGerman } from './extractRecipeService.js'
import { formatCategoryListForPrompt } from '../constants/ingredientCategories.js'
import { buildIngredientParsingPromptBlock } from '../constants/ingredientParsingPrompt.js'
import { buildOpenAiChatTemperature } from '../utils/openaiChatParams.js'

const DEFAULT_MODEL = 'gpt-5.6-luna'
const TEMPERATURE = 0

export function getTextExtractionModel() {
  return process.env.OPENAI_TEXT_EXTRACT_MODEL || DEFAULT_MODEL
}

export function buildTextExtractionPrompt(translateToGerman = false) {
  const languageRule = translateToGerman
    ? 'Set recipe.language to "de". Translate introText, ingredient section headings, ingredient, additionalInfo, steps, and tips to German. Use natural German recipe language for home cooks; do not translate word-for-word when that sounds unnatural. Use informal "du" only when directly addressing the cook; never use formal "Sie". Preserve meaning and cooking intent. Keep the translation concise without making it awkward. Keep ingredient originalText exactly as pasted. Never translate recipe.title. Do not return duplicate translated and original content.'
    : 'Preserve the source language and wording. Do not translate content. Set recipe.language to the detected source language when clear; otherwise null.'

  return `You extract a recipe from arbitrary pasted plain text into the provided recipe JSON schema.

Treat the pasted text as the source of truth. Extract only information present in the text. Do not invent ingredients, steps, servings, times, tips, or a title. If the text is not recognizably a recipe, return status "failed" and recipe null. If it is useful but incomplete, return status "partial" and explain missing information in warnings and missingFields.

Preserve the meaning, detail, order, and wording of readable source content. Structure prose into practical ordered steps only when needed. Detect ingredient sections without inventing groups; use one unheaded section when no groups are present. Preserve each original ingredient line in originalText. Set prepTimeMinutes and cookTimeMinutes only for explicitly provided times; otherwise use null. Use amount as the lower value and amountMax as the upper value for ranges, and keep cups for the existing post-processing conversion stage.

Extract clearly separate tips, notes, hints, variations, substitutions, and storage advice into tips without duplicates. Separately presented serving advice may also become a tip. Serving instructions that are part of the actual preparation flow, such as "Mit Parmesan bestreuen und sofort servieren.", must remain in the relevant step. Do not move ordinary final cooking or serving instructions into tips merely because they mention serving. Confidence must describe extraction certainty, from 0 to 1.

${buildIngredientParsingPromptBlock({ unitLanguage: translateToGerman ? 'de' : 'en', includeAmountMaxRule: true, includeCupHandling: true, germanIngredientNames: translateToGerman })}

Allowed ingredient categories:
${formatCategoryListForPrompt()}

Categorization: use exactly one allowed category per ingredient; use "other" when uncertain.

${languageRule}

Return JSON only, with no markdown or explanation.`
}

export async function extractRecipeFromText(text, options = {}) {
  const sourceText = typeof text === 'string' ? text.trim() : ''
  if (!sourceText) throw new Error('text is required')
  const translateToGerman = parseTranslateToGerman(options.translateToGerman)
  const model = options.model || getTextExtractionModel()
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  const response = await client.chat.completions.create({
    model,
    ...buildOpenAiChatTemperature(model, TEMPERATURE),
    messages: [
      { role: 'system', content: buildTextExtractionPrompt(translateToGerman) },
      { role: 'user', content: `Pasted recipe text:\n${sourceText}\n\nReturn valid JSON matching the recipe extraction schema exactly.` },
    ],
    response_format: {
      type: 'json_schema',
      json_schema: { name: 'recipe_text_extract', strict: true, schema: RECIPE_JSON_SCHEMA },
    },
  })
  const content = response.choices?.[0]?.message?.content
  if (!content) throw new Error('No content in OpenAI response')
  return {
    recipe: JSON.parse(content),
    model,
    usage: response.usage
      ? { prompt_tokens: response.usage.prompt_tokens, completion_tokens: response.usage.completion_tokens, total_tokens: response.usage.total_tokens }
      : undefined,
    request_json: sourceText,
  }
}