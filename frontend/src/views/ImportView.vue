<template>
  <div class="view view--import">
    <h1>Import</h1>
    <p class="view__intro">
      Zwei Schritte: Optional ein Foto vom Rezeptbild (z. B. das Gericht oder die Buchseite), dann ein oder mehrere Fotos vom Rezepttext zur Texterkennung.
    </p>

    <!-- Step 1: Recipe image (optional) -->
    <section class="import-step">
      <h2 class="import-step__title">Schritt 1: Foto vom Rezeptbild (optional)</h2>
      <p class="import-step__desc">Ein Bild des Rezepts (z. B. Gericht oder Buchseite). Sie können auch ohne Bild fortfahren.</p>
      <div class="import-options" :class="{ 'import-options--camera-live': !!cameraStream }">
        <div class="import-option">
          <h3 class="import-option__title">Datei wählen</h3>
          <input
            ref="step1FileRef"
            type="file"
            accept="image/*"
            class="import-option__input"
            aria-label="Bild auswählen"
            @change="onStep1FileSelected"
          />
          <button type="button" class="btn btn--secondary" @click="step1FileRef?.click()">
            Bild wählen…
          </button>
        </div>
        <div class="import-option import-option--camera">
          <h3 class="import-option__title">Kamera</h3>
          <template v-if="!cameraStream">
            <button
              type="button"
              class="btn btn--secondary"
              :disabled="cameraBusy"
              @click="startCamera"
            >
              {{ cameraBusy ? 'Starte…' : 'Foto aufnehmen' }}
            </button>
          </template>
          <template v-else>
            <div class="import-option__camera-viewport" :style="cameraViewportStyle">
              <video
                ref="videoRef"
                class="import-option__video"
                autoplay
                playsinline
                muted
                @loadedmetadata="onCameraVideoMetadata"
              />
            </div>
            <div class="import-option__camera-actions">
              <button type="button" class="btn btn--primary" @click="captureStep1">Aufnehmen</button>
              <button type="button" class="btn btn--secondary" @click="stopCamera">Abbrechen</button>
            </div>
          </template>
        </div>
      </div>
      <div v-if="step1Preview" class="import-preview">
        <label class="import-defer">
          <input v-model="step1DeferUpload" type="checkbox" />
          <span>Upload original now; crop and optimize later</span>
        </label>
        <img :src="step1Preview" alt="Vorschau" class="import-preview__img" />
        <div class="import-preview__actions">
          <button type="button" class="btn btn--primary" :disabled="uploading" @click="uploadStep1">
            {{ uploading ? 'Lade hoch…' : 'Hochladen' }}
          </button>
          <button type="button" class="btn btn--secondary" @click="clearStep1">Zurücksetzen</button>
        </div>
        <p v-if="uploadError" class="import-preview__error">{{ uploadError }}</p>
      </div>
      <div v-if="!currentRecipe" class="import-step__skip">
        <button
          type="button"
          class="btn btn--secondary"
          :disabled="uploading"
          @click="startWithoutRecipeImage"
        >
          {{ uploading ? 'Erstelle…' : 'Ohne Rezeptbild fortfahren' }}
        </button>
      </div>
    </section>

    <!-- Crop perspective: 4 points (only when recipe has image) -->
    <section v-if="currentRecipe?.image_path" class="import-step">
      <h2 class="import-step__title">Perspektive korrigieren</h2>
      <p class="import-step__desc">
        Klicken Sie nacheinander auf die vier Ecken der Buchseite / des Covers. Punkte können Sie per Drag verschieben. Anschließend „Bild zuschneiden“ wählen.
      </p>
      <div class="crop-editor">
        <div ref="cropEditorRef" class="crop-editor__wrap" @click="onCropImageClick">
          <img
            ref="cropImageRef"
            :src="cropImageUrl"
            alt="Rezeptbild"
            class="crop-editor__img"
            @load="onCropImageLoad"
          />
          <div class="crop-editor__overlay">
            <svg
              v-if="cropPoints.length === 4 && cropDisplaySize.w > 0 && cropDisplaySize.h > 0"
              class="crop-editor__lines"
              :viewBox="`0 0 ${cropDisplaySize.w} ${cropDisplaySize.h}`"
              preserveAspectRatio="none"
            >
              <polyline
                :points="cropPolylinePoints"
                fill="none"
                stroke="var(--color-primary, #2563eb)"
                stroke-width="2"
                stroke-dasharray="6 4"
              />
            </svg>
            <span
              v-for="(pt, i) in cropPoints"
              :key="i"
              class="crop-editor__point"
              :style="{ left: (pt.x - 12) + 'px', top: (pt.y - 12) + 'px' }"
              @mousedown.stop="onCropPointMouseDown($event, i)"
            >
              {{ i + 1 }}
            </span>
          </div>
        </div>
        <div class="crop-editor__actions">
          <button
            type="button"
            class="btn btn--primary"
            :disabled="!canRunCropImport || cropping"
            @click="runCropPerspective"
          >
            {{
              cropping
                ? '…'
                : currentRecipe?.image_processing_pending
                  ? 'Finalize image'
                  : 'Bild zuschneiden'
            }}
          </button>
          <button type="button" class="btn btn--secondary" @click="resetCropPoints">
            Punkte zurücksetzen
          </button>
        </div>
        <p v-if="cropError" class="import-preview__error">{{ cropError }}</p>
      </div>
    </section>

    <!-- Step 2: Recipe text image(s) -->
    <section v-if="currentRecipe" class="import-step">
      <h2 class="import-step__title">Schritt 2: Foto(s) vom Rezepttext</h2>
      <p class="import-step__desc">
        Ein oder mehrere Fotos des Rezepttexts (Zutaten, Zubereitung). Diese werden an OpenAI zur Texterkennung gesendet.
      </p>
      <div class="import-options">
        <div class="import-option">
          <h3 class="import-option__title">Bilder wählen (mehrere möglich)</h3>
          <input
            ref="step2FileRef"
            type="file"
            accept="image/*"
            multiple
            class="import-option__input"
            aria-label="Textbilder auswählen"
            @change="onStep2FilesSelected"
          />
          <button type="button" class="btn btn--secondary" @click="step2FileRef?.click()">
            Bilder wählen…
          </button>
        </div>
      </div>
      <div v-if="step2Files.length" class="import-preview">
        <p class="import-preview__meta">{{ step2Files.length }} Bild(er) ausgewählt. Pro Bild optional 4 Ecken setzen (Reihenfolge egal), dann Perspektive vor dem Senden an die KI zuschneiden.</p>
        <div class="step2-crop-list">
          <div
            v-for="(file, idx) in step2Files"
            :key="idx"
            class="step2-crop-item"
          >
            <p class="step2-crop-item__label">Bild {{ idx + 1 }}</p>
            <div
              :ref="(el) => setStep2CropWrapRef(idx, el)"
              class="crop-editor__wrap step2-crop-item__wrap"
              @click="onStep2CropClick($event, idx)"
            >
              <img
                :ref="(el) => setStep2CropImageRef(idx, el)"
                :src="step2Previews[idx]"
                :alt="'Textbild ' + (idx + 1)"
                class="crop-editor__img step2-crop-item__img"
                @load="onStep2CropImageLoad(idx)"
              />
              <div class="crop-editor__overlay">
                <svg
                  v-if="(step2CropPoints[idx]?.length ?? 0) === 4 && (step2DisplaySize[idx]?.w ?? 0) > 0"
                  class="crop-editor__lines"
                  :viewBox="`0 0 ${step2DisplaySize[idx]?.w ?? 0} ${step2DisplaySize[idx]?.h ?? 0}`"
                  preserveAspectRatio="none"
                >
                  <polyline
                    :points="step2PolylinePoints(idx)"
                    fill="none"
                    stroke="var(--color-primary, #2563eb)"
                    stroke-width="2"
                    stroke-dasharray="6 4"
                  />
                </svg>
                <span
                  v-for="(pt, pi) in (step2CropPoints[idx] ?? [])"
                  :key="pi"
                  class="crop-editor__point"
                  :style="{ left: (pt.x - 12) + 'px', top: (pt.y - 12) + 'px' }"
                  @mousedown.stop="onStep2PointMouseDown($event, idx, pi)"
                >
                  {{ pi + 1 }}
                </span>
              </div>
            </div>
            <button type="button" class="btn btn--secondary step2-crop-item__reset" @click="resetStep2CropPoints(idx)">
              Punkte zurücksetzen
            </button>
          </div>
        </div>
        <div class="import-preview__actions">
          <button
            type="button"
            class="btn btn--primary"
            :disabled="extracting"
            @click="runExtract"
          >
            {{ extracting ? 'Erkenne Text…' : 'Text erkennen (OpenAI)' }}
          </button>
          <button type="button" class="btn btn--secondary" @click="clearStep2">Andere Bilder</button>
        </div>
        <p v-if="extractError" class="import-preview__error">{{ extractError }}</p>
      </div>
    </section>

    <!-- Result -->
    <section v-if="currentRecipe && (currentRecipe.parsed_recipe || extractUsage)" class="import-result">
      <h2 class="import-result__title">Ergebnis</h2>
      <p class="import-result__link">
        <router-link to="/recipes">Zu den Rezepten</router-link>
        · Rezept „{{ currentRecipe.title }}“ bearbeiten
      </p>
      <div v-if="extractUsage" class="import-result__usage">
        Token: {{ extractUsage.prompt_tokens }} (Prompt) + {{ extractUsage.completion_tokens }} (Antwort) = {{ extractUsage.total_tokens }} gesamt
      </div>
      <div v-if="currentRecipe.parsed_recipe" class="import-result__parsed">
        <p v-if="currentRecipe.parsed_recipe.title" class="import-result__field">
          <strong>Titel:</strong> {{ currentRecipe.parsed_recipe.title }}
        </p>
        <p v-if="currentRecipe.parsed_recipe.introText" class="import-result__field import-result__text">
          <strong>Einleitung:</strong> {{ currentRecipe.parsed_recipe.introText }}
        </p>
        <template v-if="currentRecipe.parsed_recipe.ingredientsSections?.length">
          <p class="import-result__label"><strong>Zutaten</strong></p>
          <ul class="import-result__list">
            <li
              v-for="(section, si) in currentRecipe.parsed_recipe.ingredientsSections"
              :key="si"
              class="import-result__section"
            >
              <span v-if="section.heading" class="import-result__heading">{{ section.heading }}</span>
              <ul class="import-result__items">
                <li v-for="(item, ii) in section.items" :key="ii">{{ formatParsedItem(item) }}</li>
              </ul>
            </li>
          </ul>
        </template>
        <template v-if="currentRecipe.parsed_recipe.steps?.length">
          <p class="import-result__label"><strong>Schritte</strong></p>
          <ol class="import-result__steps">
            <li v-for="(step, i) in currentRecipe.parsed_recipe.steps" :key="i">{{ formatParsedStep(step) }}</li>
          </ol>
        </template>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, computed, nextTick, onBeforeUnmount } from 'vue'
