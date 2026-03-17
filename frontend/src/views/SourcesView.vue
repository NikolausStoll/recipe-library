<template>
  <div class="view view--sources">
    <h1>Buchquellen</h1>
    <p class="view__intro">Quellen (z. B. Kochbücher) verwalten. Rezepte können einer Quelle zugeordnet werden.</p>

    <!-- Form: add or edit -->
    <section v-if="formOpen" class="sources-form">
      <h2 class="sources-form__title">{{ editingId ? 'Buchquelle bearbeiten' : 'Neue Buchquelle' }}</h2>
      <form class="form" @submit.prevent="saveSource">
        <div class="form__row">
          <label class="form__label" for="src-name">Titel *</label>
          <input id="src-name" v-model="form.name" type="text" class="form__input" required />
        </div>
        <div class="form__row">
          <label class="form__label" for="src-subtitle">Untertitel</label>
          <input id="src-subtitle" v-model="form.subtitle" type="text" class="form__input" />
        </div>
        <div class="form__row form__row--inline">
          <div>
            <label class="form__label" for="src-author">Autor</label>
            <input id="src-author" v-model="form.author" type="text" class="form__input" />
          </div>
          <div>
            <label class="form__label" for="src-year">Jahr</label>
            <input id="src-year" v-model.number="form.year" type="number" class="form__input" min="1" max="2100" placeholder="z. B. 2020" />
          </div>
        </div>
        <div class="form__actions">
          <button type="submit" class="btn btn--primary" :disabled="saving">
            {{ saving ? 'Speichern…' : 'Speichern' }}
          </button>
          <button type="button" class="btn btn--secondary" @click="closeForm">Abbrechen</button>
        </div>
        <p v-if="formError" class="form__error">{{ formError }}</p>
      </form>

      <!-- Cover / picture upload: always shown in form (for new: upload after first save) -->
      <div v-if="formOpen" class="sources-form__cover">
        <h3 class="sources-form__cover-title">Buchcover / Bild</h3>
        <div v-if="editingId && currentSource?.image_path" class="sources-form__cover-current">
          <img :src="coverDisplayUrl" alt="Cover" class="sources-form__cover-img" />
          <span class="sources-form__cover-hint">Neues Bild wählen zum Ersetzen</span>
        </div>
        <div v-if="!coverFile && (!editingId || !currentSource?.image_path)" class="sources-form__cover-upload">
          <input
            ref="coverInputRef"
            type="file"
            accept="image/*"
            class="form__file"
            @change="onCoverFileSelected"
          />
          <button type="button" class="btn btn--secondary" @click="coverInputRef?.click()">
            {{ editingId ? 'Cover auswählen…' : 'Bild auswählen (4 Punkte setzen, dann Speichern – Bild wird mit hochgeladen)' }}
          </button>
        </div>
        <div v-if="coverFile && coverPreview" class="sources-form__cover-crop">
          <div ref="coverCropWrapRef" class="crop-editor__wrap" @click="onCoverCropClick">
            <img
              ref="coverCropImgRef"
              :src="coverPreview"
              alt="Vorschau"
              class="crop-editor__img sources-form__crop-img"
              @load="onCoverCropLoad"
            />
            <div class="crop-editor__overlay">
              <svg
                v-if="coverCropPoints.length === 4 && coverDisplaySize.w > 0"
                class="crop-editor__lines"
                :viewBox="`0 0 ${coverDisplaySize.w} ${coverDisplaySize.h}`"
                preserveAspectRatio="none"
              >
                <polyline
                  :points="coverPolylinePoints"
                  fill="none"
                  stroke="var(--color-primary, #2563eb)"
                  stroke-width="2"
                  stroke-dasharray="6 4"
                />
              </svg>
              <span
                v-for="(pt, i) in coverCropPoints"
                :key="i"
                class="crop-editor__point"
                :style="{ left: (pt.x - 12) + 'px', top: (pt.y - 12) + 'px' }"
                @mousedown.stop="onCoverPointMouseDown($event, i)"
              >
                {{ i + 1 }}
              </span>
            </div>
          </div>
          <div class="crop-editor__actions">
            <button
              type="button"
              class="btn btn--primary"
              :disabled="coverCropPoints.length !== 4 || coverUploading || !editingId"
              @click="uploadCover"
            >
              {{ coverUploading ? 'Lade hoch…' : (editingId ? 'Cover speichern (4 Punkte setzen)' : 'Zuerst „Speichern“ klicken') }}
            </button>
            <button type="button" class="btn btn--secondary" @click="clearCoverFile">Abbrechen</button>
          </div>
          <p v-if="coverError" class="form__error">{{ coverError }}</p>
        </div>
      </div>
    </section>

    <!-- List -->
    <div v-if="!formOpen" class="sources-toolbar">
      <button type="button" class="btn btn--primary" @click="openNewForm">Neue Buchquelle</button>
    </div>
    <p v-if="listError" class="form__error">{{ listError }}</p>
    <p v-if="loading && !sources.length">Lade…</p>
    <ul v-else class="sources-list">
      <li v-for="s in sources" :key="s.id" class="sources-list__item">
        <div class="sources-list__thumb" @click="startEdit(s.id)">
          <img v-if="s.image_path" :src="s.image_path" :alt="s.name" class="sources-list__img" />
          <span v-else class="sources-list__no-img">Kein Cover</span>
        </div>
        <div class="sources-list__main" @click="startEdit(s.id)">
          <strong class="sources-list__name">{{ s.name }}</strong>
          <span v-if="s.subtitle" class="sources-list__subtitle">{{ s.subtitle }}</span>
          <span v-if="s.author || s.year" class="sources-list__meta">
            {{ [s.author, s.year].filter(Boolean).join(', ') }}
          </span>
        </div>
        <button
          type="button"
          class="btn btn--secondary sources-list__delete"
          title="Quelle löschen"
          @click="onDelete(s.id)"
        >
          Löschen
        </button>
      </li>
    </ul>
    <p v-if="!loading && !sources.length" class="empty">Noch keine Buchquellen. „Neue Buchquelle“ zum Anlegen.</p>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import {
  listSources,
  createSource,
  updateSource,
  deleteSource,
  uploadSourceCover,
} from '../api/sources'
import type { RecipeSource, RecipeSourceInput } from '../api/sources'

