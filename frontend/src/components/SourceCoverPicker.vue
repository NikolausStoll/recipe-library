<template>
  <div class="cover-picker">
    <div class="cover-upload">
      <div v-if="hasPreview" class="cover-upload__preview">
        <div class="cover-upload__preview-media">
          <img :src="previewImageSrc" alt="Cover-Vorschau" class="cover-upload__preview-img" />
          <button
            v-if="showPendingOverlay"
            type="button"
            class="cover-upload__preview-pending-wrap"
            aria-label="Zuschneiden und Optimieren"
            @click="openCropModal(coverFile ? 'new' : 'existing')"
          >
            <div class="cover-upload__pending-overlay">
              <span class="cover-upload__pending-label">Noch nicht verarbeitet</span>
              <span class="cover-upload__pending-hint">Tippen zum Zuschneiden und Optimieren</span>
            </div>
          </button>
          <div class="cover-upload__preview-icons">
            <button
              v-if="coverFile"
              type="button"
              class="icon-btn"
              :disabled="disabled"
              title="Bild drehen"
              @click="rotateCover"
            >
              ↻
            </button>
            <button
              type="button"
              class="icon-btn"
              :disabled="disabled"
              title="Zuschneiden"
              @click="openCropModal(coverFile ? 'new' : 'existing')"
            >
              ▢
            </button>
          </div>
        </div>
        <button
          type="button"
          class="cover-upload__remove"
          :disabled="disabled"
          title="Cover entfernen"
          @click="removeCover"
        >
          <svg viewBox="0 0 24 24" fill="none">
            <path d="M18 6L6 18M6 6L18 18" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </button>
      </div>
      <div v-else class="cover-upload__placeholder">
        <svg viewBox="0 0 24 24" fill="none">
          <rect x="3" y="3" width="18" height="18" rx="2" stroke="currentColor" stroke-width="2" />
          <circle cx="8.5" cy="8.5" r="1.5" stroke="currentColor" stroke-width="2" />
          <path d="M21 15L16 10L5 21" stroke="currentColor" stroke-width="2" />
        </svg>
        <p>Noch kein Cover</p>
      </div>

      <input
        ref="fileInputRef"
        type="file"
        accept="image/*"
        class="cover-upload__input"
        :disabled="disabled"
        @change="onPickFile"
      />

      <div v-if="mobileCameraStream" class="cover-upload__camera">
        <div class="cover-upload__camera-viewport" :style="mobileCameraViewportStyle">
          <video
            ref="mobileVideoRef"
            class="cover-upload__camera-video"
            autoplay
            playsinline
            muted
            @loadedmetadata="onMobileCameraVideoMetadata"
          />
        </div>
        <div class="cover-upload__camera-actions">
          <button type="button" class="btn btn--primary" :disabled="disabled" @click="captureMobilePhoto">Aufnehmen</button>
          <button type="button" class="btn btn--secondary" :disabled="disabled" @click="stopMobileCamera">Schließen</button>
        </div>
      </div>

      <div class="cover-upload__actions">
        <button type="button" class="btn btn--secondary" :disabled="disabled" @click="openCoverChangePicker">
          Cover ändern
        </button>
      </div>
    </div>

    <Teleport to="body">
      <div
        v-if="coverChangePickerOpen"
        class="cover-change-picker-overlay"
        role="presentation"
        @click.self="closeCoverChangePicker"
      >
        <div
          class="cover-change-picker"
          role="dialog"
          aria-modal="true"
          aria-labelledby="cover-change-picker-title"
        >
          <h2 id="cover-change-picker-title" class="cover-change-picker__title">Cover ändern</h2>
          <div class="cover-change-picker__options">
            <button type="button" class="cover-change-picker__option" :disabled="disabled" @click="pickCoverUpload">
              Bild hochladen
            </button>
            <button
              v-if="showCameraOption"
              type="button"
              class="cover-change-picker__option"
              :disabled="disabled"
              @click="pickCoverCamera"
            >
              Foto aufnehmen
            </button>
          </div>
          <button type="button" class="btn btn--secondary cover-change-picker__cancel" @click="closeCoverChangePicker">
            Abbrechen
          </button>
        </div>
      </div>
    </Teleport>

    <CropPerspectiveModal
      :open="cropModalOpen"
      :src="cropModalSrc"
      title="Cover zuschneiden"
      alt="Cover-Zuschnitt"
      :initial-natural-points="cropModalInitialPoints"
      :confirm-label="cropModalConfirmLabel"
      :hint="cropModalHint"
      :show-full-frame-action="cropModalShowFullFrame"
      full-frame-label="Ohne Zuschnitt übernehmen"
      @confirm="onCropModalConfirm"
      @cancel="closeCropModal"
    />

    <p v-if="processingPreview" class="cover-picker__meta">Bild wird geladen…</p>
    <p v-if="cropError" class="cover-picker__error">{{ cropError }}</p>
    <p v-if="errorText" class="cover-picker__error">{{ errorText }}</p>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import CropPerspectiveModal from './CropPerspectiveModal.vue'