import { extractRecipeFromImages } from '../api/recipes'
import type { Recipe } from '../api/recipes'

const step1FileRef = ref<HTMLInputElement | null>(null)
const step2FileRef = ref<HTMLInputElement | null>(null)
const videoRef = ref<HTMLVideoElement | null>(null)
const step1Preview = ref<string | null>(null)
const step1File = ref<File | null>(null)
const uploading = ref(false)
const uploadError = ref('')
const currentRecipe = ref<Recipe | null>(null)
const step2Files = ref<File[]>([])
const step2Previews = ref<string[]>([])
const step2CropPoints = ref<Array<Array<{ x: number; y: number }>>>([])
const step2DisplaySize = ref<Array<{ w: number; h: number }>>([])
const step2CropImageRefs = ref<(HTMLImageElement | null)[]>([])
const step2CropWrapRefs = ref<(HTMLDivElement | null)[]>([])
let step2DragState: { imageIdx: number; pointIdx: number; unsubscribe: () => void } | null = null
const extracting = ref(false)
const extractError = ref('')
const extractUsage = ref<{ prompt_tokens: number; completion_tokens: number; total_tokens: number } | null>(null)
const cameraStream = ref<MediaStream | null>(null)
const cameraBusy = ref(false)
/** Matches native stream dimensions to avoid letterboxing; fallback ~ phone portrait 3472×4624 */
const cameraViewportStyle = ref<Record<string, string>>({
  aspectRatio: '3472 / 4624',
})

