<template>
  <div class="page import-image-page">
    <header class="import-page-header">
      <button type="button" class="import-page-back" :disabled="busy" @click="emit('close')">
        <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M15 18L9 12L15 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
        Zurück
      </button>
      <h1 class="page-header__title h2">Rezept aus Bildern hinzufügen</h1>
    </header>

    <div class="import-page-content">
          <div
            v-if="showUploadEmpty"
            class="upload-empty"
          >
            <p class="upload-empty__text">Wähle ein oder mehrere Bilder für den Import.</p>
            <button type="button" class="btn btn--primary" @click="openFilePicker">Bilder auswählen</button>
          </div>

          <div
            v-else-if="showDropzone"
            class="dropzone"
            :class="{ 'dropzone--active': dragActive }"
            @dragover.prevent="dragActive = true"
            @dragleave.prevent="dragActive = false"
            @drop.prevent="onDrop"
          >
            <p class="dropzone__title">Bilder hier ablegen</p>
            <button type="button" class="btn btn--primary" @click="openFilePicker">Bilder auswählen</button>
            <button type="button" class="btn btn--ghost" @click="startMobileCamera">Kamera verwenden</button>
          </div>

          <div v-if="mobileCameraStream" class="camera">
            <video ref="mobileVideoRef" class="camera__video" autoplay playsinline muted />
            <div class="camera__actions">
              <button type="button" class="btn btn--primary" @click="captureMobilePhoto">Aufnehmen</button>
              <button type="button" class="btn btn--secondary" @click="stopMobileCamera">Schließen</button>
            </div>
          </div>

          <input
            ref="fileInputRef"
            type="file"
            accept="image/*"
            multiple
            class="hidden-input"
            @change="onPickFiles"
          />

          <p v-if="processingFiles" class="processing">Bilder werden verarbeitet…</p>
          <p v-if="errorText && !busy && !importFailed" class="error">{{ errorText }}</p>

          <div
            v-if="photos.length"
            class="photos"
            :class="{ 'photos--importing': busy }"
            aria-live="polite"
          >
            <div v-for="photo in photos" :key="photo.id" class="photo-card" :class="{ 'photo-card--cover': photo.id === coverId }">
              <div class="photo-card__media">
                <img :src="photo.preview" :alt="photo.file.name" class="photo-card__img" />
                <div class="photo-icons">
                  <button type="button" class="icon-btn" :disabled="busy" title="Bild drehen" @click="rotatePhoto(photo.id)">
                    ↻
                  </button>
                  <button type="button" class="icon-btn" :disabled="busy" title="Zuschneiden" @click="openCrop(photo.id)">▢</button>
                  <button type="button" class="icon-btn" :disabled="busy" title="Entfernen" @click="removePhoto(photo.id)">
                    ×
                  </button>
                </div>
                <span v-if="photo.id === coverId" class="cover-badge">Titelbild</span>
                <span v-if="photo.cropNaturalPoints?.length === 4" class="crop-badge">Zuschnitt gesetzt</span>
              </div>

              <div class="photo-card__actions">
                <button
                  type="button"
                  class="btn btn--tiny"
                  :class="photo.id === coverId ? 'btn--primary' : 'btn--secondary'"
                  :disabled="busy"
                  @click="setCover(photo.id)"
                >
                  {{ photo.id === coverId ? 'Titelbild' : 'Als Titelbild' }}
                </button>
              </div>
            </div>
          </div>

          <div v-if="photos.length" class="import-footer">
            <div
              v-if="busy"
              class="import-status"
              role="status"
              aria-live="polite"
            >
              <p class="import-status__text">{{ importStatusText }}</p>
              <p class="import-status__hint">Das kann einen Moment dauern.</p>
            </div>

            <div v-else-if="importFailed" class="import-error" role="alert">
              <p class="import-error__title">Import fehlgeschlagen</p>
              <p v-if="errorText" class="import-error__detail">{{ errorText }}</p>
              <div class="import-error__actions">
                <button type="button" class="btn btn--primary" @click="retryImport">Erneut versuchen</button>
                <button type="button" class="btn btn--secondary" @click="dismissImportError">Bilder prüfen</button>
              </div>
            </div>

            <div class="import-footer__actions">
              <button type="button" class="btn btn--secondary" :disabled="busy" @click="clearAll">Leeren</button>
              <button
                type="button"
                class="btn btn--primary"
                :disabled="busy || photos.length === 0"
                :aria-busy="busy"
                @click="runImport"
              >
                {{ busy ? importStatusText : 'Importieren' }}
              </button>
            </div>
          </div>
    </div>

    <CropPerspectiveModal
      :open="cropModalOpen"
      :src="cropModalSrc"
      title="Bild zuschneiden"
      alt="Bildzuschnitt"
      :initial-natural-points="cropModalInitialPoints"
      @confirm="onCropConfirm"
      @cancel="closeCropModal"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import CropPerspectiveModal from './CropPerspectiveModal.vue'
