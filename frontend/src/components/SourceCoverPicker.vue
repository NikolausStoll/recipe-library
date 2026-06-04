<template>
  <div class="cover-picker">
    <p v-if="pendingImageUrl && !coverFile" class="cover-picker__hint">
      Cover not processed yet — use Crop to set corner points, or save without a crop to keep the full image pending.
    </p>

    <div v-if="!coverPreview && !pendingImageUrl" class="cover-picker__pick">
      <div
        v-if="!isMobile"
        class="dropzone"
        :class="{ 'dropzone--active': dragActive }"
        @dragover.prevent="dragActive = true"
        @dragleave.prevent="dragActive = false"
        @drop.prevent="onDrop"
      >
        <p class="dropzone__title">Drop cover image here</p>
        <button type="button" class="btn btn--primary" :disabled="disabled" @click="fileInputRef?.click()">
          Select Image
        </button>
        <button type="button" class="btn btn--ghost" :disabled="disabled" @click="startMobileCamera">Use camera</button>
      </div>
      <div v-else class="mobile-actions">
        <button type="button" class="btn btn--primary" :disabled="disabled" @click="startMobileCamera">Take Photo</button>
        <button type="button" class="btn btn--secondary" :disabled="disabled" @click="fileInputRef?.click()">
          Upload Image
        </button>
      </div>
    </div>

    <div v-if="mobileCameraStream" class="camera">
      <video ref="mobileVideoRef" class="camera__video" autoplay playsinline muted />
      <div class="camera__actions">
        <button type="button" class="btn btn--primary" @click="captureMobilePhoto">Capture</button>
        <button type="button" class="btn btn--secondary" @click="stopMobileCamera">Close</button>
      </div>
    </div>

    <input
      ref="fileInputRef"
      type="file"
      accept="image/*"
      class="hidden-input"
      :disabled="disabled"
      @change="onPickFile"
    />

    <div v-if="coverPreview" class="photo-card">
      <div class="photo-card__media">
        <img :src="coverPreview" alt="Cover preview" class="photo-card__img" />
        <div class="photo-icons">
          <button
            v-if="coverFile"
            type="button"
            class="icon-btn"
            :disabled="disabled"
            title="Rotate"
            @click="rotateCover"
          >
            ↻
          </button>
          <button type="button" class="icon-btn" :disabled="disabled" title="Crop" @click="openCrop">▢</button>
          <button type="button" class="icon-btn" :disabled="disabled" title="Remove" @click="clearCover">×</button>
        </div>
        <span v-if="hasCrop" class="crop-badge">Zuschnitt gesetzt</span>
      </div>
    </div>

    <CropPerspectiveModal
      :open="cropModalOpen"
      :src="cropModalSrc"
      title="Crop cover"
      alt="Cover crop"
      :initial-natural-points="cropNaturalPoints"
      @confirm="onCropConfirm"
      @cancel="closeCropModal"
    />

    <p v-if="processingPreview" class="processing">Processing image…</p>
    <p v-if="errorText" class="error">{{ errorText }}</p>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import CropPerspectiveModal from './CropPerspectiveModal.vue'
import type { CropNaturalPoint } from './CropPerspectiveModal.vue'
import { rotateImageFile90 } from '../utils/imageRotate'
import { createPreviewObjectUrl } from '../utils/imagePreview'

type Point = CropNaturalPoint

const props = defineProps<{
  disabled?: boolean
  /** Existing pending cover URL (edit flow). */
  pendingImageUrl?: string | null
}>()

const fileInputRef = ref<HTMLInputElement | null>(null)
const mobileVideoRef = ref<HTMLVideoElement | null>(null)

const coverFile = ref<File | null>(null)
const coverPreview = ref<string | null>(null)
const cropNaturalPoints = ref<Point[] | null>(null)
const cropModalOpen = ref(false)
const cropModalSrc = ref('')
const dragActive = ref(false)
const errorText = ref('')
const isMobile = ref(false)
const mobileCameraStream = ref<MediaStream | null>(null)
const processingPreview = ref(false)

let mediaQuery: MediaQueryList | null = null

const hasCrop = computed(() => cropNaturalPoints.value?.length === 4)

function setMobileFromMedia() {
  if (typeof window === 'undefined') return
  isMobile.value = window.matchMedia('(max-width: 767px), (pointer: coarse)').matches
}

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
  processingPreview.value = true
  errorText.value = ''
  try {
    coverPreview.value = await createPreviewObjectUrl(file)
  } catch {
    coverPreview.value = URL.createObjectURL(file)
  } finally {
    processingPreview.value = false
  }
  cropNaturalPoints.value = null
}

function setPreviewFromUrl(url: string) {
  revokePreview()
  coverFile.value = null
  coverPreview.value = url.startsWith('/') ? url : url
  cropNaturalPoints.value = null
  errorText.value = ''
}

async function onPickFile(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (!file?.type.startsWith('image/')) return
  await setPreviewFromFile(file)
  ;(e.target as HTMLInputElement).value = ''
}

async function onDrop(e: DragEvent) {
  dragActive.value = false
  const file = Array.from(e.dataTransfer?.files ?? []).find((f) => f.type.startsWith('image/'))
  if (file) await setPreviewFromFile(file)
}

function clearCover() {
  revokePreview()
  coverFile.value = null
  coverPreview.value = null
  cropNaturalPoints.value = null
  errorText.value = ''
}

async function rotateCover() {
  if (!coverFile.value) return
  errorText.value = ''
  try {
    const rotated = await rotateImageFile90(coverFile.value)
    await setPreviewFromFile(rotated)
  } catch (e) {
    errorText.value = e instanceof Error ? e.message : 'Could not rotate image'
  }
}