// Crop perspective: 4 points (display coords), image url, refs
const cropImageRef = ref<HTMLImageElement | null>(null)
const cropEditorRef = ref<HTMLDivElement | null>(null)
const cropImageUrl = ref('')
const cropPoints = ref<Array<{ x: number; y: number }>>([])
const cropDisplaySize = ref({ w: 0, h: 0 })
const cropping = ref(false)
const cropError = ref('')
let draggingPointIndex: number | null = null
let cropDragUnsubscribe: (() => void) | null = null
const step1DeferUpload = ref(false)

const imagePending = computed(() => currentRecipe.value?.image_processing_pending === true)
const canRunCropImport = computed(() => {
  const n = cropPoints.value.length
  if (cropping.value) return false
  if (imagePending.value) return n === 0 || n === 4
  return n === 4
})

function formatParsedItem(item: import('../api/recipes').ParsedIngredientItem): string {
  if (item.originalText?.trim()) return item.originalText.trim()
  const parts = [item.amount != null ? String(item.amount) : '', item.unit ?? '', item.ingredient ?? '', item.additionalInfo ?? ''].filter(Boolean)
  return parts.join(' ').trim() || '—'
}

function formatParsedStep(step: import('../api/recipes').ParsedRecipeStep): string {
  return step?.text?.trim() ?? '—'
}