import type { CropNaturalPoint } from './CropPerspectiveModal.vue'
import { extractRecipeFromImages, type CropPoints } from '../api/recipes'
import type { Recipe } from '../api/recipes'
import { rotateImageFile90 } from '../utils/imageRotate'
import { createPreviewObjectUrl } from '../utils/imagePreview'

type Point = CropNaturalPoint
type PhotoItem = {
  id: number
  file: File
  preview: string
  cropNaturalPoints: Point[] | null
}

const props = defineProps<{
  /** Skip redundant mode picker: open camera or file picker directly. */
  initialMode?: 'camera' | 'upload'
}>()

const emit = defineEmits<{ done: [recipe: Recipe]; close: [] }>()

const fileInputRef = ref<HTMLInputElement | null>(null)
const mobileVideoRef = ref<HTMLVideoElement | null>(null)
const photos = ref<PhotoItem[]>([])
const coverId = ref<number | null>(null)
const dragActive = ref(false)
const errorText = ref('')
const busy = ref(false)
const importFailed = ref(false)
const importPhase = ref<'idle' | 'creating' | 'analyzing' | 'extracting'>('idle')
const processingFiles = ref(false)
const isMobile = ref(false)
const mobileCameraStream = ref<MediaStream | null>(null)

let nextId = 1
let mediaQuery: MediaQueryList | null = null

const cropModalOpen = ref(false)
const cropModalSrc = ref('')
const cropModalPhotoId = ref<number | null>(null)

const cropModalInitialPoints = computed(() => {
  const photo = photos.value.find((p) => p.id === cropModalPhotoId.value)
  return photo?.cropNaturalPoints ?? null
})

const showUploadEmpty = computed(
  () =>
    props.initialMode === 'upload' &&
    photos.value.length === 0 &&
    !mobileCameraStream.value &&
    !processingFiles.value
)

const showDropzone = computed(() => {
  if (photos.value.length > 0) return false
  if (mobileCameraStream.value) return false
  if (props.initialMode === 'camera') return false
  if (props.initialMode === 'upload') return false
  return true
})

function openFilePicker() {
  fileInputRef.value?.click()
}

const importStatusText = computed(() => {
  switch (importPhase.value) {
    case 'creating':
      return 'Import wird durchgeführt…'
    case 'analyzing':
      return 'Bilder werden analysiert…'
    case 'extracting':
      return 'Rezept wird erkannt…'
    default:
      return 'Import wird durchgeführt…'
  }
})

function setMobileFromMedia() {
  if (typeof window === 'undefined') return
  isMobile.value = window.matchMedia('(max-width: 767px), (pointer: coarse)').matches
}

function normalizeImageFiles(files: FileList | File[]): File[] {
  return Array.from(files).filter((f) => f.type.startsWith('image/'))
}

async function appendFiles(files: File[]) {
  if (!files.length || processingFiles.value) return
  processingFiles.value = true
  errorText.value = ''
  importFailed.value = false
  try {
    for (const file of files) {
      const preview = await createPreviewObjectUrl(file)
      const item: PhotoItem = {
        id: nextId++,
        file,
        preview,
        cropNaturalPoints: null,
      }
      photos.value = [...photos.value, item]
      if (coverId.value == null) coverId.value = item.id
    }
  } catch (e) {
    errorText.value = e instanceof Error ? e.message : 'Bilder konnten nicht geladen werden'
  } finally {
    processingFiles.value = false
  }
}

async function onPickFiles(e: Event) {
  const input = e.target as HTMLInputElement
  await appendFiles(normalizeImageFiles(input.files ?? []))
  input.value = ''
}