const sources = ref<RecipeSource[]>([])
const loading = ref(true)
const listError = ref('')
const formOpen = ref(false)
const editingId = ref<number | null>(null)
const currentSource = ref<RecipeSource | null>(null)
const saving = ref(false)
const formError = ref('')
const form = ref<RecipeSourceInput>({
  name: '',
  subtitle: null,
  author: null,
  year: null,
})

const coverDisplayUrl = computed(() => {
  const s = currentSource.value
  if (!s?.image_path) return ''
  return s.image_path.startsWith('/') ? s.image_path : s.image_path
})

const coverInputRef = ref<HTMLInputElement | null>(null)
const coverFile = ref<File | null>(null)
const coverPreview = ref<string | null>(null)
const coverCropPoints = ref<Array<{ x: number; y: number }>>([])
const coverDisplaySize = ref({ w: 0, h: 0 })
const coverCropWrapRef = ref<HTMLDivElement | null>(null)
const coverCropImgRef = ref<HTMLImageElement | null>(null)
const coverUploading = ref(false)
const coverError = ref('')
let coverDragUnsub: (() => void) | null = null

const coverPolylinePoints = computed(() => {
  if (coverCropPoints.value.length !== 4) return ''
  const p = coverCropPoints.value
  return `${p[0].x},${p[0].y} ${p[1].x},${p[1].y} ${p[2].x},${p[2].y} ${p[3].x},${p[3].y} ${p[0].x},${p[0].y}`
})