const cropPolylinePoints = computed(() => {
  if (cropPoints.value.length !== 4) return ''
  const pts = cropPoints.value
  return `${pts[0].x},${pts[0].y} ${pts[1].x},${pts[1].y} ${pts[2].x},${pts[2].y} ${pts[3].x},${pts[3].y} ${pts[0].x},${pts[0].y}`
})

// Keep crop image URL in sync with recipe; reset points when recipe/image changes
watch(
  () => currentRecipe.value?.image_path,
  (path) => {
    if (path) {
      cropImageUrl.value = path
      cropPoints.value = []
      cropError.value = ''
    }
  },
  { immediate: true }
)

function updateCropDisplaySize() {
  nextTick(() => {
    const wrap = cropEditorRef.value
    if (wrap) {
      const rect = wrap.getBoundingClientRect()
      cropDisplaySize.value = { w: rect.width, h: rect.height }
    }
  })
}

function onCropImageLoad() {
  cropPoints.value = []
  updateCropDisplaySize()
}

function onCropImageClick(e: MouseEvent) {
  if (cropPoints.value.length >= 4 || !cropEditorRef.value) return
  if ((e.target as HTMLElement).closest?.('.crop-editor__point')) return
  const target = e.currentTarget as HTMLElement
  const rect = target.getBoundingClientRect()
  const x = Math.max(0, Math.min(rect.width, e.clientX - rect.left))
  const y = Math.max(0, Math.min(rect.height, e.clientY - rect.top))
  cropPoints.value = [...cropPoints.value, { x, y }]
  cropError.value = ''
}

function onCropPointMouseDown(e: MouseEvent, index: number) {
  if (!cropEditorRef.value) return
  draggingPointIndex = index
  const wrap = cropEditorRef.value
  const move = (ev: MouseEvent) => {
    const r = wrap.getBoundingClientRect()
    const x = Math.max(0, Math.min(r.width, ev.clientX - r.left))
    const y = Math.max(0, Math.min(r.height, ev.clientY - r.top))
    const next = [...cropPoints.value]
    next[index] = { x, y }
    cropPoints.value = next
  }
  const up = () => {
    document.removeEventListener('mousemove', move)
    document.removeEventListener('mouseup', up)
    draggingPointIndex = null
    cropDragUnsubscribe = null
  }
  cropDragUnsubscribe = up
  document.addEventListener('mousemove', move)
  document.addEventListener('mouseup', up)
}

function resetCropPoints() {
  cropPoints.value = []
  cropError.value = ''
}

