/**
 * Fetch a recipe page and extract raw recipe fields (no LLM, no normalization).
 * Strategy: prefer schema.org JSON-LD Recipe; merge HTML heuristics for missing parts.
 */

import * as cheerio from 'cheerio'
import {
  countSectionLines,
  extractRecipeCardData,
  flattenIngredientSections,
  shouldAcceptHtmlIngredientSections,
  textOneLine,
} from './recipeHtmlEnrichment.js'

const DEFAULT_TIMEOUT_MS = Number(process.env.RECIPE_URL_FETCH_TIMEOUT_MS) || 25_000
const DEFAULT_MAX_BYTES = Number(process.env.RECIPE_URL_MAX_BYTES) || 2_000_000
const DEFAULT_USER_AGENT =
  process.env.RECIPE_URL_USER_AGENT || 'RecipeLibrary/1.0 (+https://github.com/recipe-library; recipe URL fetch)'

function emptyRawRecipe() {
  return {
    title: null,
    description: null,
    servings_raw: null,
    prep_time_min: null,
    cook_time_min: null,
    total_time_min: null,
    ingredient_lines: [],
    ingredient_sections: [],
    steps: [],
    notes: [],
    image_urls: [],
  }
}

/**
 * @returns {{ ok: true, url: string } | { ok: false, error: string }}
 */
function assertSafeHttpUrl(urlString) {
  let u
  try {
    u = new URL(urlString)
  } catch {
    return { ok: false, error: 'Invalid URL' }
  }
  if (!/^https?:$/i.test(u.protocol)) {
    return { ok: false, error: 'Only http and https URLs are allowed' }
  }
  const host = u.hostname.toLowerCase()
  if (host === 'localhost' || host === '::1' || host.endsWith('.localhost')) {
    return { ok: false, error: 'This host is not allowed' }
  }
  if (host === '0.0.0.0') {
    return { ok: false, error: 'This host is not allowed' }
  }
  const ipv4 = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/)
  if (ipv4) {
    const a = Number(ipv4[1])
    const b = Number(ipv4[2])
    if (a === 10 || a === 127 || a === 0) return { ok: false, error: 'This host is not allowed' }
    if (a === 172 && b >= 16 && b <= 31) return { ok: false, error: 'This host is not allowed' }
    if (a === 192 && b === 168) return { ok: false, error: 'This host is not allowed' }
    if (a === 169 && b === 254) return { ok: false, error: 'This host is not allowed' }
  }
  if (host.includes(':')) {
    const h = host.replace(/^\[|\]$/g, '')
    if (h === '::1' || h.toLowerCase().startsWith('fe80:')) {
      return { ok: false, error: 'This host is not allowed' }
    }
  }
  return { ok: true, url: u.toString() }
}

function resolveUrlMaybeRelative(href, baseUrl) {
  if (!href || typeof href !== 'string') return null
  try {
    return new URL(href.trim(), baseUrl).toString()
  } catch {
    return null
  }
}

/**
 * Infer pixel count from URL path/query (WordPress -WxH, ?w=&h=, Cloudinary w_,h_, etc.).
 * @param {string} urlString
 * @returns {number}
 */
function inferPixelAreaFromUrl(urlString) {
  try {
    const u = new URL(urlString)
    const full = u.pathname + u.search

    const qp = u.searchParams
    const w = qp.get('w') || qp.get('width') || qp.get('resizeWidth') || qp.get('wid')
    const h = qp.get('h') || qp.get('height') || qp.get('resizeHeight')
    if (w && h) {
      const wi = parseInt(w, 10)
      const hi = parseInt(h, 10)
      if (wi > 0 && hi > 0) return wi * hi
    }
    if (w && !h) {
      const wi = parseInt(w, 10)
      if (wi > 0) return wi * wi
    }

    const cloud = full.match(/[/,]w_(\d{1,5})[/,]h_(\d{1,5})/i) || full.match(/w_(\d{1,5}).*h_(\d{1,5})/i)
    if (cloud) {
      const wi = parseInt(cloud[1], 10)
      const hi = parseInt(cloud[2], 10)
      if (wi > 0 && hi > 0) return wi * hi
    }

    const wxh = full.match(/(\d{1,5})[x×](\d{1,5})/gi)
    if (wxh && wxh.length) {
      let best = 0
      for (const m of wxh) {
        const parts = m.toLowerCase().split(/[x×]/)
        if (parts.length === 2) {
          const wi = parseInt(parts[0], 10)
          const hi = parseInt(parts[1], 10)
          if (wi > 0 && hi > 0) best = Math.max(best, wi * hi)
        }
      }
      if (best > 0) return best
    }

    const widthOnly = qp.get('width') || qp.get('maxwidth') || qp.get('max_width')
    if (widthOnly) {
      const wi = parseInt(widthOnly, 10)
      if (wi > 0) return wi * wi
    }

    return 0
  } catch {
    return 0
  }
}

