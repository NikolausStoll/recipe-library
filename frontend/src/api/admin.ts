const API_BASE = '/api'

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }))
    throw new Error((err as { error?: string }).error || res.statusText)
  }
  return res.json()
}

export interface ExtractUsageAdminRow {
  id: number
  recipe_id: number | null
  recipe_title: string | null
  prompt_tokens: number | null
  completion_tokens: number | null
  total_tokens: number | null
  response_json: string | null
  /** Raw JSON payload sent to the model (URL normalization); null for vision extract */
  request_json: string | null
  model: string | null
  /** What the call was: recipe_image_extract, url_recipe_normalize, health_score, … */
  usage_kind: string | null
  created_at: string | null
  pricing_key: string | null
  cost_usd: number | null
  cost_cents: number | null
}

export interface ExtractUsageAdminResponse {
  rows: ExtractUsageAdminRow[]
}

export function listAdminExtractUsage(): Promise<ExtractUsageAdminResponse> {
  return fetch(`${API_BASE}/admin/extract-usage`).then((res) => handleResponse<ExtractUsageAdminResponse>(res))
}

export interface CupGramReference {
  id: number
  ingredient: string
  cups: number
  grams: number
  note: string | null
  position: number
  created_at: string
  updated_at: string
}

export function listCupGramReferences(): Promise<{ references: CupGramReference[] }> {
  return fetch(`${API_BASE}/admin/cup-gram-references`).then((res) =>
    handleResponse<{ references: CupGramReference[] }>(res)
  )
}

export function createCupGramReference(body: {
  ingredient: string
  cups: number
  grams: number
  note?: string | null
}): Promise<CupGramReference> {
  return fetch(`${API_BASE}/admin/cup-gram-references`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }).then((res) => handleResponse<CupGramReference>(res))
}

export function updateCupGramReference(
  id: number,
  body: Partial<{ ingredient: string; cups: number; grams: number; note: string | null }>
): Promise<CupGramReference> {
  return fetch(`${API_BASE}/admin/cup-gram-references/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }).then((res) => handleResponse<CupGramReference>(res))
}

export async function deleteCupGramReference(id: number): Promise<void> {
  const res = await fetch(`${API_BASE}/admin/cup-gram-references/${id}`, { method: 'DELETE' })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }))
    throw new Error((err as { error?: string }).error || res.statusText)
  }
}