/** Convert display coords to original image coords and send crop request */
async function runCropPerspective() {
  const recipe = currentRecipe.value
  const img = cropImageRef.value
  if (!recipe || !recipe.image_path || !img) return
  const pending = recipe.image_processing_pending === true
  const n = cropPoints.value.length
  if (!pending && n !== 4) return
  if (pending && n !== 0 && n !== 4) {
    cropError.value = 'Use four corners, or reset points to finalize the full image.'
    return
  }
  const rect = img.getBoundingClientRect()
  const nw = img.naturalWidth
  const nh = img.naturalHeight
  if (rect.width <= 0 || rect.height <= 0 || nw <= 0 || nh <= 0) {
    cropError.value = 'Bildgröße konnte nicht ermittelt werden.'
    return
  }
  const body: { points?: Array<{ x: number; y: number }> } = {}
  if (n === 4) {
    body.points = cropPoints.value.map((p) => ({
      x: Math.round((p.x / rect.width) * nw),
      y: Math.round((p.y / rect.height) * nh),
    }))
  }
  cropping.value = true
  cropError.value = ''
  try {
    const res = await fetch(`/api/recipes/${recipe.id}/crop-perspective`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error((data as { error?: string }).error || res.statusText)
    const payload = data as { recipe?: Recipe; url?: string }
    if (payload.url) cropImageUrl.value = payload.url
    if (payload.recipe) currentRecipe.value = payload.recipe
    cropPoints.value = []
  } catch (e) {
    cropError.value = e instanceof Error ? e.message : 'Zuschneiden fehlgeschlagen'
  } finally {
    cropping.value = false
  }
}

function onStep1FileSelected(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file || !file.type.startsWith('image/')) return
  step1File.value = file
  step1Preview.value = URL.createObjectURL(file)
  uploadError.value = ''
  input.value = ''
}

function onCameraVideoMetadata() {
  const v = videoRef.value
  if (!v?.videoWidth || !v?.videoHeight) return
  cameraViewportStyle.value = {
    aspectRatio: `${v.videoWidth} / ${v.videoHeight}`,
  }
}

function attachCameraStream(stream: MediaStream) {
  cameraStream.value = stream
  nextTick().then(() => {
    if (videoRef.value) {
      videoRef.value.srcObject = stream
      queueMicrotask(() => onCameraVideoMetadata())
    }
  })
}

function startCamera() {
  cameraBusy.value = true
  uploadError.value = ''
  const w = 3472
  const h = 4624
  const ar = w / h
  const preferred: MediaStreamConstraints = {
    audio: false,
    video: {
      facingMode: 'environment',
      width: { ideal: w },
      height: { ideal: h },
      aspectRatio: { ideal: ar },
    },
  }
  const fallback: MediaStreamConstraints = { audio: false, video: { facingMode: 'environment' } }

  navigator.mediaDevices
    .getUserMedia(preferred)
    .catch(() => navigator.mediaDevices.getUserMedia(fallback))
    .then((stream) => {
      attachCameraStream(stream)
    })
    .catch(() => {
      uploadError.value = 'Kamera nicht verfügbar'
    })
    .finally(() => {
      cameraBusy.value = false
    })
}

function stopCamera() {
  cameraStream.value?.getTracks().forEach((t) => t.stop())
  cameraStream.value = null
  if (videoRef.value) videoRef.value.srcObject = null
  cameraViewportStyle.value = { aspectRatio: '3472 / 4624' }
}

function captureStep1() {
  const video = videoRef.value
  if (!video || !cameraStream.value) return
  const canvas = document.createElement('canvas')
  canvas.width = video.videoWidth
  canvas.height = video.videoHeight
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  ctx.drawImage(video, 0, 0)
  canvas.toBlob(
    (blob) => {
      if (!blob) return
      stopCamera()
      step1File.value = new File([blob], 'capture.jpg', { type: 'image/jpeg' })
      step1Preview.value = URL.createObjectURL(blob)
      uploadError.value = ''
    },
    'image/jpeg',
    0.9
  )
}

async function uploadStep1() {
  const file = step1File.value
  if (!file) return
  uploading.value = true
  uploadError.value = ''
  try {
    const form = new FormData()
    form.append('image', file)
    if (step1DeferUpload.value) form.append('processImageLater', '1')
    const res = await fetch('/api/upload', { method: 'POST', body: form })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error((data as { error?: string }).error || res.statusText)
    const payload = data as { url?: string; recipe?: Recipe }
    if (payload.recipe) {
      currentRecipe.value = payload.recipe
      step1Preview.value = null
      step1File.value = null
      step2Files.value = []
      extractUsage.value = null
      extractError.value = ''
    }
  } catch (e) {
    uploadError.value = e instanceof Error ? e.message : 'Upload fehlgeschlagen'
  } finally {
    uploading.value = false
  }
}

async function startWithoutRecipeImage() {
  uploading.value = true
  uploadError.value = ''
  try {
    const res = await fetch('/api/upload', { method: 'POST', body: new FormData() })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error((data as { error?: string }).error || res.statusText)
    const payload = data as { recipe?: Recipe }
    if (payload.recipe) {
      currentRecipe.value = payload.recipe
      step2Files.value = []
      extractUsage.value = null
      extractError.value = ''
    }
  } catch (e) {
    uploadError.value = e instanceof Error ? e.message : 'Draft konnte nicht erstellt werden'
  } finally {
    uploading.value = false
  }
}

