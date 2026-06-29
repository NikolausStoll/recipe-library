/**
 * Deterministic oz / lb / fl oz → g or ml conversion for structured recipe envelopes.
 * Runs after URL normalization or vision extract, before cup conversion.
 */

const OZ_TO_G = 28.3495
const LB_TO_G = 453.592
const FL_OZ_TO_ML = 29.5735

const WEIGHT_OZ_UNITS = new Set(['oz', 'oz.', 'ounce', 'ounces', 'unze', 'unzen'])
const POUND_UNITS = new Set(['lb', 'lb.', 'lbs', 'pound', 'pounds', 'pfund', 'pfunde'])
const FLUID_OZ_UNITS = new Set(['fl oz', 'fl. oz', 'fl. oz.', 'fluid ounce', 'fluid ounces', 'fl oz.'])

const LIQUID_HINT_RE =
  /\b(oil|öl|milk|milch|water|wasser|juice|saft|broth|brühe|stock|fond|cream|sahne|vinegar|essig|wine|wein|beer|bier|syrup|sirup|honey|honig|buttermilk|buttermilch)\b/i

/**
 * @param {string | null | undefined} unit
 * @returns {string}
 */
function normalizeUnitString(unit) {
  return String(unit).trim().toLowerCase().replace(/\s+/g, ' ')
}

/**
 * @param {string | null | undefined} unit
 * @returns {'oz' | 'lb' | 'fl_oz' | null}
 */
export function classifyImperialUnit(unit) {
  const normalized = normalizeUnitString(unit)
  if (!normalized) return null
  if (FLUID_OZ_UNITS.has(normalized)) return 'fl_oz'
  if (POUND_UNITS.has(normalized)) return 'lb'
  if (WEIGHT_OZ_UNITS.has(normalized)) return 'oz'
  return null
}

/**
 * @param {number | null | undefined} value
 * @param {number} [step]
 * @returns {number | null}
 */
export function roundKitchenAmount(value, step = 5) {
  if (value == null || !Number.isFinite(value)) return null
  if (value <= 0) return 0
  return Math.round(value / step) * step
}

/**
 * @param {string | null | undefined} ingredient
 * @param {string | null | undefined} additionalInfo
 * @returns {boolean}
 */
export function isLikelyLiquidIngredient(ingredient, additionalInfo) {
  const text = `${ingredient ?? ''} ${additionalInfo ?? ''}`
  return LIQUID_HINT_RE.test(text)
}

/**
 * @param {object} row
 * @returns {object}
 */
export function convertImperialIngredientRow(row) {
  const kind = classifyImperialUnit(row?.unit)
  if (!kind) return row

  const useMl = kind === 'fl_oz' || (kind === 'oz' && isLikelyLiquidIngredient(row.ingredient, row.additionalInfo))
  const factor = kind === 'lb' ? LB_TO_G : useMl ? FL_OZ_TO_ML : OZ_TO_G
  const targetUnit = useMl ? 'ml' : 'g'

  const amount = row.amount != null ? roundKitchenAmount(Number(row.amount) * factor) : null
  let amountMax =
    row.amountMax != null ? roundKitchenAmount(Number(row.amountMax) * factor) : amount
  if (amount != null && amountMax == null) amountMax = amount

  return {
    ...row,
    amount,
    amountMax,
    unit: targetUnit,
  }
}

/**
 * @param {object} envelope
 * @returns {{ envelope: object, convertedCount: number }}
 */
export function convertImperialUnitsInEnvelope(envelope) {
  const base = envelope && typeof envelope === 'object' ? envelope : {}
  const sections = base?.recipe?.ingredientsSections
  if (!Array.isArray(sections)) {
    return { envelope: base, convertedCount: 0 }
  }

  let convertedCount = 0
  const newSections = sections.map((section) => ({
    ...section,
    items: (Array.isArray(section?.items) ? section.items : []).map((row) => {
      if (!classifyImperialUnit(row?.unit)) return row
      convertedCount += 1
      return convertImperialIngredientRow(row)
    }),
  }))

  return {
    envelope: {
      ...base,
      recipe: {
        ...base.recipe,
        ingredientsSections: newSections,
      },
    },
    convertedCount,
  }
}
