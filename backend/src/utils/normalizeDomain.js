/**
 * Normalize a URL or hostname to a stable domain key for website source deduplication.
 * Strips scheme, path, query, and leading www.
 * Keeps mobile subdomains (e.g. m.example.com) as-is.
 * @param {string} input
 * @returns {string}
 */
export function normalizeDomainFromUrl(input) {
  const trimmed = input != null ? String(input).trim() : ''
  if (!trimmed) return ''

  try {
    const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`
    const host = new URL(withProtocol).hostname.toLowerCase()
    return host.replace(/^www\./i, '')
  } catch {
    const host = trimmed
      .replace(/^https?:\/\//i, '')
      .replace(/^www\./i, '')
      .split('/')[0]
      .split('?')[0]
      .split('#')[0]
      .toLowerCase()
    return host
  }
}

/**
 * @param {string} domain
 * @returns {string}
 */
export function canonicalWebsiteSourceUrl(domain) {
  const d = normalizeDomainFromUrl(domain)
  if (!d) return ''
  return `https://${d}`
}

/**
 * Optional favicon URL (no server fetch; browser loads icon).
 * @param {string} domain
 * @returns {string | null}
 */
export function faviconUrlForDomain(domain) {
  const d = normalizeDomainFromUrl(domain)
  if (!d) return null
  return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(d)}&sz=64`
}

/**
 * @param {string | null | undefined} url
 * @returns {boolean}
 */
export function urlLooksLikeRecipePage(url) {
  const u = url != null ? String(url).trim() : ''
  if (!u) return false
  try {
    const parsed = new URL(/^https?:\/\//i.test(u) ? u : `https://${u}`)
    return parsed.pathname.length > 1
  } catch {
    return u.includes('/')
  }
}