function clearStep1() {
  if (step1Preview.value) URL.revokeObjectURL(step1Preview.value)
  step1Preview.value = null
  step1File.value = null
  step1DeferUpload.value = false
  currentRecipe.value = null
  uploadError.value = ''
  step2Files.value = []
  extractUsage.value = null
  extractError.value = ''
}

function setStep2CropImageRef(idx: number, el: unknown) {
  const arr = step2CropImageRefs.value
  if (idx >= arr.length) return
  arr[idx] = el as HTMLImageElement | null
}

function setStep2CropWrapRef(idx: number, el: unknown) {
  const arr = step2CropWrapRefs.value
  if (idx >= arr.length) return
  arr[idx] = el as HTMLDivElement | null
}

function step2PolylinePoints(idx: number): string {
  const pts = step2CropPoints.value[idx]
  if (!pts || pts.length !== 4) return ''
  return `${pts[0].x},${pts[0].y} ${pts[1].x},${pts[1].y} ${pts[2].x},${pts[2].y} ${pts[3].x},${pts[3].y} ${pts[0].x},${pts[0].y}`
}

function onStep2CropImageLoad(idx: number) {
  nextTick(() => {
    const wrap = step2CropWrapRefs.value[idx]
    if (wrap) {
      const rect = wrap.getBoundingClientRect()
      const next = [...step2DisplaySize.value]
      next[idx] = { w: rect.width, h: rect.height }
      step2DisplaySize.value = next
    }
  })
}

function onStep2CropClick(e: MouseEvent, idx: number) {
  const pts = step2CropPoints.value[idx] ?? []
  if (pts.length >= 4) return
  if ((e.target as HTMLElement).closest?.('.crop-editor__point')) return
  const wrap = step2CropWrapRefs.value[idx]
  if (!wrap) return
  const rect = wrap.getBoundingClientRect()
  const x = Math.max(0, Math.min(rect.width, e.clientX - rect.left))
  const y = Math.max(0, Math.min(rect.height, e.clientY - rect.top))
  const next = [...(step2CropPoints.value ?? [])]
  if (!next[idx]) next[idx] = []
  next[idx] = [...next[idx], { x, y }]
  step2CropPoints.value = next
  extractError.value = ''
}

function onStep2PointMouseDown(e: MouseEvent, imageIdx: number, pointIdx: number) {
  const wrap = step2CropWrapRefs.value[imageIdx]
  if (!wrap) return
  const move = (ev: MouseEvent) => {
    const r = wrap!.getBoundingClientRect()
    const x = Math.max(0, Math.min(r.width, ev.clientX - r.left))
    const y = Math.max(0, Math.min(r.height, ev.clientY - r.top))
    const next = step2CropPoints.value.map((arr, i) => (i === imageIdx ? [...(arr ?? [])] : arr ?? []))
    const imgPts = next[imageIdx]
    if (imgPts[pointIdx] !== undefined) imgPts[pointIdx] = { x, y }
    step2CropPoints.value = next
  }
  const up = () => {
    document.removeEventListener('mousemove', move)
    document.removeEventListener('mouseup', up)
    step2DragState = null
  }
  step2DragState = { imageIdx, pointIdx, unsubscribe: up }
  document.addEventListener('mousemove', move)
  document.addEventListener('mouseup', up)
}

function resetStep2CropPoints(idx: number) {
  const next = [...(step2CropPoints.value ?? [])]
  next[idx] = []
  step2CropPoints.value = next
}

function onStep2FilesSelected(e: Event) {
  const input = e.target as HTMLInputElement
  const files = input.files ? Array.from(input.files).filter((f) => f.type.startsWith('image/')) : []
  step2Previews.value.forEach((url) => URL.revokeObjectURL(url))
  step2Previews.value = files.map((f) => URL.createObjectURL(f))
  step2Files.value = files
  step2CropPoints.value = files.map(() => [])
  step2DisplaySize.value = []
  step2CropImageRefs.value = new Array(files.length).fill(null)
  step2CropWrapRefs.value = new Array(files.length).fill(null)
  extractError.value = ''
  input.value = ''
}