async function onDrop(e: DragEvent) {
  dragActive.value = false
  await appendFiles(normalizeImageFiles(e.dataTransfer?.files ?? []))
}

function setCover(id: number) {
  coverId.value = id
}

function updatePhoto(id: number, updater: (p: PhotoItem) => PhotoItem) {
  photos.value = photos.value.map((p) => (p.id === id ? updater(p) : p))
}

function revokeCropModalSrc() {
  if (cropModalSrc.value.startsWith('blob:')) URL.revokeObjectURL(cropModalSrc.value)
}

function openCrop(id: number) {
  const photo = photos.value.find((p) => p.id === id)
  if (!photo || busy.value) return
  revokeCropModalSrc()
  cropModalSrc.value = URL.createObjectURL(photo.file)
  cropModalPhotoId.value = id
  cropModalOpen.value = true
}

function closeCropModal() {
  cropModalOpen.value = false
  cropModalPhotoId.value = null
  revokeCropModalSrc()
  cropModalSrc.value = ''
}

function onCropConfirm(points: Point[] | null) {
  if (cropModalPhotoId.value != null) {
    updatePhoto(cropModalPhotoId.value, (p) => ({ ...p, cropNaturalPoints: points }))
  }
  closeCropModal()
}

function removePhoto(id: number) {
  const item = photos.value.find((p) => p.id === id)
  if (!item) return
  URL.revokeObjectURL(item.preview)
  const next = photos.value.filter((p) => p.id !== id)
  photos.value = next
  if (coverId.value === id) coverId.value = next[0]?.id ?? null
}

async function rotatePhoto(id: number) {
  const idx = photos.value.findIndex((p) => p.id === id)
  if (idx < 0) return
  errorText.value = ''
  try {
    const rotated = await rotateImageFile90(photos.value[idx].file)
    const next = [...photos.value]
    URL.revokeObjectURL(next[idx].preview)
    const preview = await createPreviewObjectUrl(rotated)
    next[idx] = {
      ...next[idx],
      file: rotated,
      preview,
      cropNaturalPoints: null,
    }
    photos.value = next
  } catch (e) {
    errorText.value = e instanceof Error ? e.message : 'Bild konnte nicht gedreht werden'
  }
}

async function startMobileCamera() {
  errorText.value = ''
  if (mobileCameraStream.value) return
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: { facingMode: 'environment' },
    })
    mobileCameraStream.value = stream
    await nextTick()
    if (mobileVideoRef.value) mobileVideoRef.value.srcObject = stream
  } catch {
    errorText.value = 'Kamera nicht verfügbar'
  }
}

function stopMobileCamera() {
  mobileCameraStream.value?.getTracks().forEach((t) => t.stop())
  mobileCameraStream.value = null
  if (mobileVideoRef.value) mobileVideoRef.value.srcObject = null
}

function captureMobilePhoto() {
  const video = mobileVideoRef.value
  if (!video || !mobileCameraStream.value) return
  const maxDim = 1920
  let w = video.videoWidth
  let h = video.videoHeight
  if (w <= 0 || h <= 0) return
  const maxEdge = Math.max(w, h)
  if (maxEdge > maxDim) {
    const scale = maxDim / maxEdge
    w = Math.round(w * scale)
    h = Math.round(h * scale)
  }
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  ctx.drawImage(video, 0, 0, w, h)
  canvas.toBlob(
    (blob) => {
      if (!blob) return
      const file = new File([blob], `photo-${Date.now()}.jpg`, { type: 'image/jpeg' })
      void appendFiles([file])
    },
    'image/jpeg',
    0.88
  )
}

function buildCropPointsForPhoto(photo: PhotoItem): CropPoints {
  return photo.cropNaturalPoints?.length === 4 ? photo.cropNaturalPoints : null
}

async function createDraftWithCover(
  coverFile: File | null,
  coverPoints: CropPoints
): Promise<Recipe> {
  const form = new FormData()
  if (coverFile) {
    form.append('image', coverFile)
    if (Array.isArray(coverPoints) && coverPoints.length === 4) {
      form.append('points', JSON.stringify(coverPoints))
    } else {
      form.append('processImageLater', '1')
    }
  }
  const res = await fetch('/api/upload', { method: 'POST', body: form })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error((data as { error?: string }).error || res.statusText)
  const recipe = (data as { recipe?: Recipe }).recipe
  if (!recipe) throw new Error('Entwurf konnte nicht erstellt werden')
  return recipe
}

