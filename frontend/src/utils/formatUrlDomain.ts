/** Extract display domain from a URL (strips www.). */
export function formatUrlDomain(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./i, '')
  } catch {
    const trimmed = url.trim()
    return trimmed.replace(/^https?:\/\//i, '').replace(/^www\./i, '').split('/')[0] || trimmed
  }
}