function clearStep2() {
  step2Previews.value.forEach((url) => URL.revokeObjectURL(url))
  step2Previews.value = []
  step2Files.value = []
  step2CropPoints.value = []
  step2DisplaySize.value = []
  step2CropImageRefs.value = []
  step2CropWrapRefs.value = []
  extractError.value = ''
  step2FileRef.value?.form?.reset()
}

async function runExtract() {
  if (!currentRecipe.value || step2Files.value.length === 0) return
  const pointsPerImage: Array<Array<{ x: number; y: number }> | null> = []
  for (let i = 0; i < step2Files.value.length; i++) {
    const pts = step2CropPoints.value[i]
    const img = step2CropImageRefs.value[i]
    if (pts?.length === 4 && img) {
      const rect = img.getBoundingClientRect()
      const nw = img.naturalWidth
      const nh = img.naturalHeight
      if (rect.width > 0 && rect.height > 0 && nw > 0 && nh > 0) {
        pointsPerImage.push(
          pts.map((p) => ({
            x: Math.round((p.x / rect.width) * nw),
            y: Math.round((p.y / rect.height) * nh),
          }))
        )
      } else {
        pointsPerImage.push(null)
      }
    } else {
      pointsPerImage.push(null)
    }
  }
  extracting.value = true
  extractError.value = ''
  try {
    const result = await extractRecipeFromImages(currentRecipe.value.id, step2Files.value, pointsPerImage)
    currentRecipe.value = result.recipe
    extractUsage.value = result.usage
  } catch (e) {
    extractError.value = e instanceof Error ? e.message : 'Texterkennung fehlgeschlagen'
  } finally {
    extracting.value = false
  }
}

onBeforeUnmount(() => {
  stopCamera()
  if (step1Preview.value) URL.revokeObjectURL(step1Preview.value)
  cropDragUnsubscribe?.()
  step2Previews.value.forEach((url) => URL.revokeObjectURL(url))
  step2DragState?.unsubscribe()
})
</script>

<style scoped>
.view { max-width: 56rem; }
.view h1 { margin: 0 0 0.5rem 0; color: var(--color-text); }
.view__intro { margin: 0 0 1.5rem 0; color: var(--color-text-muted); }

.import-step {
  margin-bottom: 2rem;
  padding: 1.25rem;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  background: var(--color-bg-elevated);
}
.import-step__title { margin: 0 0 0.5rem 0; font-size: 1.1rem; font-weight: 600; color: var(--color-text); }
.import-step__desc { margin: 0 0 1rem 0; font-size: 0.95rem; color: var(--color-text-muted); }

.import-defer {
  display: flex;
  align-items: flex-start;
  gap: 0.5rem;
  margin-bottom: 0.5rem;
  font-size: 0.85rem;
  color: var(--color-text-muted);
  cursor: pointer;
}
.import-defer input { margin-top: 0.15em; }

.import-options { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 1rem; }
.import-options--camera-live {
  grid-template-columns: 1fr;
}
@media (min-width: 640px) {
  .import-options--camera-live {
    grid-template-columns: 1fr 1fr;
  }
  .import-options--camera-live .import-option--camera {
    grid-column: 1 / -1;
  }
}
@media (max-width: 480px) { .import-options { grid-template-columns: 1fr; } }
.import-option {
  padding: 1rem;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  background: var(--color-bg-muted);
}
.import-option__title { margin: 0 0 0.5rem 0; font-size: 0.95rem; font-weight: 600; color: var(--color-text); }
.import-option__input { position: absolute; width: 0; height: 0; opacity: 0; pointer-events: none; }
/* Viewport uses inline aspect-ratio from stream (see onCameraVideoMetadata) — avoids black bars */
.import-option__camera-viewport {
  width: 100%;
  max-width: min(100%, 36rem);
  margin-inline: auto;
  margin-bottom: 0.5rem;
  max-height: min(85vh, 52rem);
  background: #000;
  border-radius: 8px;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
  box-sizing: border-box;
}
.import-option__video {
  display: block;
  width: 100%;
  height: auto;
  max-height: min(85vh, 52rem);
  object-fit: contain;
  vertical-align: top;
}
.import-option__camera-actions { display: flex; gap: 0.5rem; flex-wrap: wrap; }