async function runImport() {
  if (!photos.value.length) return
  busy.value = true
  importFailed.value = false
  errorText.value = ''
  importPhase.value = 'creating'
  try {
    const coverPhoto = photos.value.find((p) => p.id === coverId.value) ?? photos.value[0]
    const coverPoints = buildCropPointsForPhoto(coverPhoto)
    const draft = await createDraftWithCover(coverPhoto?.file ?? null, coverPoints)
    importPhase.value = 'analyzing'
    const ocrPhotos = photos.value.filter((p) => p.id !== coverPhoto.id)
    const photosForExtract = ocrPhotos.length ? ocrPhotos : [coverPhoto]
    const filesForExtract = photosForExtract.map((p) => p.file)
    const pointsPerImage = photosForExtract.map((p) => buildCropPointsForPhoto(p))
    importPhase.value = 'extracting'
    const result = await extractRecipeFromImages(draft.id, filesForExtract, pointsPerImage)
    emit('done', result.recipe)
  } catch (e) {
    errorText.value = e instanceof Error ? e.message : 'Import fehlgeschlagen'
    importFailed.value = true
  } finally {
    busy.value = false
    importPhase.value = 'idle'
  }
}

function retryImport() {
  importFailed.value = false
  void runImport()
}

function dismissImportError() {
  importFailed.value = false
  errorText.value = ''
}

function clearAll() {
  for (const p of photos.value) {
    URL.revokeObjectURL(p.preview)
  }
  photos.value = []
  coverId.value = null
  closeCropModal()
  errorText.value = ''
  importFailed.value = false
}

async function applyInitialMode() {
  if (props.initialMode === 'camera') {
    await startMobileCamera()
  } else if (props.initialMode === 'upload') {
    await nextTick()
    openFilePicker()
  }
}

watch(
  () => props.initialMode,
  () => {
    void applyInitialMode()
  }
)

onMounted(() => {
  setMobileFromMedia()
  if (typeof window === 'undefined') return
  mediaQuery = window.matchMedia('(max-width: 767px), (pointer: coarse)')
  mediaQuery.addEventListener('change', setMobileFromMedia)
  void applyInitialMode()
})

onBeforeUnmount(() => {
  if (mediaQuery) mediaQuery.removeEventListener('change', setMobileFromMedia)
  stopMobileCamera()
  clearAll()
})
</script>

<style scoped>
.import-page-header {
  margin-bottom: var(--spacing-lg);
}

.import-page-back {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  margin-bottom: var(--spacing-sm);
  padding: 0.25rem 0.35rem;
  border: 0;
  background: transparent;
  color: var(--color-text-muted);
  font: inherit;
  font-size: 0.9rem;
  cursor: pointer;
  border-radius: var(--radius-sm);
}

.import-page-back svg {
  width: 1.1rem;
  height: 1.1rem;
}

.import-page-back:hover:not(:disabled) {
  color: var(--color-text);
  background: var(--color-bg-muted);
}

.import-page-back:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.import-page-content {
  display: flex;
  flex-direction: column;
  gap: 0.9rem;
  max-width: 56rem;
}

.upload-empty {
  border: 1px solid var(--color-border);
  border-radius: 12px;
  padding: 1.2rem;
  text-align: center;
  background: var(--color-bg-muted);
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  align-items: center;
}

.upload-empty__text {
  margin: 0;
  font-size: 0.92rem;
  color: var(--color-text-muted);
}

