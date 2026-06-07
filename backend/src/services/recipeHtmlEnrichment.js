/**
 * HTML recipe-card enrichment: container detection, ingredient groups, notes, instructions.
 * Used by recipeUrlExtractService after JSON-LD extraction; no LLM.
 */

import * as cheerio from 'cheerio'

/** @typedef {{ heading: string | null, lines: string[] }} IngredientSection */

const RECIPE_CARD_SELECTORS = [
  '.wprm-recipe-container',
  '.wprm-recipe',
  '.wprm-recipe-template',
  '[id^="wprm-recipe"]',
  '[id*="wprm-recipe"]',
  '[class*="wprm-recipe"]',
  '.tasty-recipes',
  '.tasty-recipes-entry-content',
  '.tasty-recipes-ingredients',
  '.tasty-recipes-instructions',
  '[class*="tasty-recipes"]',
  '.mv-create-card',
  '.mv-create-wrapper',
  '.mv-create-ingredients',
  '.mv-create-instructions',
  '[class*="mv-create"]',
  '.wpurp-container',
  '.wpurp-recipe',
  '.wpurp-recipe-ingredients',
  '.wpurp-recipe-instructions',
  '.easyrecipe',
  '.easyrecipe-card',
  '.ERSIngredients',
  '.ERSInstructions',
  '.recipe-card',
  '.recipe-container',
  '.recipe-wrapper',
  '.recipe-box',
  '.recipe',
  '.recipe-content',
  '.recipe-inner',
  '.recipe-summary',
  '.recipe-detail',
  '.recipe-details',
  '.recipe-instructions',
  '.recipe-ingredients',
  '[class*="recipe-card"]',
  '[class*="recipe-container"]',
  '[class*="recipe-wrapper"]',
  '[class*="recipe-box"]',
  '[class*="recipe"]',
  '[itemtype*="schema.org/Recipe"]',
  '[itemtype*="Recipe"]',
  '[typeof*="Recipe"]',
  '[itemscope][itemtype*="Recipe"]',
  '[itemprop="recipeIngredient"]',
  '[itemprop="recipeInstructions"]',
  'article',
  'main',
  '.entry-content',
  '.post-content',
  '.post-entry',
  '.article-content',
  '.content',
  '.site-content',
  '.page-content',
  '.single-content',
]

const INGREDIENT_HEADING_RE =
  /^(ingredient|ingredients|ingredient list|what you need|what you'll need|what you'll need|you will need|for the recipe|for this recipe|for the salad|for the dressing|for the sauce|for the filling|for the topping|for the marinade|for serving|to serve|zutaten|zutatenliste|du brauchst|was du brauchst|für das rezept|für den salat|für das dressing|für die sauce|für die füllung|für das topping|zum servieren)/