async function loadList() {
  loading.value = true
  listError.value = ''
  try {
    sources.value = await listSources()
  } catch (e) {
    listError.value = e instanceof Error ? e.message : 'Quellen konnten nicht geladen werden'
  } finally {
    loading.value = false
  }
}

function openNewForm() {
  editingId.value = null
  currentSource.value = null
  form.value = { name: '', subtitle: null, author: null, year: null }
  formError.value = ''
  coverFile.value = null
  coverPreview.value = null
  coverCropPoints.value = []
  coverError.value = ''
  formOpen.value = true
}

function startEdit(id: number) {
  const s = sources.value.find((x) => x.id === id)
  if (!s) return
  editingId.value = s.id
  currentSource.value = s
  form.value = {
    name: s.name,
    subtitle: s.subtitle ?? null,
    author: s.author ?? null,
    year: s.year ?? null,
  }
  formError.value = ''
  coverFile.value = null
  coverPreview.value = null
  coverCropPoints.value = []
  coverError.value = ''
  formOpen.value = true
}

function closeForm() {
  formOpen.value = false
  editingId.value = null
  currentSource.value = null
  coverFile.value = null
  if (coverPreview.value) URL.revokeObjectURL(coverPreview.value)
  coverPreview.value = null
  coverDragUnsub?.()
}

async function saveSource() {
  if (!form.value.name?.trim()) return
  saving.value = true
  formError.value = ''
  coverError.value = ''
  try {
    const payload: RecipeSourceInput = {
      type: 'book',
      name: form.value.name.trim(),
      subtitle: form.value.subtitle?.trim() || null,
      author: form.value.author?.trim() || null,
      year: form.value.year ?? null,
    }
    if (editingId.value) {
      const updated = await updateSource(editingId.value, payload)
      const idx = sources.value.findIndex((x) => x.id === updated.id)
      if (idx >= 0) sources.value[idx] = updated
      currentSource.value = updated
    } else {
      const created = await createSource(payload)
      sources.value.unshift(created)
      editingId.value = created.id
      currentSource.value = created
      // If user already selected a cover and set 4 points, upload it now
      const file = coverFile.value
      const points = coverCropPoints.value
      const img = coverCropImgRef.value
      if (file && points.length === 4 && img) {
        const rect = img.getBoundingClientRect()
        const nw = img.naturalWidth
        const nh = img.naturalHeight
        if (rect.width > 0 && rect.height > 0 && nw > 0 && nh > 0) {
          const imagePoints = points.map((p) => ({
            x: Math.round((p.x / rect.width) * nw),
            y: Math.round((p.y / rect.height) * nh),
          }))
          coverUploading.value = true
          try {
            const { source } = await uploadSourceCover(created.id, file, imagePoints)
            const idx = sources.value.findIndex((x) => x.id === source.id)
            if (idx >= 0) sources.value[idx] = source
            currentSource.value = source
            clearCoverFile()
          } catch (e) {
            coverError.value = e instanceof Error ? e.message : 'Cover-Upload nach Speichern fehlgeschlagen'
          } finally {
            coverUploading.value = false
          }
        }
      }
    }
  } catch (e) {
    formError.value = e instanceof Error ? e.message : 'Speichern fehlgeschlagen'
  } finally {
    saving.value = false
  }
}

function onCoverFileSelected(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file?.type.startsWith('image/')) return
  coverFile.value = file
  coverPreview.value = URL.createObjectURL(file)
  coverCropPoints.value = []
  coverError.value = ''
  input.value = ''
}

function clearCoverFile() {
  coverFile.value = null
  if (coverPreview.value) URL.revokeObjectURL(coverPreview.value)
  coverPreview.value = null
  coverCropPoints.value = []
  coverError.value = ''
}

function onCoverCropLoad() {
  coverCropPoints.value = []
  if (coverCropWrapRef.value) {
    const r = coverCropWrapRef.value.getBoundingClientRect()
    coverDisplaySize.value = { w: r.width, h: r.height }
  }
}