.import-preview { margin-top: 1rem; padding: 1rem; border-radius: 8px; background: var(--color-bg-muted); }
.import-preview__img {
  display: block;
  max-width: 100%;
  width: auto;
  height: auto;
  max-height: min(78vh, 52rem);
  margin-inline: auto;
  border-radius: 6px;
  margin-bottom: 0.75rem;
  object-fit: contain;
}
.import-preview__actions { display: flex; gap: 0.5rem; margin-bottom: 0.5rem; }
.import-preview__meta { margin: 0 0 0.5rem 0; font-size: 0.9rem; color: var(--color-text-muted); }
.import-preview__error { margin: 0; color: var(--color-error); font-size: 0.9rem; }

.crop-editor { margin-top: 1rem; }
.crop-editor__wrap { position: relative; display: inline-block; max-width: 100%; cursor: crosshair; }
.crop-editor__img { display: block; max-width: 100%; max-height: 400px; vertical-align: top; }
.crop-editor__overlay { position: absolute; top: 0; left: 0; width: 100%; height: 100%; pointer-events: none; }
.crop-editor__lines { position: absolute; top: 0; left: 0; width: 100%; height: 100%; pointer-events: none; }
.crop-editor__point {
  position: absolute;
  width: 24px;
  height: 24px;
  margin-left: -12px;
  margin-top: -12px;
  border-radius: 50%;
  background: var(--color-primary, #2563eb);
  color: #fff;
  font-size: 12px;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  pointer-events: auto;
  cursor: grab;
  box-shadow: 0 1px 3px rgba(0,0,0,0.3);
}
.crop-editor__point:active { cursor: grabbing; }
.crop-editor__actions { margin-top: 0.75rem; display: flex; gap: 0.5rem; flex-wrap: wrap; }

.step2-crop-list { display: flex; flex-direction: column; gap: 1.25rem; margin-bottom: 1rem; }
.step2-crop-item { padding: 0.75rem; border: 1px solid var(--color-border); border-radius: 8px; background: var(--color-bg-muted); }
.step2-crop-item__label { margin: 0 0 0.5rem 0; font-size: 0.9rem; font-weight: 600; color: var(--color-text); }
.step2-crop-item__wrap { max-width: 100%; }
.step2-crop-item__img { max-height: 280px; }
.step2-crop-item__reset { margin-top: 0.5rem; }

.import-result {
  margin-top: 1.5rem;
  padding: 1.25rem;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  background: var(--color-bg-muted);
}
.import-result__title { margin: 0 0 0.5rem 0; font-size: 1.1rem; font-weight: 600; color: var(--color-text); }
.import-result__link { margin: 0 0 0.5rem 0; font-size: 0.95rem; color: var(--color-text); }
.import-result__link a { color: var(--color-link, #0a7ea4); }
.import-result__usage { margin: 0.5rem 0; font-size: 0.85rem; color: var(--color-text-muted); }
.import-result__parsed { margin-top: 0.75rem; padding-top: 0.75rem; border-top: 1px solid var(--color-border); }
.import-result__field { margin: 0.25rem 0; font-size: 0.9rem; color: var(--color-text); }
.import-result__text { white-space: pre-wrap; word-break: break-word; }
.import-result__label { margin: 0.5rem 0 0.25rem 0; font-size: 0.9rem; color: var(--color-text); }
.import-result__list { margin: 0; padding-left: 1.25rem; list-style: none; }
.import-result__section { margin: 0.25rem 0; }
.import-result__heading { font-weight: 600; font-size: 0.9rem; color: var(--color-text); }
.import-result__items { margin: 0.15rem 0 0 1rem; padding: 0; list-style: disc; font-size: 0.9rem; color: var(--color-text); }
.import-result__steps { margin: 0.25rem 0 0 1.25rem; padding: 0; font-size: 0.9rem; color: var(--color-text); }

.btn { padding: 0.5rem 1rem; border-radius: 4px; font: inherit; cursor: pointer; border: 1px solid transparent; }
.btn:disabled { opacity: 0.7; cursor: not-allowed; }
.btn--primary { background: var(--color-btn-primary-bg); color: var(--color-header-fg); border-color: var(--color-btn-primary-bg); }
.btn--primary:hover:not(:disabled) { background: var(--color-btn-primary-hover); }
.btn--secondary { background: var(--color-btn-secondary-bg); color: var(--color-btn-secondary-fg); border-color: var(--color-btn-secondary-border); }
.btn--secondary:hover:not(:disabled) { background: var(--color-btn-secondary-hover); }
</style>
