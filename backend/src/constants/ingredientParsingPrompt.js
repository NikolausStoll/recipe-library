/**
 * Shared LLM instructions for structured ingredient parsing (amount / unit / ingredient / additionalInfo).
 * Used by vision extract and URL normalization prompts.
 */

const FIELD_SPLIT_RULES = `- originalText: the exact visible or scraped source line, unchanged.
- amount / amountMax: numeric values from the line; for implicit "a" or "one" use amount: 1 and amountMax: 1.
- unit: culinary or metric unit from the line — never put quantity phrases in additionalInfo when they can be parsed here.
- ingredient: clean ingredient name only (no amount, no unit, no preparation).
- additionalInfo: preparation notes, alternatives, or modifiers only (e.g. diced, roasted, optional) — NOT amounts or culinary quantity words.

Do not put recognizable quantity phrases into additionalInfo. Parse them into amount and unit instead:
- pinch/pinches, dash/dashes → amount 1 (or N), unit: Prise (de) / pinch (en)
- handful/handfuls → amount 1, unit: Handvoll (de) / handful (en)
- drizzle/drizzle of/good drizzle/generous drizzle/splash/splash of → amount 1, unit: Schuss (de) / splash (en)
- sprig/sprigs → unit: Zweige (de) / sprigs (en); clove/cloves → Zehen (de) / cloves (en)
- bunch/bunches → Bund (de) / bunch (en); slice/slices → Scheiben (de) / slices (en)
- "to taste" / "nach Belieben" when clearly about quantity only: amount null, unit null, additionalInfo: "nach Belieben" (de) or "to taste" (en)`

const METRIC_AND_SPOON_UNITS_DE = `Units (metric and spoons):
- Translate tsp → TL.
- Translate tbsp → EL.
- Keep cup/cups as unit "cup".
- Do not translate cup/cups to "Tasse".
- Do not convert cup/cups to grams or milliliters.
- Never convert tbsp/tsp/EL/TL to grams or ml.
- tablespoon/tbsp always becomes unit: "EL" with the same amount.
- teaspoon/tsp always becomes unit: "TL" with the same amount.
- Do not convert small spoon amounts like tahini, dijon, salt, garlic powder, oil, vinegar, spices, or similar into grams/ml.`

const METRIC_AND_SPOON_UNITS_EN = `Units (metric and spoons):
- Keep tsp, tbsp, cup/cups, g, kg, ml, l, oz, lb when visible.
- For exact amounts, preserve the visible unit.
- Do not convert spoon amounts to grams/ml unless explicitly stated on the source line.`

const CULINARY_UNITS_DE = `Culinary count units (German):
- Use specific culinary units when they are part of the source; do not use generic "Stück".
- clove/cloves garlic → Zehe/Zehen Knoblauch
- pinch/pinches, dash/dashes (spices) → Prise/Prisen
- handful/handfuls → Handvoll
- drizzle/splash/good drizzle/generous drizzle → Schuss
- sprig/sprigs herbs → Zweig/Zweige
- bunch/bunches herbs/greens → Bund
- slice/slices → Scheibe/Scheiben
- Use "Handvoll" only when the source explicitly says handful/handfuls.
- Do not convert culinary count units to grams.
- Do not estimate piece-to-gram conversions for pinches, handfuls, sprigs, cloves, or similar count-based ingredients.`

const CULINARY_UNITS_EN = `Culinary count units (English):
- Use specific culinary units when they are part of the source.
- pinch/pinches, dash/dashes → unit: pinch
- handful/handfuls → unit: handful
- drizzle/splash/good drizzle → unit: splash
- sprig/sprigs, clove/cloves, bunch/bunches, slice/slices → structured count + matching unit
- Do not put these quantity words in additionalInfo.`