/**
 * Cluster key: same logical image at different sizes (host + path with size tokens stripped).
 * @param {string} urlString
 * @returns {string}
 */
function imageUrlClusterKey(urlString) {
  try {
    const u = new URL(urlString)
    let path = u.pathname
    path = path.replace(/-\d{1,5}[x×]\d{1,5}(?=\.[^./]+$)/gi, '')
    path = path.replace(/[_]\d{1,5}[x×]\d{1,5}(?=\.[^./]+$)/gi, '')
    path = path.replace(/-\d{1,5}w(?=\.[^./]+$)/gi, '')
    path = path.replace(/-scaled(?=\.[^./]+$)/gi, '')
    path = path.replace(/@\d{1,5}w(?=\.[^./]+$)/gi, '')
    path = path.replace(/\/?\d{1,5}[x×]\d{1,5}\//g, '/')
    return `${u.hostname.toLowerCase()}${path}`
  } catch {
    return urlString
  }
}

/**
 * Deduplicate URLs that point to the same asset at different resolutions; keep the largest per group.
 * Order follows first-seen distinct groups in the input.
 * @param {string[]} urls
 * @returns {string[]}
 */
function dedupeImageUrlsByBestResolution(urls, areaHints = null) {
  if (!Array.isArray(urls) || urls.length === 0) return []

  const valid = [...new Set(urls.filter((u) => typeof u === 'string' && u.trim()).map((u) => u.trim()))]
  if (valid.length === 0) return []

  /** @type {string[]} */
  const order = []
  const seenOrder = new Set()
  /** @type {Map<string, string>} */
  const bestByKey = new Map()

  const areaFor = (url) => {
    const hinted = areaHints?.get(url)
    if (hinted && hinted > 0) return hinted
    return inferPixelAreaFromUrl(url)
  }

  for (const url of valid) {
    const key = imageUrlClusterKey(url)
    if (!seenOrder.has(key)) {
      seenOrder.add(key)
      order.push(key)
    }
    const area = areaFor(url)
    const prev = bestByKey.get(key)
    if (!prev) {
      bestByKey.set(key, url)
      continue
    }
    const prevArea = areaFor(prev)
    if (area > prevArea) {
      bestByKey.set(key, url)
    } else if (area === prevArea && url.length > prev.length) {
      bestByKey.set(key, url)
    }
  }

  return order.map((k) => bestByKey.get(k))
}

function collectImageUrls(image, baseUrl, areaHints = null) {
  const out = []
  if (!image) return out
  if (typeof image === 'string') {
    const u = resolveUrlMaybeRelative(image, baseUrl)
    if (u) out.push(u)
    return out
  }
  if (Array.isArray(image)) {
    for (const item of image) out.push(...collectImageUrls(item, baseUrl, areaHints))
    return [...new Set(out)]
  }
  if (typeof image === 'object') {
    let nodeArea = 0
    const w = parseInt(image.width, 10)
    const h = parseInt(image.height, 10)
    if (w > 0 && h > 0) nodeArea = w * h
    const urls = []
    if (image.url) urls.push(...collectImageUrls(image.url, baseUrl, areaHints))
    if (Array.isArray(image['@graph'])) {
      for (const g of image['@graph']) urls.push(...collectImageUrls(g, baseUrl, areaHints))
    }
    if (areaHints && nodeArea > 0) {
      for (const u of urls) {
        const prev = areaHints.get(u) ?? 0
        if (nodeArea > prev) areaHints.set(u, nodeArea)
      }
    }
    return [...new Set([...out, ...urls])]
  }
  return [...new Set(out)]
}

/**
 * Parse srcset attribute; returns absolute URLs (largest width descriptor preferred when tied).
 * @param {string | undefined} srcset
 * @param {string} baseUrl
 * @returns {string[]}
 */
function parseSrcsetUrls(srcset, baseUrl) {
  if (!srcset || typeof srcset !== 'string') return []
  const entries = srcset
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean)
  const parsed = []
  for (const entry of entries) {
    const pieces = entry.split(/\s+/)
    const href = pieces[0]
    const u = resolveUrlMaybeRelative(href, baseUrl)
    if (!u) continue
    let width = 0
    if (pieces[1]) {
      const m = pieces[1].match(/^(\d+)(w|x)?$/i)
      if (m) width = parseInt(m[1], 10)
    }
    parsed.push({ url: u, width })
  }
  parsed.sort((a, b) => b.width - a.width)
  return [...new Set(parsed.map((p) => p.url))]
}