import type { CropNaturalPoint } from './CropPerspectiveModal.vue'
import { finalizeSourceCoverCrop } from '../api/sources'
import type { RecipeSource } from '../api/sources'
import { rotateImageFile90 } from '../utils/imageRotate'
import { createPreviewObjectUrl } from '../utils/imagePreview'
import { useBodyModalLock } from '../composables/useBodyModalLock'

type Point = CropNaturalPoint

const props = defineProps<{
  disabled?: boolean
  sourceId?: number | null
  coverUrl?: string | null
  coverPending?: boolean
}>()

const emit = defineEmits<{
  'cover-updated': [source: RecipeSource]
}>()

const fileInputRef = ref<HTMLInputElement | null>(null)
const mobileVideoRef = ref<HTMLVideoElement | null>(null)

const coverFile = ref<File | null>(null)
const coverPreview = ref<string | null>(null)
const serverCoverUrl = ref<string | null>(null)
const removeCoverRequested = ref(false)
const newImageCropNaturalPoints = ref<Point[] | null>(null)
const existingCropNaturalPoints = ref<Point[] | null>(null)

const cropModalOpen = ref(false)
const cropModalSrc = ref('')
const cropModalMode = ref<'new' | 'existing'>('new')
const cropError = ref('')
const errorText = ref('')
const processingPreview = ref(false)

const coverChangePickerOpen = ref(false)
const mobileCameraStream = ref<MediaStream | null>(null)
/** Matches native stream dimensions; fallback ~ phone portrait 3472×4624 (3:4) */
const mobileCameraViewportStyle = ref<Record<string, string>>({
  aspectRatio: '3472 / 4624',
})
const cameraSupported = ref(false)
const localPending = ref<boolean | null>(null)

useBodyModalLock(coverChangePickerOpen)

const showCameraOption = computed(() => cameraSupported.value)

const hasUnsavedNewCover = computed(() => coverFile.value != null && coverPreview.value != null)

const showImagePending = computed(() => {
  if (localPending.value !== null) return localPending.value
  return props.coverPending === true
})

const previewImageSrc = computed(() => {
  if (removeCoverRequested.value) return undefined
  if (coverPreview.value) return coverPreview.value
  if (serverCoverUrl.value) return serverCoverUrl.value
  return undefined
})

const hasPreview = computed(() => !!previewImageSrc.value)

const showPendingOverlay = computed(() => {
  if (hasUnsavedNewCover.value) return true
  return showImagePending.value && !!serverCoverUrl.value && !coverPreview.value
})

const cropModalInitialPoints = computed(() =>
  cropModalMode.value === 'new' ? newImageCropNaturalPoints.value : existingCropNaturalPoints.value
)

const cropModalShowFullFrame = computed(
  () => cropModalMode.value === 'existing' && showImagePending.value && !coverFile.value
)

const cropModalConfirmLabel = computed(() => {
  if (cropModalMode.value === 'new') return 'Übernehmen'
  if (cropModalMode.value === 'existing' && props.sourceId != null) return 'Ausschnitt speichern'
  return 'Fertig'
})

const cropModalHint = computed(() => {
  if (cropModalMode.value === 'new') {
    return 'Vier Ecken optional. Mit „Übernehmen“ ohne Ecken wird das ganze Cover übernommen.'
  }
  if (cropModalMode.value === 'existing' && props.sourceId != null) {
    if (showImagePending.value) {
      return 'Vier Ecken setzen oder „Ohne Zuschnitt übernehmen“ für Vollbild-Optimierung.'
    }
    return 'Vier Ecken setzen. Mit „Ausschnitt speichern“ wird sofort gespeichert.'
  }
  return 'Tippe die vier Ecken der Seite der Reihe nach an. Ziehe die Punkte, um den Ausschnitt anzupassen.'
})