.dropzone { border: 2px dashed var(--color-border); border-radius: 12px; padding: 1.2rem; text-align: center; background: var(--color-bg-muted); display: flex; flex-direction: column; gap: 0.5rem; align-items: center; }
.dropzone--active { border-color: var(--color-primary); background: color-mix(in srgb, var(--color-primary) 7%, var(--color-bg-muted)); }
.dropzone__title { margin: 0; font-weight: 600; color: var(--color-text); }
.camera { border: 1px solid var(--color-border); border-radius: 10px; padding: 0.6rem; background: var(--color-bg-muted); }
.camera__video { width: 100%; max-height: 54vh; object-fit: contain; background: #000; border-radius: 8px; }
.camera__actions { margin-top: 0.5rem; display: flex; gap: 0.5rem; }

.hidden-input { position: absolute; width: 0; height: 0; opacity: 0; pointer-events: none; }
.processing { margin: 0; font-size: 0.9rem; color: var(--color-text-muted); }
.error { margin: 0; font-size: 0.9rem; color: var(--color-error); }

.import-status { padding: 0.65rem 0.75rem; border-radius: 8px; background: var(--color-bg-muted); border: 1px solid var(--color-border); }
.import-status__text { margin: 0; font-size: 0.9rem; color: var(--color-text); }
.import-status__hint { margin: 0.25rem 0 0; font-size: 0.82rem; color: var(--color-text-muted); }

.import-error { padding: 0.75rem; border-radius: 8px; background: color-mix(in srgb, var(--color-error) 8%, var(--color-bg-muted)); border: 1px solid color-mix(in srgb, var(--color-error) 25%, transparent); }
.import-error__title { margin: 0; font-weight: 600; font-size: 0.92rem; color: var(--color-text); }
.import-error__detail { margin: 0.35rem 0 0; font-size: 0.85rem; color: var(--color-text-muted); }
.import-error__actions { margin-top: 0.65rem; display: flex; flex-wrap: wrap; gap: 0.5rem; }

.photos { display: grid; grid-template-columns: repeat(auto-fill, minmax(190px, 1fr)); gap: 0.75rem; }
.photo-card { border: 1px solid var(--color-border); border-radius: 10px; background: var(--color-bg); overflow: hidden; }
.photo-card--cover { border-color: var(--color-primary); box-shadow: 0 0 0 1px color-mix(in srgb, var(--color-primary) 50%, transparent); }
.photo-card__media { position: relative; }
.photo-card__img { display: block; width: 100%; height: 160px; object-fit: cover; background: #ddd; }

.photo-icons { position: absolute; top: 0.4rem; right: 0.4rem; display: flex; gap: 0.3rem; z-index: 2; }
.icon-btn { width: 1.8rem; height: 1.8rem; border: 0; border-radius: 999px; background: rgba(0,0,0,0.62); color: #fff; font-size: 1rem; line-height: 1; cursor: pointer; display: inline-flex; align-items: center; justify-content: center; }
.icon-btn:disabled { opacity: 0.55; cursor: not-allowed; }
.cover-badge { position: absolute; left: 0.45rem; top: 0.45rem; background: var(--color-primary, #2563eb); color: #fff; font-size: 0.7rem; font-weight: 700; padding: 0.2rem 0.4rem; border-radius: 999px; }
.crop-badge { position: absolute; left: 0.45rem; bottom: 0.45rem; background: rgba(0,0,0,0.62); color: #fff; font-size: 0.7rem; font-weight: 600; padding: 0.2rem 0.4rem; border-radius: 999px; }

.photo-card__actions { padding: 0.55rem; display: flex; gap: 0.35rem; flex-wrap: wrap; }

.photos--importing {
  opacity: 0.92;
  pointer-events: none;
}

.import-footer {
  display: flex;
  flex-direction: column;
  gap: 0.65rem;
  margin-top: 0.25rem;
}

.import-footer__actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.btn { padding: 0.5rem 0.95rem; border-radius: 6px; font: inherit; border: 1px solid transparent; cursor: pointer; }
.btn:disabled { opacity: 0.7; cursor: not-allowed; }
.btn--tiny { padding: 0.28rem 0.5rem; font-size: 0.78rem; }
.btn--primary { background: var(--color-btn-primary-bg); color: var(--color-header-fg); border-color: var(--color-btn-primary-bg); }
.btn--primary:hover:not(:disabled) { background: var(--color-btn-primary-hover); }
.btn--secondary { background: var(--color-btn-secondary-bg); color: var(--color-btn-secondary-fg); border-color: var(--color-btn-secondary-border); }
.btn--secondary:hover:not(:disabled) { background: var(--color-btn-secondary-hover); }
.btn--ghost { background: transparent; color: var(--color-text-muted); border-color: transparent; }
.btn--ghost:hover:not(:disabled) { background: var(--color-bg-muted); color: var(--color-text); }
</style>