function pushResolvedImageUrl(raw, href, baseUrl) {
  const u = resolveUrlMaybeRelative(href, baseUrl)
  if (u) raw.image_urls.push(u)
}

function isRecipeType(t) {
  if (t === 'Recipe') return true
  if (typeof t === 'string') {
    const lower = t.toLowerCase()
    return lower === 'recipe' || lower.endsWith('/recipe') || lower.endsWith('#recipe')
  }
  if (Array.isArray(t)) return t.some(isRecipeType)
  return false
}

function* walkJsonLdNodes(data) {
  if (data == null) return
  if (Array.isArray(data)) {
    for (const x of data) yield* walkJsonLdNodes(x)
  } else if (typeof data === 'object') {
    if (Array.isArray(data['@graph'])) {
      yield* walkJsonLdNodes(data['@graph'])
    } else {
      yield data
    }
  }
}

function collectRecipeNodesFromJsonValue(parsed) {
  const recipes = []
  for (const node of walkJsonLdNodes(parsed)) {
    if (node && typeof node === 'object' && isRecipeType(node['@type'])) {
      recipes.push(node)
    }
  }
  return recipes
}

/** ISO 8601 duration → total minutes (recipes: PT45M, PT1H30M, P1DT2H, etc.) */
export function isoDurationToMinutes(iso) {
  if (iso == null) return null
  if (typeof iso === 'number' && Number.isFinite(iso)) return Math.max(0, Math.round(iso))
  const s = String(iso).trim()
  if (!s) return null
  if (!/^P/i.test(s)) return null
  let totalMin = 0
  const weekM = s.match(/(\d+)W/i)
  if (weekM) totalMin += parseInt(weekM[1], 10) * 7 * 24 * 60
  const dayM = s.match(/(\d+)D/i)
  if (dayM) totalMin += parseInt(dayM[1], 10) * 24 * 60
  const tIdx = s.indexOf('T')
  if (tIdx !== -1) {
    const t = s.slice(tIdx + 1)
    const hM = t.match(/(\d+)H/i)
    const mM = t.match(/(\d+)M/i)
    const sM = t.match(/(\d+)S/i)
    if (hM) totalMin += parseInt(hM[1], 10) * 60
    if (mM) totalMin += parseInt(mM[1], 10)
    if (sM) totalMin += Math.round(parseInt(sM[1], 10) / 60)
  }
  return totalMin > 0 ? totalMin : null
}

function yieldToRaw(yieldVal) {
  if (yieldVal == null) return null
  if (typeof yieldVal === 'string') return yieldVal.trim() || null
  if (Array.isArray(yieldVal)) {
    const parts = yieldVal
      .map((x) => yieldToRaw(x))
      .filter(Boolean)
    return parts.length ? parts.join('; ') : null
  }
  if (typeof yieldVal === 'object' && yieldVal.text != null) {
    return String(yieldVal.text).trim() || null
  }
  return null
}