function syncServerCoverFromProps() {
  if (coverFile.value) return
  serverCoverUrl.value = props.coverUrl ?? null
  localPending.value = null
  removeCoverRequested.value = false
}

watch(() => [props.coverUrl, props.coverPending] as const, syncServerCoverFromProps, { immediate: true })

function revokePreview() {
  if (coverPreview.value?.startsWith('blob:')) URL.revokeObjectURL(coverPreview.value)
}

function revokeCropModalSrc() {
  if (!cropModalSrc.value.startsWith('blob:')) return
  if (cropModalSrc.value !== coverPreview.value) URL.revokeObjectURL(cropModalSrc.value)
}

async function setPreviewFromFile(file: File) {
  revokePreview()
  coverFile.value = file
  removeCoverRequested.value = false
  processingPreview.value = true
  errorText.value = ''
  try {
    coverPreview.value = await createPreviewObjectUrl(file)
  } catch {
    coverPreview.value = URL.createObjectURL(file)
  } finally {
    processingPreview.value = false
  }
  newImageCropNaturalPoints.value = null
}

function openCoverChangePicker() {
  coverChangePickerOpen.value = true
}

function closeCoverChangePicker() {
  coverChangePickerOpen.value = false
}

function pickCoverUpload() {
  closeCoverChangePicker()
  fileInputRef.value?.click()
}

function pickCoverCamera() {
  closeCoverChangePicker()
  void startMobileCamera()
}

async function onPickFile(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (!file?.type.startsWith('image/')) return
  await setPreviewFromFile(file)
  ;(e.target as HTMLInputElement).value = ''
}

async function rotateCover() {
  if (!coverFile.value) return
  errorText.value = ''
  try {
    const rotated = await rotateImageFile90(coverFile.value)
    await setPreviewFromFile(rotated)
  } catch (e) {
    errorText.value = e instanceof Error ? e.message : 'Bild konnte nicht gedreht werden'
  }
}

function removeCover() {
  revokePreview()
  coverFile.value = null
  coverPreview.value = null
  newImageCropNaturalPoints.value = null
  existingCropNaturalPoints.value = null
  errorText.value = ''
  cropError.value = ''
  if (serverCoverUrl.value) removeCoverRequested.value = true
}

function clearCover() {
  removeCover()
  serverCoverUrl.value = null
  localPending.value = null
}

function openCropModal(mode: 'new' | 'existing') {
  if (props.disabled) return
  cropError.value = ''
  cropModalMode.value = mode
  revokeCropModalSrc()
  if (mode === 'new') {
    if (!coverFile.value) return
    cropModalSrc.value = URL.createObjectURL(coverFile.value)
  } else {
    const src = coverPreview.value || serverCoverUrl.value
    if (!src) return
    cropModalSrc.value = src
  }
  cropModalOpen.value = true
}

function closeCropModal() {
  cropModalOpen.value = false
  revokeCropModalSrc()
  cropModalSrc.value = ''
}

function onCropModalConfirm(points: Point[] | null) {
  if (cropModalMode.value === 'new') {
    newImageCropNaturalPoints.value = points
    closeCropModal()
    return
  }
  existingCropNaturalPoints.value = points
  closeCropModal()
  void applyCropExisting(points)
}

async function applyCropExisting(points: Point[] | null) {
  const sourceId = props.sourceId
  if (!sourceId || !serverCoverUrl.value || coverFile.value) return
  const pending = showImagePending.value
  const n = points?.length ?? 0
  if (!pending && n !== 4) return
  if (pending && n !== 0 && n !== 4) {
    cropError.value = 'Vier Eckpunkte setzen oder Punkte zurücksetzen für Vollbild ohne Perspektivkorrektur.'
    return
  }
  cropError.value = ''
  try {
    const pts = n === 4 && points ? points : undefined
    const { source, url } = await finalizeSourceCoverCrop(sourceId, pts)
    serverCoverUrl.value = url
    localPending.value = false
    existingCropNaturalPoints.value = null
    emit('cover-updated', source)
  } catch (e) {
    cropError.value = e instanceof Error ? e.message : 'Zuschneiden fehlgeschlagen'
  }
}

