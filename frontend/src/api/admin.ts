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
  extract_kind: string | null
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