function normalizeIngredientLines(raw) {
  if (raw == null) return []
  if (typeof raw === 'string') {
    const lines = raw
      .split(/\n+/)
      .map((l) => l.replace(/\s+/g, ' ').trim())
      .filter(Boolean)
    return lines.length ? lines : [raw.trim()].filter(Boolean)
  }
  if (!Array.isArray(raw)) return []
  const out = []
  for (const item of raw) {
    if (typeof item === 'string') {
      const t = item.replace(/\s+/g, ' ').trim()
      if (t) out.push(t)
    } else if (item && typeof item === 'object') {
      if (item.name) {
        const t = String(item.name).replace(/\s+/g, ' ').trim()
        if (t) out.push(t)
      } else if (item.text) {
        const t = String(item.text).replace(/\s+/g, ' ').trim()
        if (t) out.push(t)
      }
    }
  }
  return out
}

function normalizeInstructions(raw, baseUrl) {
  if (raw == null) return []
  if (typeof raw === 'string') {
    return raw
      .split(/\n+/)
      .map((l) => l.replace(/\s+/g, ' ').trim())
      .filter(Boolean)
  }
  if (!Array.isArray(raw)) {
    if (typeof raw === 'object' && raw.text) {
      return normalizeInstructions(raw.text, baseUrl)
    }
    if (typeof raw === 'object' && raw.itemListElement) {
      return normalizeInstructions(raw.itemListElement, baseUrl)
    }
    return []
  }
  const out = []
  for (const item of raw) {
    if (typeof item === 'string') {
      out.push(...normalizeInstructions(item, baseUrl))
    } else if (item && typeof item === 'object') {
      const type = item['@type']
      if (type === 'HowToSection' || (Array.isArray(type) && type.includes('HowToSection'))) {
        if (item.itemListElement) out.push(...normalizeInstructions(item.itemListElement, baseUrl))
        continue
      }
      if (type === 'ItemList' || (Array.isArray(type) && type.includes('ItemList'))) {
        const elements = item.itemListElement || []
        for (const el of elements) {
          if (el && typeof el === 'object') {
            if (el.text) {
              const t = String(el.text).replace(/\s+/g, ' ').trim()
              if (t) out.push(t)
            } else {
              const step = el.item || el
              out.push(...normalizeInstructions(step, baseUrl))
            }
          }
        }
        continue
      }
      if (item.text) {
        const t = String(item.text).replace(/\s+/g, ' ').trim()
        if (t) out.push(t)
      } else if (item.name && (type === 'HowToStep' || (Array.isArray(type) && type.includes('HowToStep')))) {
        const t = String(item.name).replace(/\s+/g, ' ').trim()
        if (t) out.push(t)
      } else if (item.itemListElement) {
        out.push(...normalizeInstructions(item.itemListElement, baseUrl))
      }
    }
  }
  return out.filter(Boolean)
}

function scoreJsonLdRecipe(node) {
  const ing = normalizeIngredientLines(node.recipeIngredient)
  const steps = normalizeInstructions(node.recipeInstructions, '')
  let s = 0
  if (node.name) s += 3
  if (node.description) s += 1
  s += ing.length * 2
  s += steps.length * 2
  return s
}

function recipeNodeToRaw(node, pageUrl, areaHints = null) {
  const raw = emptyRawRecipe()
  if (!node) return raw
  if (node.name) raw.title = String(node.name).replace(/\s+/g, ' ').trim() || null
  if (node.description) {
    raw.description =
      typeof node.description === 'string'
        ? node.description.replace(/\s+/g, ' ').trim() || null
        : String(node.description).replace(/\s+/g, ' ').trim() || null
  }
  raw.servings_raw = yieldToRaw(node.recipeYield)
  raw.prep_time_min = isoDurationToMinutes(node.prepTime)
  raw.cook_time_min = isoDurationToMinutes(node.cookTime)
  raw.total_time_min = isoDurationToMinutes(node.totalTime)
  raw.ingredient_lines = normalizeIngredientLines(node.recipeIngredient)
  raw.steps = normalizeInstructions(node.recipeInstructions, pageUrl)
  raw.image_urls = collectImageUrls(node.image, pageUrl, areaHints)
  return raw
}