function onCoverCropClick(e: MouseEvent) {
  if (coverCropPoints.value.length >= 4 || !coverCropWrapRef.value) return
  if ((e.target as HTMLElement).closest?.('.crop-editor__point')) return
  const r = coverCropWrapRef.value.getBoundingClientRect()
  const x = Math.max(0, Math.min(r.width, e.clientX - r.left))
  const y = Math.max(0, Math.min(r.height, e.clientY - r.top))
  coverCropPoints.value = [...coverCropPoints.value, { x, y }]
  coverError.value = ''
}

function onCoverPointMouseDown(e: MouseEvent, index: number) {
  if (!coverCropWrapRef.value) return
  const wrap = coverCropWrapRef.value
  const move = (ev: MouseEvent) => {
    const r = wrap.getBoundingClientRect()
    const x = Math.max(0, Math.min(r.width, ev.clientX - r.left))
    const y = Math.max(0, Math.min(r.height, ev.clientY - r.top))
    const next = [...coverCropPoints.value]
    next[index] = { x, y }
    coverCropPoints.value = next
  }
  const up = () => {
    document.removeEventListener('mousemove', move)
    document.removeEventListener('mouseup', up)
    coverDragUnsub = null
  }
  coverDragUnsub = up
  document.addEventListener('mousemove', move)
  document.addEventListener('mouseup', up)
}

async function uploadCover() {
  const id = editingId.value
  const file = coverFile.value
  const img = coverCropImgRef.value
  if (!id || !file || coverCropPoints.value.length !== 4 || !img) return
  const rect = img.getBoundingClientRect()
  const nw = img.naturalWidth
  const nh = img.naturalHeight
  if (rect.width <= 0 || rect.height <= 0 || nw <= 0 || nh <= 0) {
    coverError.value = 'Bildgröße konnte nicht ermittelt werden.'
    return
  }
  const points = coverCropPoints.value.map((p) => ({
    x: Math.round((p.x / rect.width) * nw),
    y: Math.round((p.y / rect.height) * nh),
  }))
  coverUploading.value = true
  coverError.value = ''
  try {
    const { source } = await uploadSourceCover(id, file, points)
    const idx = sources.value.findIndex((x) => x.id === source.id)
    if (idx >= 0) sources.value[idx] = source
    currentSource.value = source
    clearCoverFile()
  } catch (e) {
    coverError.value = e instanceof Error ? e.message : 'Cover-Upload fehlgeschlagen'
  } finally {
    coverUploading.value = false
  }
}

async function onDelete(id: number) {
  if (!confirm('Buchquelle wirklich löschen? Geht nur, wenn kein Rezept sie verwendet.')) return
  try {
    await deleteSource(id)
    sources.value = sources.value.filter((s) => s.id !== id)
    if (editingId.value === id) closeForm()
  } catch (e) {
    listError.value = e instanceof Error ? e.message : 'Löschen fehlgeschlagen (evtl. wird die Quelle noch von Rezepten verwendet).'
  }
}

onMounted(() => loadList())
</script>

<style scoped>
.view { max-width: 56rem; }
.view h1 { margin: 0 0 0.5rem 0; color: var(--color-text); }
.view__intro { margin: 0 0 1.5rem 0; color: var(--color-text-muted); }

.sources-form {
  margin-bottom: 2rem;
  padding: 1.25rem;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  background: var(--color-bg-elevated, var(--color-bg-muted));
}
.sources-form__title { margin: 0 0 1rem 0; font-size: 1.1rem; font-weight: 600; color: var(--color-text); }
.sources-form__cover { margin-top: 1.5rem; padding-top: 1.5rem; border-top: 1px solid var(--color-border); }
.sources-form__cover-title { margin: 0 0 0.5rem 0; font-size: 1rem; font-weight: 600; color: var(--color-text); }
.sources-form__cover-current { display: flex; align-items: center; gap: 1rem; margin-bottom: 0.75rem; }
.sources-form__cover-img { max-width: 120px; max-height: 160px; object-fit: contain; border-radius: 4px; border: 1px solid var(--color-border); }
.sources-form__cover-hint { font-size: 0.9rem; color: var(--color-text-muted); }
.sources-form__cover-upload { margin-bottom: 0.5rem; }
.sources-form__cover-crop { margin-top: 0.75rem; }
.sources-form__crop-img { max-height: 280px; }

