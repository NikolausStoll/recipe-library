const API_BASE = '/api'

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }))
    throw new Error((err as { error?: string }).error || res.statusText)
  }
  if (res.status === 204) return undefined as T
  return res.json()
}

export interface RecipeSource {
  id: number
  type: 'book' | 'url' | 'manual' | 'other'
  name: string
  subtitle: string | null
  url: string | null
  book_title: string | null
  author: string | null
  year: number | null
  image_path: string | null
  image_thumb_path?: string | null
  created_at: string
}

export interface RecipeSourceInput {
  type?: 'book' | 'url' | 'manual' | 'other'
  name: string
  subtitle?: string | null
  author?: string | null
  year?: number | null
  url?: string | null
}

export function listSources(): Promise<RecipeSource[]> {
  return fetch(`${API_BASE}/sources`).then((res) => handleResponse<RecipeSource[]>(res))
}

export function getSource(id: number): Promise<RecipeSource> {
  return fetch(`${API_BASE}/sources/${id}`).then((res) => handleResponse<RecipeSource>(res))
}

export function createSource(payload: RecipeSourceInput): Promise<RecipeSource> {
  return fetch(`${API_BASE}/sources`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  }).then((res) => handleResponse<RecipeSource>(res))
}

export function updateSource(id: number, payload: Partial<RecipeSourceInput>): Promise<RecipeSource> {
  return fetch(`${API_BASE}/sources/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  }).then((res) => handleResponse<RecipeSource>(res))
}

export function deleteSource(id: number): Promise<void> {
  return fetch(`${API_BASE}/sources/${id}`, { method: 'DELETE' }).then((res) =>
    handleResponse<void>(res)
  )
}

export async function uploadSourceCover(
  sourceId: number,
  imageFile: File,
  points?: Array<{ x: number; y: number }>
): Promise<{ source: RecipeSource; url: string }> {
  const form = new FormData()
  form.append('image', imageFile)
  if (points && points.length === 4) {
    form.append('points', JSON.stringify(points))
  }
  const res = await fetch(`${API_BASE}/sources/${sourceId}/cover`, { method: 'POST', body: form })
  return handleResponse(res)
}