function extractJsonLdRecipes(html, pageUrl, warnings, areaHints = null) {
  const $ = cheerio.load(html)
  const candidates = []
  $('script[type="application/ld+json"]').each((_, el) => {
    const text = $(el).text()
    if (!text || !text.trim()) return
    try {
      const parsed = JSON.parse(text)
      const recipes = collectRecipeNodesFromJsonValue(parsed)
      for (const r of recipes) candidates.push(r)
    } catch (e) {
      warnings.push('Skipped one JSON-LD block: invalid JSON')
    }
  })
  if (!candidates.length) return { raw: emptyRawRecipe(), picked: null }
  candidates.sort((a, b) => scoreJsonLdRecipe(b) - scoreJsonLdRecipe(a))
  const picked = candidates[0]
  return { raw: recipeNodeToRaw(picked, pageUrl, areaHints), picked }
}

function extractPageMeta($, pageUrl, raw) {
  raw.title =
    $('meta[property="og:title"]').attr('content')?.trim() ||
    $('meta[name="twitter:title"]').attr('content')?.trim() ||
    $('title').first().text().replace(/\s+/g, ' ').trim() ||
    null
  if (!raw.title || raw.title.length > 200) {
    const h1 = $('h1').first()
    if (h1.length) raw.title = textOneLine($, h1) || raw.title
  }

  raw.description =
    $('meta[name="description"]').attr('content')?.trim() ||
    $('meta[property="og:description"]').attr('content')?.trim() ||
    null

  $('meta[property="og:image"], meta[property="og:image:secure_url"], meta[property="og:image:url"]').each(
    (_, el) => {
      pushResolvedImageUrl(raw, $(el).attr('content'), pageUrl)
    }
  )
  $('meta[name="twitter:image"], meta[name="twitter:image:src"]').each((_, el) => {
    pushResolvedImageUrl(raw, $(el).attr('content'), pageUrl)
  })
  $('link[rel="image_src"]').each((_, el) => {
    pushResolvedImageUrl(raw, $(el).attr('href'), pageUrl)
  })

  const recipeImgSel =
    '.wprm-recipe-image img, [itemtype*="Recipe"] img, .recipe-image img, article img[itemprop="image"]'
  $(recipeImgSel).each((_, el) => {
    pushResolvedImageUrl(raw, $(el).attr('src'), pageUrl)
    pushResolvedImageUrl(raw, $(el).attr('data-src'), pageUrl)
    const srcset = $(el).attr('srcset') || $(el).attr('data-srcset')
    for (const u of parseSrcsetUrls(srcset, pageUrl)) raw.image_urls.push(u)
  })
}

function extractHtmlHeuristics(html, pageUrl, warnings) {
  const $ = cheerio.load(html)
  const raw = emptyRawRecipe()
  extractPageMeta($, pageUrl, raw)

  const cardData = extractRecipeCardData($, pageUrl, warnings)
  raw.ingredient_sections = cardData.ingredient_sections
  raw.ingredient_lines = cardData.ingredient_lines
  raw.steps = cardData.steps
  raw.notes = cardData.notes

  if (cardData.cardFound && cardData.card) {
    const cardTitle = textOneLine($, $(cardData.card).find('.wprm-recipe-name, [itemprop="name"], h2').first())
    if (cardTitle && (!raw.title || raw.title.length > 120)) raw.title = cardTitle
  }

  raw.image_urls = [...new Set(raw.image_urls)]
  if (!raw.ingredient_lines.length && !raw.steps.length && !raw.title) {
    warnings.push('HTML heuristics found little or no recipe content')
  }
  return raw
}

function mergePreferStructured(structured, html) {
  const out = emptyRawRecipe()
  out.title = structured.title || html.title || null
  out.description = structured.description || html.description || null
  out.servings_raw = structured.servings_raw || html.servings_raw || null
  out.prep_time_min = structured.prep_time_min ?? html.prep_time_min ?? null
  out.cook_time_min = structured.cook_time_min ?? html.cook_time_min ?? null
  out.total_time_min = structured.total_time_min ?? html.total_time_min ?? null
  out.ingredient_lines =
    structured.ingredient_lines.length > 0 ? structured.ingredient_lines : [...html.ingredient_lines]
  out.ingredient_sections =
    html.ingredient_sections.length > 0 ? html.ingredient_sections.map((s) => ({ ...s, lines: [...s.lines] })) : []
  out.steps = structured.steps.length > 0 ? structured.steps : [...html.steps]
  out.notes = html.notes.length > 0 ? [...html.notes] : []
  out.image_urls = [...new Set([...structured.image_urls, ...html.image_urls])]
  return out
}