function getNewImageCropPoints(): Point[] | undefined {
  return newImageCropNaturalPoints.value?.length === 4 ? newImageCropNaturalPoints.value : undefined
}

/** Cover upload runs on source save; leaving without save keeps the server cover unchanged. */
function getUploadPayload(): {
  file: File | null
  imagePoints?: Point[]
  processImageLater: boolean
} | null {
  if (!coverFile.value) return null
  const imagePoints = getNewImageCropPoints()
  return {
    file: coverFile.value,
    imagePoints,
    processImageLater: !(imagePoints && imagePoints.length === 4),
  }
}

function wantsRemoveCover(): boolean {
  return removeCoverRequested.value
}

function hasCover(): boolean {
  return hasPreview.value
}

function onMobileCameraVideoMetadata() {
  const video = mobileVideoRef.value
  if (!video?.videoWidth || !video?.videoHeight) return
  mobileCameraViewportStyle.value = {
    aspectRatio: `${video.videoWidth} / ${video.videoHeight}`,
  }
}

function attachMobileCameraStream(stream: MediaStream) {
  mobileCameraStream.value = stream
  void nextTick().then(() => {
    if (mobileVideoRef.value) {
      mobileVideoRef.value.srcObject = stream
      queueMicrotask(() => onMobileCameraVideoMetadata())
    }
  })
}

async function startMobileCamera() {
  errorText.value = ''
  if (mobileCameraStream.value) return
  if (!navigator.mediaDevices?.getUserMedia) {
    errorText.value = 'Kamera nicht verfügbar'
    return
  }
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

  try {
    const stream = await navigator.mediaDevices
      .getUserMedia(preferred)
      .catch(() => navigator.mediaDevices.getUserMedia(fallback))
    attachMobileCameraStream(stream)
  } catch {
    errorText.value = 'Kamera nicht verfügbar'
  }
}

function stopMobileCamera() {
  mobileCameraStream.value?.getTracks().forEach((t) => t.stop())
  mobileCameraStream.value = null
  if (mobileVideoRef.value) mobileVideoRef.value.srcObject = null
  mobileCameraViewportStyle.value = { aspectRatio: '3472 / 4624' }
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
      void setPreviewFromFile(new File([blob], `cover-${Date.now()}.jpg`, { type: 'image/jpeg' }))
      stopMobileCamera()
    },
    'image/jpeg',
    0.88
  )
}

defineExpose({
  getUploadPayload,
  wantsRemoveCover,
  clearCover,
  hasCover,
  setPreviewFromFile,
})

onMounted(() => {
  cameraSupported.value = Boolean(navigator.mediaDevices?.getUserMedia)
})

onBeforeUnmount(() => {
  closeCoverChangePicker()
  stopMobileCamera()
  closeCropModal()
  revokePreview()
})
</script>

<style scoped>
.cover-picker {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.cover-upload {
  display: flex;
  flex-direction: row;
  align-items: flex-start;
  gap: var(--spacing-md);
  flex-wrap: wrap;
}

.cover-upload__preview {
  position: relative;
  width: 140px;
  height: 190px;
  border-radius: var(--radius-lg);
  overflow: hidden;
  border: 2px solid var(--color-border);
  flex-shrink: 0;
}

.cover-upload__preview-media {
  position: relative;
  width: 100%;
  height: 100%;
}

.cover-upload__preview-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.cover-upload__preview-pending-wrap {
  position: absolute;
  inset: 0;
  z-index: 1;
  display: block;
  padding: 0;
  margin: 0;
  border: 0;
  background: transparent;
  cursor: pointer;
}

.cover-upload__pending-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.25rem;
  padding: var(--spacing-sm);
  background: rgba(0, 0, 0, 0.48);
  color: #fff;
  text-align: center;
}

.cover-upload__pending-label {
  font-size: 0.72rem;
  font-weight: 600;
}

.cover-upload__pending-hint {
  font-size: 0.62rem;
  opacity: 0.92;
  line-height: 1.3;
}

.cover-upload__preview-icons {
  position: absolute;
  top: var(--spacing-sm);
  left: var(--spacing-sm);
  display: flex;
  gap: 0.3rem;
  z-index: 2;
}