const INSTRUCTION_HEADING_RE =
  /^(instruction|instructions|direction|directions|method|preparation|prep|how to make|how to prepare|steps|procedure|recipe steps|cooking instructions|zubereitung|anleitung|zubereitungsschritte|schritte|methode|so geht's|so gehts|zubereiten|kochanleitung)/

const NOTES_HEADING_RE =
  /^(note|notes|recipe notes|cook's notes|cooks notes|chef's notes|chefs notes|tips|recipe tips|tips and notes|tips & notes|helpful tips|pro tips|expert tips|variations|substitutions|storage|storing|make ahead|leftovers|serving suggestions|garnish|optional|troubleshooting|notizen|hinweise|rezeptnotizen|tipps|tipps und notizen|tipps & notizen|variationen|abwandlungen|ersatz|zutaten ersetzen|aufbewahrung|vorbereiten|reste|servierhinweise)/

const STOP_HEADING_RE =
  /^(nutrition|nutritional information|nutrition facts|calories|equipment|tools|faq|frequently asked questions|comments|leave a comment|you may also like|related recipes|similar recipes|more recipes|share|pin this|did you make this recipe|rate this recipe|newsletter|subscribe|about the author|zutaten kaufen|nährwerte|nährwertangaben|nährinformationen|kalorien|ausrüstung|kommentare|ähnliche rezepte|weitere rezepte)/

const GROUP_HEADING_TAGS = new Set(['h2', 'h3', 'h4', 'h5', 'h6', 'strong', 'b', 'p', 'div', 'span'])

const GROUP_HEADING_SELECTORS =
  '.group-title, .group-name, .section-title, .ingredient-group, .ingredient-group-name, .ingredient-section-title, .recipe-ingredient-group, .recipe-ingredient-group-name, .wprm-recipe-ingredient-group-name, .mv-create-ingredient-group-title'

const INGREDIENT_ITEM_SELECTORS =
  '[itemprop="recipeIngredient"], .wprm-recipe-ingredient, .mv-create-ingredient, .ingredient, .ingredient-item, .recipe-ingredient, .recipe-ingredient-item, .tasty-recipes-ingredients li'

const INSTRUCTION_ITEM_SELECTORS =
  '[itemprop="recipeInstructions"], .wprm-recipe-instruction-text, .wprm-recipe-instruction, .mv-create-instructions li, .tasty-recipes-instructions li, .instructions li, .directions li, .method li, .preparation li, .recipe-instructions li, .instruction-list li, .recipe-directions li, .step, .recipe-step'

const UI_NOISE_RE =
  /^(copy|print|scale|1x|2x|3x|notes|tips|ingredients|instructions|pin|save|share|email)$/i

const QUANTITY_START_RE = /^[\d½⅓⅔¼¾⅛⅜⅝⅞./]/
const UNIT_WORDS_RE =
  /\b(cup|cups|tbsp|tsp|tablespoon|teaspoon|g|kg|ml|l|oz|lb|pinch|clove|sprig|handful|bunch|slice|el|tl|tasse|zehe|prise|zweig|bund|scheibe|handvoll)\b/i

const SCALE_CONTROL_RE = /\b(1x|2x|3x|4x|5x)\b/i

/**
 * @param {string} text
 * @returns {string}
 */
export function normalizeHeadingText(text) {
  if (!text) return ''
  const decoded = decodeHtmlEntities(String(text))
  return decoded
    .toLowerCase()
    .replace(/[:#]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * @param {string} text
 * @returns {string}
 */
export function decodeHtmlEntities(text) {
  if (!text) return ''
  return cheerio.load(`<span>${text}</span>`, null, false)('span').text()
}

/**
 * @param {import('cheerio').CheerioAPI} $
 * @param {cheerio.Element} el
 * @returns {string}
 */
export function textOneLine($, el) {
  return $(el).text().replace(/\s+/g, ' ').trim()
}

/**
 * @param {string} text
 * @returns {string}
 */
export function cleanLineText(text) {
  if (!text) return ''
  let t = decodeHtmlEntities(text).replace(/\s+/g, ' ').trim()
  t = t.replace(/\s*[▢☐☑✓□]\s*/g, ' ').replace(/\s+/g, ' ').trim()
  if (UI_NOISE_RE.test(t)) return ''
  if (SCALE_CONTROL_RE.test(t) && t.length < 20) return ''
  return t
}

/**
 * @param {string} text
 * @returns {boolean}
 */
export function looksLikeIngredientLine(text) {
  const t = cleanLineText(text)
  if (!t || t.length > 220) return false
  if (QUANTITY_START_RE.test(t)) return true
  if (UNIT_WORDS_RE.test(t)) return true
  return false
}

/**
 * @param {IngredientSection[]} sections
 * @returns {number}
 */
export function countSectionLines(sections) {
  if (!Array.isArray(sections)) return 0
  return sections.reduce((n, s) => n + (Array.isArray(s.lines) ? s.lines.length : 0), 0)
}

/**
 * @param {IngredientSection[]} sections
 * @returns {string[]}
 */
export function flattenIngredientSections(sections) {
  if (!Array.isArray(sections)) return []
  return sections.flatMap((s) => (Array.isArray(s.lines) ? s.lines : []))
}

/**
 * @param {number} htmlCount
 * @param {number} jsonLdCount
 * @param {string[]} warnings
 * @returns {boolean}
 */
export function shouldAcceptHtmlIngredientSections(htmlCount, jsonLdCount, warnings) {
  if (htmlCount <= 0) return false
  if (jsonLdCount === 0) return htmlCount >= 2
  if (htmlCount === jsonLdCount) return true
  const threshold = Math.max(2, Math.ceil(jsonLdCount * 0.75))
  if (htmlCount >= threshold) return true
  warnings.push('HTML grouped ingredients rejected due to count mismatch')
  return false
}

/**
 * @param {import('cheerio').CheerioAPI} $
 * @param {cheerio.Element | import('cheerio').Cheerio} root
 * @returns {number}
 */
function countWithin($, root, selector) {
  return $(root).find(selector).length
}

/**
 * @param {import('cheerio').CheerioAPI} $
 * @param {cheerio.Element} el
 * @returns {{ score: number, hasBoth: boolean, size: number, ingCount: number, stepCount: number }}
 */
function scoreRecipeContainer($, el) {
  const $c = $(el)
  const ingCount = countWithin($, $c, INGREDIENT_ITEM_SELECTORS)
  const stepCount = countWithin($, $c, INSTRUCTION_ITEM_SELECTORS)
  let score = 0
  if (ingCount > 0) score += 10 + Math.min(ingCount, 20)
  if (stepCount > 0) score += 10 + Math.min(stepCount, 20)
  if ($c.find('h1, h2, .wprm-recipe-name, [itemprop="name"]').length) score += 3
  if ($c.find('.wprm-recipe-servings, [itemprop="recipeYield"], .recipe-yield, .yield').length) score += 2
  if ($c.find('.wprm-recipe-notes, .recipe-notes, .notes, .tips, [class*="recipe-note"]').length) score += 2

  $c.find('h2, h3, h4, h5, h6, strong, b').each((_, h) => {
    const label = normalizeHeadingText($(h).text())
    if (INGREDIENT_HEADING_RE.test(label)) score += 5
    if (INSTRUCTION_HEADING_RE.test(label)) score += 5
  })

  const tag = $c.prop('tagName')?.toLowerCase() || ''
  if (tag === 'body' || tag === 'html') score -= 50
  if ($c.is('main, article, .entry-content, .post-content, .content')) score -= 5

  const size = $c.text().replace(/\s+/g, ' ').length
  return { score, hasBoth: ingCount > 0 && stepCount > 0, size, ingCount, stepCount }
}

/**
 * @param {import('cheerio').CheerioAPI} $
 * @returns {cheerio.Element | null}
 */
export function findRecipeCardContainer($) {
  const selector = RECIPE_CARD_SELECTORS.join(', ')
  /** @type {Array<{ el: cheerio.Element, score: number, hasBoth: boolean, size: number }>} */
  const ranked = []
  const seen = new Set()

  $(selector).each((_, el) => {
    if (seen.has(el)) return
    seen.add(el)
    const metrics = scoreRecipeContainer($, el)
    if (metrics.score <= 0) return
    ranked.push({ el, ...metrics })
  })

  if (!ranked.length) return null

  ranked.sort((a, b) => {
    if (a.hasBoth !== b.hasBoth) return a.hasBoth ? -1 : 1
    if (b.score !== a.score) return b.score - a.score
    return a.size - b.size
  })

  const withBoth = ranked.filter((r) => r.hasBoth)
  if (withBoth.length) {
    withBoth.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score
      return a.size - b.size
    })
    return withBoth[0].el
  }

  return ranked[0].el
}

/**
 * @param {import('cheerio').CheerioAPI} $
 * @param {cheerio.Element} el
 * @returns {string}
 */
function buildWprmIngredientLine($, el) {
  const $el = $(el)
  const amount = cleanLineText(textOneLine($, $el.find('.wprm-recipe-ingredient-amount').first()))
  const unit = cleanLineText(textOneLine($, $el.find('.wprm-recipe-ingredient-unit').first()))
  const name = cleanLineText(textOneLine($, $el.find('.wprm-recipe-ingredient-name').first()))
  const notes = cleanLineText(textOneLine($, $el.find('.wprm-recipe-ingredient-notes').first()))
  const parts = [amount, unit, name].filter(Boolean)
  if (notes) parts.push(`(${notes})`)
  const combined = parts.join(' ').trim()
  return combined || cleanLineText(textOneLine($, el))
}

/**
 * @param {import('cheerio').CheerioAPI} $
 * @param {cheerio.Element} card
 * @returns {IngredientSection[] | null}
 */
function extractFlatWprmIngredients($, card) {
  const $card = $(card)
  const items = $card.find('.wprm-recipe-ingredient')
  if (!items.length) return null
  /** @type {string[]} */
  const lines = []
  items.each((_, el) => {
    const line = buildWprmIngredientLine($, el)
    if (line) lines.push(line)
  })
  return lines.length ? [{ heading: null, lines }] : null
}

/**
 * @param {import('cheerio').CheerioAPI} $
 * @param {cheerio.Element} card
 * @returns {IngredientSection[] | null}
 */
function extractPluginIngredientSections($, card) {
  const $card = $(card)

  const wprmGroups = $card.find('.wprm-recipe-ingredient-group')
  if (wprmGroups.length) {
    /** @type {IngredientSection[]} */
    const sections = []
    wprmGroups.each((_, groupEl) => {
      const headingRaw = textOneLine($, $(groupEl).find('.wprm-recipe-ingredient-group-name').first())
      const heading = headingRaw ? cleanLineText(headingRaw) || null : null
      /** @type {string[]} */
      const lines = []
      $(groupEl)
        .find('.wprm-recipe-ingredient')
        .each((__, el) => {
          const line = buildWprmIngredientLine($, el)
          if (line) lines.push(line)
        })
      if (lines.length) sections.push({ heading, lines })
    })
    if (sections.length) return sections
  }

  const mvGroups = $card.find('.mv-create-ingredient-group')
  if (mvGroups.length) {
    /** @type {IngredientSection[]} */
    const sections = []
    mvGroups.each((_, groupEl) => {
      const headingRaw = textOneLine($, $(groupEl).find('.mv-create-ingredient-group-title').first())
      const heading = headingRaw ? cleanLineText(headingRaw) || null : null
      /** @type {string[]} */
      const lines = []
      $(groupEl)
        .find('.mv-create-ingredient, li')
        .each((__, el) => {
          const line = cleanLineText(textOneLine($, el))
          if (line && looksLikeIngredientLine(line)) lines.push(line)
        })
      if (lines.length) sections.push({ heading, lines })
    })
    if (sections.length) return sections
  }

  const tastyRoot = $card.find('.tasty-recipes-ingredients').first()
  if (tastyRoot.length) {
    /** @type {IngredientSection[]} */
    const sections = []
    let current = /** @type {IngredientSection | null} */ (null)

    tastyRoot.children().each((_, child) => {
      const $child = $(child)
      const tag = $child.prop('tagName')?.toLowerCase() || ''
      if (['h3', 'h4', 'strong', 'b'].includes(tag)) {
        const heading = cleanLineText(textOneLine($, child)) || null
        current = { heading, lines: [] }
        sections.push(current)
        return
      }
      if ($child.is('ul, ol')) {
        if (!current) {
          current = { heading: null, lines: [] }
          sections.push(current)
        }
        $child.find('li').each((__, li) => {
          const line = cleanLineText(textOneLine($, li))
          if (line) current.lines.push(line)
        })
        return
      }
      if ($child.is('li')) {
        if (!current) {
          current = { heading: null, lines: [] }
          sections.push(current)
        }
        const line = cleanLineText(textOneLine($, child))
        if (line) current.lines.push(line)
      }
    })

    const filtered = sections.filter((s) => s.lines.length > 0)
    if (filtered.length) return filtered
  }

  return null
}

/**
 * @param {import('cheerio').CheerioAPI} $
 * @param {import('cheerio').Cheerio} scope
 * @returns {cheerio.Element | null}
 */
function findSectionHeading($, scope, patternRe) {
  let found = /** @type {cheerio.Element | null} */ (null)
  scope.find('h1, h2, h3, h4, h5, h6, strong, b, p, div, span').each((_, el) => {
    if (found) return
    const $el = $(el)
    if (!$el.text().trim()) return
    const directText = normalizeHeadingText($el.clone().children().remove().end().text() || $el.text())
    if (patternRe.test(directText)) found = el
  })
  return found
}

/**
 * @param {import('cheerio').CheerioAPI} $
 * @param {cheerio.Element} el
 * @returns {boolean}
 */
function isGroupHeadingCandidate($, el) {
  const tag = $(el).prop('tagName')?.toLowerCase() || ''
  if (!GROUP_HEADING_TAGS.has(tag)) return false
  const text = cleanLineText(textOneLine($, el))
  if (!text || text.length > 80) return false
  const label = normalizeHeadingText(text)
  if (INGREDIENT_HEADING_RE.test(label)) return false
  if (INSTRUCTION_HEADING_RE.test(label)) return false
  if (NOTES_HEADING_RE.test(label)) return false
  if (STOP_HEADING_RE.test(label)) return false
  if ($(el).is('ul, ol, li')) return false
  if ($(el).find('li').length > 0) return false
  return true
}

/**
 * @param {import('cheerio').CheerioAPI} $
 * @param {cheerio.Element} card
 * @returns {IngredientSection[]}
 */
function extractHeadingWalkIngredientSections($, card) {
  const $card = $(card)
  const heading = findSectionHeading($, $card, INGREDIENT_HEADING_RE)
  if (!heading) return []

  /** @type {IngredientSection[]} */
  const sections = []
  let current = /** @type {IngredientSection | null} */ (null)
  let $node = $(heading).next()
  let guard = 0

  while ($node.length && guard++ < 80) {
    if ($node.find(heading).length && $node.is(heading)) break
    if ($node.is('h1, h2, h3, h4, h5, h6, strong, b')) {
      const label = normalizeHeadingText($node.text())
      if (INSTRUCTION_HEADING_RE.test(label) || NOTES_HEADING_RE.test(label) || STOP_HEADING_RE.test(label)) break
      if (isGroupHeadingCandidate($, $node.get(0))) {
        current = { heading: cleanLineText(textOneLine($, $node)) || null, lines: [] }
        sections.push(current)
        $node = $node.next()
        continue
      }
    }

    if ($node.is('ul, ol')) {
      if (!current) {
        current = { heading: null, lines: [] }
        sections.push(current)
      }
      $node.find('li').each((_, li) => {
        const line = cleanLineText(textOneLine($, li))
        if (line && looksLikeIngredientLine(line)) current.lines.push(line)
      })
      $node = $node.next()
      continue
    }

    if ($node.is('li')) {
      if (!current) {
        current = { heading: null, lines: [] }
        sections.push(current)
      }
      const line = cleanLineText(textOneLine($, $node))
      if (line && looksLikeIngredientLine(line)) current.lines.push(line)
      $node = $node.next()
      continue
    }

    if ($node.is('p, div')) {
      const line = cleanLineText(textOneLine($, $node))
      if (line && looksLikeIngredientLine(line)) {
        if (!current) {
          current = { heading: null, lines: [] }
          sections.push(current)
        }
        current.lines.push(line)
      } else if ($node.find(GROUP_HEADING_SELECTORS).length) {
        $node.find(GROUP_HEADING_SELECTORS).each((_, gh) => {
          if (!isGroupHeadingCandidate($, gh)) return
          current = { heading: cleanLineText(textOneLine($, gh)) || null, lines: [] }
          sections.push(current)
        })
      }
    }

    $node = $node.next()
  }

  return sections.filter((s) => s.lines.length > 0)
}

/**
 * @param {import('cheerio').CheerioAPI} $
 * @param {cheerio.Element} card
 * @returns {IngredientSection[]}
 */
function extractGenericIngredientSections($, card) {
  const $card = $(card)
  /** @type {IngredientSection[]} */
  const sections = []
  const roots = $card.find('.ingredients, .recipe-ingredients, .ingredient-list, .ingredients-list, .ingredients-section, .ingredient-section, ul.ingredients, ol.ingredients')

  if (roots.length) {
    roots.each((_, rootEl) => {
      let current = /** @type {IngredientSection | null} */ ({ heading: null, lines: [] })
      sections.push(current)
      $(rootEl)
        .children()
        .each((__, child) => {
          const $child = $(child)
          if (isGroupHeadingCandidate($, child)) {
            current = { heading: cleanLineText(textOneLine($, child)) || null, lines: [] }
            sections.push(current)
            return
          }
          if ($child.is('ul, ol')) {
            $child.find('li').each((___, li) => {
              const line = cleanLineText(textOneLine($, li))
              if (line && looksLikeIngredientLine(line)) current.lines.push(line)
            })
            return
          }
          if ($child.is('li')) {
            const line = cleanLineText(textOneLine($, child))
            if (line && looksLikeIngredientLine(line)) current.lines.push(line)
          }
        })
    })
  }

  const itemprop = $card.find('[itemprop="recipeIngredient"]')
  if (itemprop.length && !sections.some((s) => s.lines.length > 0)) {
    const lines = []
    itemprop.each((_, el) => {
      const line = cleanLineText(textOneLine($, el))
      if (line) lines.push(line)
    })
    if (lines.length) sections.push({ heading: null, lines })
  }

  return sections.filter((s) => s.lines.length > 0)
}

/**
 * @param {import('cheerio').CheerioAPI} $
 * @param {cheerio.Element} card
 * @returns {IngredientSection[]}
 */
export function extractIngredientSections($, card) {
  if (!card) return []
  return (
    extractPluginIngredientSections($, card) ||
    extractFlatWprmIngredients($, card) ||
    extractHeadingWalkIngredientSections($, card) ||
    extractGenericIngredientSections($, card) ||
    []
  )
}

/**
 * @param {import('cheerio').CheerioAPI} $
 * @param {cheerio.Element} card
 * @returns {string[]}
 */
function extractPluginInstructions($, card) {
  const $card = $(card)
  /** @type {string[]} */
  const steps = []

  $card.find('.wprm-recipe-instruction-text').each((_, el) => {
    const t = cleanLineText(textOneLine($, el))
    if (t) steps.push(t)
  })
  if (steps.length) return steps

  for (const sel of ['.tasty-recipes-instructions li', '.mv-create-instructions li', '[itemprop="recipeInstructions"]']) {
    $card.find(sel).each((_, el) => {
      const t = cleanLineText(textOneLine($, el))
      if (t) steps.push(t)
    })
    if (steps.length) return steps
  }

  return []
}

/**
 * @param {import('cheerio').CheerioAPI} $
 * @param {cheerio.Element} card
 * @returns {string[]}
 */
function extractHeadingWalkInstructions($, card) {
  const $card = $(card)
  const heading = findSectionHeading($, $card, INSTRUCTION_HEADING_RE)
  if (!heading) return []

  /** @type {string[]} */
  const steps = []
  let $node = $(heading).next()
  let guard = 0

  while ($node.length && guard++ < 80) {
    if ($node.is('h1, h2, h3, h4, h5, h6, strong, b')) {
      const label = normalizeHeadingText($node.text())
      if (NOTES_HEADING_RE.test(label) || STOP_HEADING_RE.test(label)) break
      if (INGREDIENT_HEADING_RE.test(label)) break
    }

    if ($node.is('ol, ul')) {
      $node.find('li').each((_, li) => {
        const t = cleanLineText(textOneLine($, li))
        if (t) steps.push(t)
      })
      if (steps.length) break
    }

    if ($node.is('li')) {
      const t = cleanLineText(textOneLine($, $node))
      if (t) steps.push(t)
    }

    if ($node.is('p, div') && $node.find('li').length) {
      $node.find('li').each((_, li) => {
        const t = cleanLineText(textOneLine($, li))
        if (t) steps.push(t)
      })
      if (steps.length) break
    }

    $node = $node.next()
  }

  return steps
}

/**
 * @param {import('cheerio').CheerioAPI} $
 * @param {cheerio.Element} card
 * @returns {string[]}
 */
export function extractInstructions($, card) {
  if (!card) return []
  const plugin = extractPluginInstructions($, card)
  if (plugin.length) return plugin
  const walked = extractHeadingWalkInstructions($, card)
  if (walked.length) return walked

  const $card = $(card)
  /** @type {string[]} */
  const steps = []
  for (const sel of INSTRUCTION_ITEM_SELECTORS.split(', ')) {
    $card.find(sel).each((_, el) => {
      const t = cleanLineText(textOneLine($, el))
      if (t) steps.push(t)
    })
    if (steps.length) return steps
  }
  return steps
}

/**
 * @param {string[]} notes
 * @returns {string[]}
 */
function dedupeNotes(notes) {
  const out = []
  const seen = new Set()
  for (const n of notes) {
    const t = cleanLineText(n)
    if (!t || t.length < 4 || UI_NOISE_RE.test(t)) continue
    const key = t.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    out.push(t)
  }
  return out
}

/**
 * @param {import('cheerio').CheerioAPI} $
 * @param {cheerio.Element} card
 * @returns {string[]}
 */
function extractPluginNotes($, card) {
  const $card = $(card)
  /** @type {string[]} */
  const notes = []
  const selectors = [
    '.wprm-recipe-notes-container li',
    '.wprm-recipe-notes-container p',
    '.wprm-recipe-notes li',
    '.wprm-recipe-notes p',
    '.tasty-recipes-notes li',
    '.tasty-recipes-notes p',
    '.tasty-recipes-notes-body li',
    '.tasty-recipes-notes-body p',
    '.mv-create-notes li',
    '.mv-create-notes p',
    '.recipe-notes li',
    '.recipe-notes p',
    '.notes li',
    '.notes p',
    '.recipe-tips li',
    '.recipe-tips p',
    '.tips-notes li',
    '.tips-notes p',
    '.recipe-card-notes li',
    '.recipe-card-notes p',
  ]

  for (const sel of selectors) {
    $card.find(sel).each((_, el) => {
      const t = cleanLineText(textOneLine($, el))
      if (t) notes.push(t)
    })
    if (notes.length) return dedupeNotes(notes)
  }

  for (const sel of ['.wprm-recipe-notes-container', '.tasty-recipes-notes', '.mv-create-notes', '.recipe-notes', '.notes', '.recipe-tips', '.tips', '[class*="recipe-note"]', '[class*="tips"]']) {
    $card.find(sel).each((_, el) => {
      const t = cleanLineText(textOneLine($, el))
      if (t && t.length > 20) notes.push(t)
    })
    if (notes.length) return dedupeNotes(notes)
  }

  return []
}

/**
 * @param {import('cheerio').CheerioAPI} $
 * @param {cheerio.Element} card
 * @returns {string[]}
 */
function extractHeadingWalkNotes($, card) {
  const $card = $(card)
  const heading = findSectionHeading($, $card, NOTES_HEADING_RE)
  if (!heading) return []

  /** @type {string[]} */
  const notes = []
  let $node = $(heading).next()
  let guard = 0

  while ($node.length && guard++ < 40) {
    if ($node.is('h1, h2, h3, h4, h5, h6, strong, b')) {
      const label = normalizeHeadingText($node.text())
      if (STOP_HEADING_RE.test(label)) break
      if (INSTRUCTION_HEADING_RE.test(label) || INGREDIENT_HEADING_RE.test(label)) break
    }

    if ($node.is('ul, ol')) {
      $node.find('li').each((_, li) => {
        const t = cleanLineText(textOneLine($, li))
        if (t) notes.push(t)
      })
    } else if ($node.is('li')) {
      const t = cleanLineText(textOneLine($, $node))
      if (t) notes.push(t)
    } else if ($node.is('p, div')) {
      const t = cleanLineText(textOneLine($, $node))
      if (t && t.length <= 500) notes.push(t)
    }

    $node = $node.next()
  }

  return dedupeNotes(notes)
}

/**
 * @param {import('cheerio').CheerioAPI} $
 * @param {cheerio.Element} card
 * @returns {string[]}
 */
export function extractNotes($, card) {
  if (!card) return []
  const plugin = extractPluginNotes($, card)
  if (plugin.length) return plugin
  return extractHeadingWalkNotes($, card)
}

/**
 * @param {import('cheerio').CheerioAPI} $
 * @param {string} pageUrl
 * @param {string[]} warnings
 * @returns {{
 *   cardFound: boolean,
 *   card: cheerio.Element | null,
 *   ingredient_sections: IngredientSection[],
 *   ingredient_lines: string[],
 *   steps: string[],
 *   notes: string[],
 * }}
 */
export function extractRecipeCardData($, pageUrl, warnings) {
  void pageUrl
  const card = findRecipeCardContainer($)
  if (!card) {
    warnings.push('Recipe card container not found')
    return {
      cardFound: false,
      card: null,
      ingredient_sections: [],
      ingredient_lines: [],
      steps: [],
      notes: [],
    }
  }

  const ingredient_sections = extractIngredientSections($, card)
  const ingredient_lines = flattenIngredientSections(ingredient_sections)
  const steps = extractInstructions($, card)
  const notes = extractNotes($, card)

  if (!ingredient_sections.length) warnings.push('Ingredient groups not found in recipe card')
  if (!notes.length) warnings.push('Notes not found in recipe card')
  if (!steps.length) warnings.push('Instructions not found in recipe card')

  return {
    cardFound: true,
    card,
    ingredient_sections,
    ingredient_lines,
    steps,
    notes,
  }
}