/**
 * Apply HTML enrichment on top of JSON-LD merge: grouped ingredients, notes, HTML-only threshold.
 * @param {ReturnType<typeof emptyRawRecipe>} merged
 * @param {ReturnType<typeof emptyRawRecipe>} fromLd
 * @param {ReturnType<typeof emptyRawRecipe>} fromHtml
 * @param {unknown} jsonLdPicked
 * @param {string[]} warnings
 */
function applyHtmlEnrichment(merged, fromLd, fromHtml, jsonLdPicked, warnings) {
  const htmlSections = fromHtml.ingredient_sections || []
  const htmlLineCount = countSectionLines(htmlSections)
  const ldCount = fromLd.ingredient_lines.length

  if (htmlSections.length > 0 && htmlLineCount > 0) {
    if (jsonLdPicked) {
      if (shouldAcceptHtmlIngredientSections(htmlLineCount, ldCount, warnings)) {
        merged.ingredient_sections = htmlSections.map((s) => ({ heading: s.heading, lines: [...s.lines] }))
        merged.ingredient_lines = flattenIngredientSections(merged.ingredient_sections)
      } else if (ldCount > 0) {
        merged.ingredient_sections = [{ heading: null, lines: [...merged.ingredient_lines] }]
      }
    } else if (htmlLineCount >= 2 && merged.steps.length >= 2) {
      merged.ingredient_sections = htmlSections.map((s) => ({ heading: s.heading, lines: [...s.lines] }))
      merged.ingredient_lines = flattenIngredientSections(merged.ingredient_sections)
    }
  } else if (merged.ingredient_lines.length > 0 && !merged.ingredient_sections.length) {
    merged.ingredient_sections = [{ heading: null, lines: [...merged.ingredient_lines] }]
  }

  if (fromHtml.notes?.length) {
    merged.notes = [...fromHtml.notes]
  }

  if (!jsonLdPicked) {
    warnings.push('JSON-LD missing')
    const ok =
      Boolean(merged.title?.trim()) && merged.ingredient_lines.length >= 2 && merged.steps.length >= 2
    if (!ok) warnings.push('HTML-only extraction threshold not met')
  }
}

function hasUsefulContent(raw) {
  return Boolean(
    raw.title ||
      raw.description ||
      raw.ingredient_lines.length ||
      raw.steps.length ||
      raw.servings_raw
  )
}

function determineSource(jsonLdPicked, fromLd, fromHtml, merged) {
  if (!jsonLdPicked) {
    const ok =
      Boolean(merged.title?.trim()) && merged.ingredient_lines.length >= 2 && merged.steps.length >= 2
    return ok ? 'html' : 'none'
  }
  const htmlFilledGaps =
    (fromLd.ingredient_lines.length === 0 && fromHtml.ingredient_lines.length > 0) ||
    (fromLd.steps.length === 0 && fromHtml.steps.length > 0) ||
    (!fromLd.title && fromHtml.title) ||
    (!fromLd.description && fromHtml.description) ||
    (!fromLd.servings_raw && fromHtml.servings_raw) ||
    (fromLd.image_urls.length === 0 && fromHtml.image_urls.length > 0) ||
    (fromHtml.notes?.length > 0) ||
    (fromHtml.ingredient_sections?.length > 1) ||
    (countSectionLines(fromHtml.ingredient_sections) > 0 &&
      shouldAcceptHtmlIngredientSections(
        countSectionLines(fromHtml.ingredient_sections),
        fromLd.ingredient_lines.length,
        []
      ) &&
      fromHtml.ingredient_sections.some((s) => s.heading))
  if (htmlFilledGaps) return 'jsonld+html'
  return 'jsonld'
}

/**
 * Fetch URL and extract raw recipe data.
 * @param {string} urlString
 * @returns {Promise<{
 *   source: 'jsonld' | 'jsonld+html' | 'html' | 'none',
 *   warnings: string[],
 *   fetched_url: string,
 *   recipe: ReturnType<typeof emptyRawRecipe>
 * }>}
 */