.cover-upload__preview-icons .icon-btn {
  width: 1.8rem;
  height: 1.8rem;
  border: 0;
  border-radius: 999px;
  background: rgba(0, 0, 0, 0.62);
  color: #fff;
  font-size: 1rem;
  cursor: pointer;
}

.cover-upload__remove {
  position: absolute;
  top: var(--spacing-sm);
  right: var(--spacing-sm);
  z-index: 2;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  border-radius: var(--radius-md);
  background: rgba(0, 0, 0, 0.7);
  color: white;
  cursor: pointer;
}

.cover-upload__remove:hover:not(:disabled) {
  background: var(--color-error);
}

.cover-upload__remove svg {
  width: 18px;
  height: 18px;
}

.cover-upload__placeholder {
  width: 140px;
  height: 190px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--spacing-sm);
  border: 2px dashed var(--color-border);
  border-radius: var(--radius-lg);
  background: var(--color-bg-muted);
  color: var(--color-text-muted);
  flex-shrink: 0;
}

.cover-upload__placeholder svg {
  width: 32px;
  height: 32px;
  opacity: 0.5;
}

.cover-upload__placeholder p {
  margin: 0;
  font-size: 0.75rem;
}

.cover-upload__input {
  position: absolute;
  width: 0;
  height: 0;
  opacity: 0;
  pointer-events: none;
}

.cover-upload__camera {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
  width: 100%;
  max-width: min(100%, 22rem);
}

.cover-upload__camera-viewport {
  width: 100%;
  max-height: min(85vh, 52rem);
  background: #000;
  border-radius: var(--radius-md);
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
}

.cover-upload__camera-video {
  display: block;
  width: 100%;
  height: auto;
  max-height: min(85vh, 52rem);
  object-fit: contain;
}

.cover-upload__camera-actions {
  display: flex;
  gap: var(--spacing-sm);
  flex-wrap: wrap;
}

.cover-upload__actions {
  display: flex;
  align-items: center;
}

.cover-picker__meta {
  margin: 0;
  font-size: 0.875rem;
  color: var(--color-text-muted);
}

.cover-picker__error {
  margin: 0;
  font-size: 0.875rem;
  color: var(--color-error);
}

.cover-change-picker-overlay {
  position: fixed;
  inset: 0;
  z-index: var(--z-modal);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--spacing-lg);
  background: var(--color-bg-overlay);
}

.cover-change-picker {
  width: min(100%, 22rem);
  padding: var(--spacing-lg);
  border-radius: var(--radius-lg);
  border: 1px solid var(--color-border);
  background: var(--color-surface);
  box-shadow: var(--shadow-soft);
}

.cover-change-picker__title {
  margin: 0 0 var(--spacing-md);
  font-size: 1.125rem;
  font-weight: 650;
  color: var(--color-text);
}

.cover-change-picker__options {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
  margin-bottom: var(--spacing-md);
}

.cover-change-picker__option {
  width: 100%;
  padding: 0.75rem 1rem;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-bg-elevated);
  color: var(--color-text);
  font: inherit;
  font-size: 0.95rem;
  font-weight: 500;
  text-align: left;
  cursor: pointer;
}

.cover-change-picker__option:hover:not(:disabled) {
  border-color: var(--color-border-strong);
  background: var(--color-surface-subtle);
}

.cover-change-picker__option:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.cover-change-picker__cancel {
  width: 100%;
}

.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0.5rem 0.95rem;
  border-radius: 6px;
  font: inherit;
  border: 1px solid transparent;
  cursor: pointer;
}

.btn:disabled {
  opacity: 0.7;
  cursor: not-allowed;
}

.btn--primary {
  background: var(--color-btn-primary-bg);
  color: var(--color-header-fg);
  border-color: var(--color-btn-primary-bg);
}

.btn--secondary {
  background: var(--color-btn-secondary-bg);
  color: var(--color-btn-secondary-fg);
  border-color: var(--color-btn-secondary-border);
}

@media (max-width: 767px) {
  .cover-change-picker-overlay {
    align-items: flex-end;
    padding: 0;
  }

  .cover-change-picker {
    width: 100%;
    max-width: none;
    border-radius: var(--radius-lg) var(--radius-lg) 0 0;
    border-bottom: none;
  }
}
</style>