.form__row { margin-bottom: 1rem; }
.form__row--inline { display: flex; gap: 1rem; flex-wrap: wrap; }
.form__row--inline > div { flex: 1; min-width: 140px; }
.form__label { display: block; margin-bottom: 0.25rem; font-size: 0.9rem; font-weight: 500; color: var(--color-text); }
.form__input { width: 100%; padding: 0.5rem; font: inherit; border: 1px solid var(--color-border); border-radius: 4px; background: var(--color-bg); color: var(--color-text); }
.form__file { position: absolute; width: 0; height: 0; opacity: 0; pointer-events: none; }
.form__actions { display: flex; gap: 0.5rem; margin-top: 1rem; }
.form__error { margin: 0.5rem 0 0; color: var(--color-error); font-size: 0.9rem; }

.crop-editor__wrap { position: relative; display: inline-block; max-width: 100%; cursor: crosshair; }
.crop-editor__img { display: block; max-width: 100%; }
.crop-editor__overlay { position: absolute; top: 0; left: 0; width: 100%; height: 100%; pointer-events: none; }
.crop-editor__lines { position: absolute; top: 0; left: 0; width: 100%; height: 100%; pointer-events: none; }
.crop-editor__point {
  position: absolute; width: 24px; height: 24px; margin-left: -12px; margin-top: -12px;
  border-radius: 50%; background: var(--color-primary, #2563eb); color: #fff; font-size: 12px; font-weight: 700;
  display: flex; align-items: center; justify-content: center; pointer-events: auto; cursor: grab;
  box-shadow: 0 1px 3px rgba(0,0,0,0.3);
}
.crop-editor__point:active { cursor: grabbing; }
.crop-editor__actions { margin-top: 0.75rem; display: flex; gap: 0.5rem; flex-wrap: wrap; }

.sources-toolbar { margin-bottom: 1rem; }
.sources-list { list-style: none; margin: 0; padding: 0; }
.sources-list__item {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 0.75rem;
  margin-bottom: 0.5rem;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  background: var(--color-bg-muted);
}
.sources-list__thumb {
  flex-shrink: 0;
  width: 56px;
  height: 72px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--color-bg);
  border-radius: 4px;
  border: 1px solid var(--color-border);
  cursor: pointer;
  overflow: hidden;
}
.sources-list__img { width: 100%; height: 100%; object-fit: cover; }
.sources-list__no-img { font-size: 0.7rem; color: var(--color-text-muted); text-align: center; padding: 0.25rem; }
.sources-list__main { flex: 1; min-width: 0; cursor: pointer; }
.sources-list__name { display: block; color: var(--color-text); }
.sources-list__subtitle { display: block; font-size: 0.9rem; color: var(--color-text-muted); }
.sources-list__meta { display: block; font-size: 0.85rem; color: var(--color-text-muted); margin-top: 0.2rem; }
.sources-list__delete { flex-shrink: 0; }

.btn { padding: 0.5rem 1rem; border-radius: 4px; font: inherit; cursor: pointer; border: 1px solid transparent; }
.btn:disabled { opacity: 0.7; cursor: not-allowed; }
.btn--primary { background: var(--color-btn-primary-bg); color: var(--color-header-fg); }
.btn--primary:hover:not(:disabled) { opacity: 0.95; }
.btn--secondary { background: var(--color-btn-secondary-bg); color: var(--color-btn-secondary-fg); border-color: var(--color-btn-secondary-border); }
.btn--secondary:hover:not(:disabled) { background: var(--color-btn-secondary-hover); }

.empty { color: var(--color-text-muted); margin-top: 1rem; }
</style>
