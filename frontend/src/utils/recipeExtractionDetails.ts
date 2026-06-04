import type { RecipeFormInitial } from './recipeFormInitial'

export type ExtractionDetailRow = { label: string; value: string }

export function hasRecipeExtractionDetails(
  initial: RecipeFormInitial | null | undefined
): boolean {
  if (!initial) return false
  if (initial.import_method === 'url' || initial.import_method === 'image') return true
  if (initial.extract_confidence != null && !Number.isNaN(initial.extract_confidence)) return true
  if ((initial.extract_missing_fields?.length ?? 0) > 0) return true
  if ((initial.extract_warnings?.length ?? 0) > 0) return true
  if (initial.extract_status === 'done' || initial.extract_status === 'failed') return true
  return false
}

export function formatExtractionSourceLabel(importMethod: string | null | undefined): string | null {
  switch (importMethod) {
    case 'url':
      return 'Website (JSON-LD / HTML)'
    case 'image':
      return 'Bild (KI-Vision)'
    case 'manual':
      return 'Manuell'
    default:
      return importMethod?.trim() ? importMethod : null
  }
}

function formatImportedAt(createdAt: string | null | undefined): string | null {
  if (!createdAt?.trim()) return null
  const d = new Date(createdAt)
  if (Number.isNaN(d.getTime())) return createdAt
  return d.toLocaleString('de-DE', {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
}

function formatOriginalUrlLine(initial: RecipeFormInitial): string | null {
  const url = initial.original_url?.trim()
  if (url) return url
  const domain = initial.source_domain?.trim()
  if (domain) return domain
  return null
}

/** Rows for the extraction-details overlay (German labels). */
export function buildExtractionDetailRows(initial: RecipeFormInitial): ExtractionDetailRow[] {
  const rows: ExtractionDetailRow[] = []

  const source = formatExtractionSourceLabel(initial.import_method)
  if (
    source &&
    (initial.import_method === 'url' ||
      initial.import_method === 'image' ||
      initial.extract_confidence != null ||
      initial.extract_status ||
      (initial.extract_missing_fields?.length ?? 0) > 0)
  ) {
    rows.push({ label: 'Extraktionsquelle', value: source })
  }

  if (initial.extract_confidence != null && !Number.isNaN(initial.extract_confidence)) {
    rows.push({
      label: 'Sicherheit',
      value: `${Math.round(initial.extract_confidence * 100)} %`,
    })
  }

  if (initial.extract_missing_fields?.length) {
    rows.push({
      label: 'Fehlende Felder',
      value: initial.extract_missing_fields.join(', '),
    })
  }

  if (initial.extract_warnings?.length) {
    rows.push({
      label: 'Hinweise',
      value: initial.extract_warnings.join(' · '),
    })
  }

  const importedAt = formatImportedAt(initial.created_at)
  if (importedAt) {
    rows.push({ label: 'Importiert am', value: importedAt })
  }

  const urlLine = formatOriginalUrlLine(initial)
  if (urlLine && initial.import_method === 'url') {
    rows.push({ label: 'Original-URL', value: urlLine })
  }

  return rows
}