const EXAMPLES_DE = `Ingredient examples:
- "1/2 red onion" → amount: 0.5, amountMax: 0.5, unit: null, ingredient: "rote Zwiebel"
- "2 carrots" → amount: 2, amountMax: 2, unit: null, ingredient: "Karotten"
- "3 eggs" → amount: 3, amountMax: 3, unit: null, ingredient: "Eier"
- "2 cloves garlic" → amount: 2, amountMax: 2, unit: "Zehen", ingredient: "Knoblauch"
- "1 pinch salt" / "a pinch of sea salt" → amount: 1, amountMax: 1, unit: "Prise", ingredient: "Salz" / "Meersalz"
- "dash of pepper" → amount: 1, amountMax: 1, unit: "Prise", ingredient: "Pfeffer"
- "12 sprigs thyme" → amount: 12, amountMax: 12, unit: "Zweige", ingredient: "Thymian"
- "1 handful spinach" / "a handful of black olives" → amount: 1, amountMax: 1, unit: "Handvoll", ingredient: "Spinat" / "schwarze Oliven"
- "a good drizzle of extra virgin olive oil" → amount: 1, amountMax: 1, unit: "Schuss", ingredient: "natives Olivenöl extra"
- "1/2 red onion, diced" → amount: 0.5, amountMax: 0.5, unit: null, ingredient: "rote Zwiebel", additionalInfo: "gewürfelt"
- "1 cup milk" → amount: 1, amountMax: 1, unit: "cup", ingredient: "Milch"
- "1/4 cup olive oil" → amount: 0.25, amountMax: 0.25, unit: "cup", ingredient: "Olivenöl"
- "3 cups tortellini (cooked)" → amount: 3, amountMax: 3, unit: "cup", ingredient: "Tortellini", additionalInfo: "gekocht"
- "1-2 cups sweet potato (roasted)" → amount: 1, amountMax: 2, unit: "cup", ingredient: "Süßkartoffel", additionalInfo: "geröstet"
- "1 tbsp tahini" → amount: 1, amountMax: 1, unit: "EL", ingredient: "Tahini"; do not convert to grams
- "1 tsp dijon" → amount: 1, amountMax: 1, unit: "TL", ingredient: "Dijon-Senf"; do not convert to grams
- "1 tsp salt" → amount: 1, amountMax: 1, unit: "TL", ingredient: "Salz"; do not convert to grams`

const EXAMPLES_EN = `Ingredient examples:
- "1/2 red onion" → amount: 0.5, amountMax: 0.5, unit: null, ingredient: "red onion"
- "a pinch of sea salt" → amount: 1, amountMax: 1, unit: "pinch", ingredient: "sea salt"
- "a handful of black olives" → amount: 1, amountMax: 1, unit: "handful", ingredient: "black olives"
- "a good drizzle of extra virgin olive oil" → amount: 1, amountMax: 1, unit: "splash", ingredient: "extra virgin olive oil"
- "1/2 red onion, diced" → amount: 0.5, amountMax: 0.5, unit: null, ingredient: "red onion", additionalInfo: "diced"
- "2 cloves garlic" → amount: 2, amountMax: 2, unit: "cloves", ingredient: "garlic"`

const CUP_HANDLING_NORMALIZATION = `Cup handling:
- This normalization step must not convert cup-based ingredients.
- Keep cup amounts as cup.
- Keep cup ranges as cup ranges.
- Do not estimate grams or ml for cup ingredients in this step.
- Cup conversion is handled by a separate pipeline step after normalization.`

/**
 * @param {{ unitLanguage?: 'de' | 'en', includeAmountMaxRule?: boolean, includeCupHandling?: boolean, germanIngredientNames?: boolean }} [options]
 * @returns {string}
 */
export function buildIngredientParsingPromptBlock(options = {}) {
  const unitLanguage = options.unitLanguage === 'en' ? 'en' : 'de'
  const includeAmountMaxRule = options.includeAmountMaxRule !== false
  const includeCupHandling = options.includeCupHandling === true
  const germanIngredientNames = options.germanIngredientNames === true || unitLanguage === 'de'

  const lines = ['Ingredient parsing:', FIELD_SPLIT_RULES]

  if (includeAmountMaxRule) {
    lines.push(
      '- For single amounts, amountMax must equal amount. Do not use null for amountMax unless amount itself is null.',
    )
  }

  if (germanIngredientNames) {
    lines.push('- unit is German or null.', '- ingredient is a clean German name.')
  } else {
    lines.push('- unit matches the visible source language when present, or null.', '- ingredient is a clean normalized name.')
  }

  lines.push(
    '- additionalInfo contains preparation notes, alternatives, or modifiers only — never quantity phrases.',
    '- ingredient originalText preserves the original source line.',
    '- category must be exactly one allowed category.',
    '',
    unitLanguage === 'de' ? METRIC_AND_SPOON_UNITS_DE : METRIC_AND_SPOON_UNITS_EN,
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

/** Short rules for vision-extract base prompt (before full parsing block). */
export const INGREDIENT_EXTRACT_SUMMARY_RULES = `- Keep ingredient names clean and normalized; preserve the visible ingredient line in originalText.
- Parse visible amounts and culinary units into amount, amountMax, and unit — never into additionalInfo.
- Put only preparation notes, alternatives, and modifiers (e.g. diced, roasted) into additionalInfo — not pinch, handful, drizzle, splash, or similar quantity phrases.`