function openCrop() {
  if (!coverPreview.value) return
  revokeCropModalSrc()
  cropModalSrc.value = coverFile.value ? URL.createObjectURL(coverFile.value) : coverPreview.value
  cropModalOpen.value = true
}

function closeCropModal() {
  cropModalOpen.value = false
  revokeCropModalSrc()
  cropModalSrc.value = ''
}

function onCropConfirm(points: Point[] | null) {
  cropNaturalPoints.value = points
  closeCropModal()
}

function buildImagePoints(): Point[] | undefined {
  return cropNaturalPoints.value?.length === 4 ? cropNaturalPoints.value : undefined
}

function getUploadPayload(): {
  file: File | null
  imagePoints?: Point[]
  processImageLater: boolean
} | null {
  if (!coverFile.value) return null
  const imagePoints = buildImagePoints()
  return {
    file: coverFile.value,
    imagePoints,
    processImageLater: !(imagePoints && imagePoints.length === 4),
  }
}

/** `false` = invalid point count; `null` = finalize full frame; array = perspective crop */
function getFinalizePoints(): Point[] | null | false {
  const pts = cropNaturalPoints.value
  if (!pts || pts.length === 0) return null
  if (pts.length === 4) return pts
  return false
}

function isFinalizingPending(): boolean {
  return Boolean(props.pendingImageUrl && !coverFile.value && coverPreview.value)
}

function shouldApplyPendingFinalize(): boolean {
  if (!isFinalizingPending()) return false
  const pts = getFinalizePoints()
  return Array.isArray(pts) && pts.length === 4
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
    errorText.value = 'Camera unavailable'
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
      void setPreviewFromFile(new File([blob], `cover-${Date.now()}.jpg`, { type: 'image/jpeg' }))
      stopMobileCamera()
    },
    'image/jpeg',
    0.88
  )
}

watch(
  () => props.pendingImageUrl,
  (url) => {
    if (url) setPreviewFromUrl(url)
  },
  { immediate: true }
)

defineExpose({
  getUploadPayload,
  getFinalizePoints,
  isFinalizingPending,
  shouldApplyPendingFinalize,
  clearCover,
  setPreviewFromFile,
  hasCover: () => Boolean(coverFile.value || coverPreview.value),
})

onMounted(() => {
  setMobileFromMedia()
  if (typeof window === 'undefined') return
  mediaQuery = window.matchMedia('(max-width: 767px), (pointer: coarse)')
  mediaQuery.addEventListener('change', setMobileFromMedia)
})

onBeforeUnmount(() => {
  if (mediaQuery) mediaQuery.removeEventListener('change', setMobileFromMedia)
  stopMobileCamera()
  revokeCropModalSrc()
  revokePreview()
})
</script>

<style scoped>
.cover-picker { display: flex; flex-direction: column; gap: 0.75rem; }
.cover-picker__hint { margin: 0; font-size: 0.9rem; color: var(--color-text-muted); }
.dropzone {
  border: 2px dashed var(--color-border);
  border-radius: 12px;
  padding: 1.2rem;
  text-align: center;
  background: var(--color-bg-muted);
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  align-items: center;
}
.dropzone--active {
  border-color: var(--color-primary);
  background: color-mix(in srgb, var(--color-primary) 7%, var(--color-bg-muted));
}
.dropzone__title { margin: 0; font-weight: 600; color: var(--color-text); }
.mobile-actions { display: grid; grid-template-columns: 1fr; gap: 0.5rem; }
.camera { border: 1px solid var(--color-border); border-radius: 10px; padding: 0.6rem; background: var(--color-bg-muted); }
.camera__video { width: 100%; max-height: 40vh; object-fit: contain; background: #000; border-radius: 8px; }
.camera__actions { margin-top: 0.5rem; display: flex; gap: 0.5rem; }
.hidden-input { position: absolute; width: 0; height: 0; opacity: 0; pointer-events: none; }
.processing { margin: 0; font-size: 0.9rem; color: var(--color-text-muted); }
.error { margin: 0; font-size: 0.9rem; color: var(--color-error); }
.photo-card { border: 1px solid var(--color-border); border-radius: 10px; overflow: hidden; background: var(--color-bg); }
.photo-card__media { position: relative; }
.photo-card__img { display: block; width: 100%; max-height: 280px; object-fit: contain; background: #ddd; }
.photo-icons { position: absolute; top: 0.4rem; right: 0.4rem; display: flex; gap: 0.3rem; z-index: 2; }
.icon-btn {
  width: 1.8rem;
  height: 1.8rem;
  border: 0;
  border-radius: 999px;
  background: rgba(0, 0, 0, 0.62);
  color: #fff;
  font-size: 1rem;
  cursor: pointer;
}
.crop-badge {
  position: absolute;
  left: 0.45rem;
  bottom: 0.45rem;
  background: rgba(0, 0, 0, 0.62);
  color: #fff;
  font-size: 0.7rem;
  font-weight: 600;
  padding: 0.2rem 0.45rem;
  border-radius: 999px;
}
.btn { padding: 0.5rem 0.95rem; border-radius: 6px; font: inherit; border: 1px solid transparent; cursor: pointer; }
.btn:disabled { opacity: 0.7; cursor: not-allowed; }
.btn--primary { background: var(--color-btn-primary-bg); color: var(--color-header-fg); border-color: var(--color-btn-primary-bg); }
.btn--secondary { background: var(--color-btn-secondary-bg); color: var(--color-btn-secondary-fg); border-color: var(--color-btn-secondary-border); }
.btn--ghost { background: transparent; color: var(--color-text-muted); border-color: transparent; }
</style>