export async function extractRecipeFromUrl(urlString) {
  const warnings = []
  const check = assertSafeHttpUrl(String(urlString || '').trim())
  if (!check.ok) {
    return {
      source: 'none',
      warnings: [check.error],
      fetched_url: '',
      recipe: emptyRawRecipe(),
    }
  }
  const targetUrl = check.url

  let res
  const controller = new AbortController()
  const t = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS)
  try {
    res = await fetch(targetUrl, {
      signal: controller.signal,
      redirect: 'follow',
      headers: {
        'User-Agent': DEFAULT_USER_AGENT,
        Accept: 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
      },
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    warnings.push(`Fetch failed: ${msg}`)
    return { source: 'none', warnings, fetched_url: targetUrl, recipe: emptyRawRecipe() }
  } finally {
    clearTimeout(t)
  }

  if (!res.ok) {
    warnings.push(`HTTP ${res.status} ${res.statusText || ''}`.trim())
    return { source: 'none', warnings, fetched_url: res.url || targetUrl, recipe: emptyRawRecipe() }
  }

  const contentType = res.headers.get('content-type') || ''
  if (!/text\/html|application\/xhtml\+xml/i.test(contentType)) {
    warnings.push(`Unexpected content-type: ${contentType || 'unknown'}; expected HTML`)
  }

  let buf
  try {
    buf = await res.arrayBuffer()
  } catch (e) {
    warnings.push(`Reading response failed: ${e instanceof Error ? e.message : String(e)}`)
    return { source: 'none', warnings, fetched_url: res.url || targetUrl, recipe: emptyRawRecipe() }
  }

  if (buf.byteLength > DEFAULT_MAX_BYTES) {
    warnings.push(`Response larger than ${DEFAULT_MAX_BYTES} bytes; refusing to parse`)
    return { source: 'none', warnings, fetched_url: res.url || targetUrl, recipe: emptyRawRecipe() }
  }

  const finalUrl = res.url || targetUrl
  let html
  try {
    html = new TextDecoder('utf-8', { fatal: false }).decode(buf)
  } catch {
    warnings.push('Could not decode response as UTF-8')
    return { source: 'none', warnings, fetched_url: finalUrl, recipe: emptyRawRecipe() }
  }

  const areaHints = new Map()
  const { raw: fromLd, picked } = extractJsonLdRecipes(html, finalUrl, warnings, areaHints)
  const fromHtml = extractHtmlHeuristics(html, finalUrl, warnings)
  const merged = mergePreferStructured(fromLd, fromHtml)
  applyHtmlEnrichment(merged, fromLd, fromHtml, picked, warnings)
  merged.image_urls = dedupeImageUrlsByBestResolution(merged.image_urls, areaHints)

  let source = determineSource(picked, fromLd, fromHtml, merged)
  if (!hasUsefulContent(merged)) {
    source = 'none'
    warnings.push('No recipe content could be extracted from this page')
  } else if (!picked) {
    const ok =
      Boolean(merged.title?.trim()) && merged.ingredient_lines.length >= 2 && merged.steps.length >= 2
    if (!ok) source = 'none'
  }

  return {
    source,
    warnings,
    fetched_url: finalUrl,
    recipe: merged,
  }
}

/**
 * Test helper: parse HTML string without network fetch.
 * @param {string} html
 * @param {string} pageUrl
 */
export function scrapeRecipeFromHtmlForTest(html, pageUrl) {
  const warnings = []
  const areaHints = new Map()
  const { raw: fromLd, picked } = extractJsonLdRecipes(html, pageUrl, warnings, areaHints)
  const fromHtml = extractHtmlHeuristics(html, pageUrl, warnings)
  const merged = mergePreferStructured(fromLd, fromHtml)
  applyHtmlEnrichment(merged, fromLd, fromHtml, picked, warnings)
  merged.image_urls = dedupeImageUrlsByBestResolution(merged.image_urls, areaHints)

  let source = determineSource(picked, fromLd, fromHtml, merged)
  if (!hasUsefulContent(merged)) {
    source = 'none'
    warnings.push('No recipe content could be extracted from this page')
  } else if (!picked) {
    const ok =
      Boolean(merged.title?.trim()) && merged.ingredient_lines.length >= 2 && merged.steps.length >= 2
    if (!ok) source = 'none'
  }

  return { source, warnings, fetched_url: pageUrl, recipe: merged }
}
