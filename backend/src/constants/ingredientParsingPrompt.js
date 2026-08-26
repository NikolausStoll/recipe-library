/**
 * Shared LLM instructions for structured ingredient parsing (amount / unit / ingredient / additionalInfo).
 * Used by vision extract and URL normalization prompts.
 */

const FIELD_SPLIT_RULES = `- originalText: the exact visible or scraped source line, unchanged.
- amount / amountMax: numeric values from the line; for implicit "a" or "one" use amount: 1 and amountMax: 1.
- unit: culinary or metric unit from the line — never put quantity phrases in additionalInfo when they can be parsed here.
- ingredient: clean ingredient name only (no amount, no unit, no preparation).
- additionalInfo: preparation notes, alternatives, or modifiers only (e.g. diced, roasted, optional) — NOT amounts or culinary quantity words.

Parse recognizable quantity phrases into amount and unit instead of additionalInfo:
- pinch/pinches, dash/dashes → amount 1 (or N), unit: Prise (de) / pinch (en)
- handful/handfuls → amount 1, unit: Handvoll (de) / handful (en)
- drizzle/drizzle of/good drizzle/generous drizzle/splash/splash of → amount 1, unit: Schuss (de) / splash (en)
- sprig/sprigs → unit: Zweige (de) / sprigs (en)
- clove/cloves → unit: Zehen (de) / cloves (en)
- bunch/bunches → unit: Bund (de) / bunch (en)
- slice/slices → unit: Scheibe/Scheiben (de) / slices (en)
- "to taste" / "nach Belieben" when clearly about quantity only → amount null, unit null, additionalInfo: "nach Belieben" (de) / "to taste" (en)`

const METRIC_AND_SPOON_UNITS_DE = `Units:
- Translate tsp → TL.
- Translate tbsp → EL.
- Keep cup/cups as unit "cup".
- Do not translate cup/cups to "Tasse".
- Do not convert cup/cups to grams or milliliters.
- Never convert tbsp/tsp/EL/TL to grams or ml.
- Convert imperial weight/volume units to metric for German output:
  - oz / ounces (weight) → g
  - lb / pounds → g
  - fl oz / fluid ounces → ml
- Round imperial conversions to practical kitchen values, typically nearest 5 g or 5 ml.
- Do not leave oz, lb, or fl oz as units in German output.
- Standard cans like "15 oz chickpeas" → about 425 g Kichererbsen.`

const METRIC_AND_SPOON_UNITS_EN = `Units:
- Keep tsp, tbsp, cup/cups, g, kg, ml, l, oz, lb when visible.
- For exact amounts, preserve the visible unit.
- Do not convert spoon amounts to grams/ml unless explicitly stated on the source line.`

const CULINARY_UNITS_DE = `Culinary count units:
- Use specific culinary units when they are part of the source; do not use generic "Stück".
- clove/cloves garlic → Zehe/Zehen Knoblauch
- pinch/pinches, dash/dashes → Prise/Prisen
- handful/handfuls → Handvoll
- drizzle/splash/good drizzle/generous drizzle → Schuss
- sprig/sprigs herbs → Zweig/Zweige
- bunch/bunches herbs/greens → Bund
- slice/slices → Scheibe/Scheiben
- Use "Handvoll" only when the source explicitly says handful/handfuls.
- Do not convert culinary count units to grams.
- Do not estimate piece-to-gram conversions for pinches, handfuls, sprigs, cloves, or similar count-based ingredients.`

const CULINARY_UNITS_EN = `Culinary count units:
- Use specific culinary units when they are part of the source.
- pinch/pinches, dash/dashes → unit: pinch
- handful/handfuls → unit: handful
- drizzle/splash/good drizzle → unit: splash
- sprig/sprigs, clove/cloves, bunch/bunches, slice/slices → structured count + matching unit
- Do not put these quantity words in additionalInfo.`

const EXAMPLES_DE = `Examples:
- "1/2 red onion, diced" → amount: 0.5, amountMax: 0.5, unit: null, ingredient: "rote Zwiebel", additionalInfo: "gewürfelt"
- "2 cloves garlic" → amount: 2, amountMax: 2, unit: "Zehen", ingredient: "Knoblauch"
- "a pinch of sea salt" → amount: 1, amountMax: 1, unit: "Prise", ingredient: "Meersalz"
- "a good drizzle of olive oil" → amount: 1, amountMax: 1, unit: "Schuss", ingredient: "Olivenöl"
- "1-2 cups sweet potato (roasted)" → amount: 1, amountMax: 2, unit: "cup", ingredient: "Süßkartoffel", additionalInfo: "geröstet"
- "15 oz chickpeas, drained and rinsed" → amount: 425, amountMax: 425, unit: "g", ingredient: "Kichererbsen", additionalInfo: "abgetropft und abgespült"`

const EXAMPLES_EN = `Examples:
- "1/2 red onion, diced" → amount: 0.5, amountMax: 0.5, unit: null, ingredient: "red onion", additionalInfo: "diced"
- "a pinch of sea salt" → amount: 1, amountMax: 1, unit: "pinch", ingredient: "sea salt"
- "a handful of black olives" → amount: 1, amountMax: 1, unit: "handful", ingredient: "black olives"
- "a good drizzle of olive oil" → amount: 1, amountMax: 1, unit: "splash", ingredient: "olive oil"
- "2 cloves garlic" → amount: 2, amountMax: 2, unit: "cloves", ingredient: "garlic"`

const CUP_HANDLING_NORMALIZATION = `Cup handling:
- This step must not convert cup-based ingredients.
- Keep cup amounts as cup.
- Keep cup ranges as cup ranges.
- Do not estimate grams or ml for cup ingredients in this step.
- Cup conversion is handled by a separate pipeline step after normalization.`

export function buildIngredientParsingPromptBlock(options = {}) {
  const unitLanguage = options.unitLanguage === 'en' ? 'en' : 'de'
  const includeAmountMaxRule = options.includeAmountMaxRule !== false
  const includeCupHandling = options.includeCupHandling === true
  const germanIngredientNames =
    options.germanIngredientNames === true || unitLanguage === 'de'

  const lines = ['Ingredient parsing:', FIELD_SPLIT_RULES]

  if (includeAmountMaxRule) {
    lines.push(
      '- For single amounts, amountMax must equal amount. Do not use null for amountMax unless amount itself is null.',
    )
  }

  if (germanIngredientNames) {
    lines.push(
      '- unit is German or null.',
      '- ingredient is a clean German name.',
    )
  } else {
    lines.push(
      '- unit matches the visible source language when present, or null.',
      '- ingredient is a clean normalized name.',
    )
  }

  lines.push(
    '- additionalInfo contains preparation notes, alternatives, or modifiers only — never quantity phrases.',
    '- ingredient originalText preserves the original source line.',
    '- category must be exactly one allowed category.',
    '',
    unitLanguage === 'de'
      ? METRIC_AND_SPOON_UNITS_DE
      : METRIC_AND_SPOON_UNITS_EN,
    '',
    unitLanguage === 'de' ? CULINARY_UNITS_DE : CULINARY_UNITS_EN,
    '',
    unitLanguage === 'de' ? EXAMPLES_DE : EXAMPLES_EN,
  )

  if (includeCupHandling) {
    lines.push('', CUP_HANDLING_NORMALIZATION)
  }

  return `${lines.join('\n')}\n`
}