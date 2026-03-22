<template>
  <Teleport to="body">
    <div class="overlay" :class="{ 'overlay--step2-crop': step2Files.length > 0 }" @click.self="emit('close')">
      <div class="overlay__panel">
        <div class="overlay__header">
          <h2 class="overlay__title">Add Recipe from Image</h2>
          <button type="button" class="overlay__close" aria-label="Close" @click="emit('close')">×</button>
        </div>
        <div class="overlay__body">
          <p class="overlay__intro">
            Two steps: Optionally a photo of the recipe image, then one or more photos of the recipe text for text recognition.
          </p>

          <!-- Step 1 -->
          <section class="import-step">
            <h3 class="import-step__title">Step 1: Photo of Recipe Image (optional)</h3>
            <p class="import-step__desc">An image of the recipe (e.g., dish or book page). You can also continue without an image.</p>
            <div class="import-options" :class="{ 'import-options--camera-live': !!cameraStream }">
              <div class="import-option">
                <h4 class="import-option__title">Select File</h4>
                <input ref="step1FileRef" type="file" accept="image/*" class="import-option__input" aria-label="Select image" @change="onStep1FileSelected" />
                <button type="button" class="btn btn--secondary" @click="step1FileRef?.click()">Select Image…</button>
              </div>
              <div class="import-option import-option--camera">
                <h4 class="import-option__title">Camera</h4>
                <template v-if="!cameraStream">
                  <button type="button" class="btn btn--secondary" :disabled="cameraBusy" @click="startCamera">
                    {{ cameraBusy ? 'Starting…' : 'Take Photo' }}
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
                    <button type="button" class="btn btn--primary" @click="captureStep1">Capture</button>
                    <button type="button" class="btn btn--secondary" @click="stopCamera">Cancel</button>
                  </div>
                </template>
              </div>
            </div>
            <div v-if="step1Preview" class="import-preview">
              <label class="import-defer">
                <input v-model="step1DeferUpload" type="checkbox" />
                <span>Upload original now; crop and optimize later (good for phone photos)</span>
              </label>
              <img :src="step1Preview" alt="Preview" class="import-preview__img" />
              <div class="import-preview__actions">
                <button type="button" class="btn btn--primary" :disabled="uploading" @click="uploadStep1">{{ uploading ? 'Uploading…' : 'Upload' }}</button>
                <button type="button" class="btn btn--secondary" @click="clearStep1">Reset</button>
              </div>
              <p v-if="uploadError" class="import-preview__error">{{ uploadError }}</p>
            </div>
            <div v-if="!currentRecipe" class="import-step__skip">
              <button type="button" class="btn btn--secondary" :disabled="uploading" @click="startWithoutRecipeImage">
                {{ uploading ? 'Creating…' : 'Continue Without Recipe Image' }}
              </button>
            </div>
          </section>

          <!-- Crop -->
          <section v-if="currentRecipe?.image_path" class="import-step">
            <h3 class="import-step__title">Correct Perspective</h3>
            <p class="import-step__desc">
              <template v-if="currentRecipe?.image_processing_pending">
                Optional perspective: click four corners, or leave empty and click Finalize to resize the full image. You can also finish later from the recipe editor.
              </template>
              <template v-else>Click four corners in sequence, then click Crop Image.</template>
            </p>
            <div class="crop-editor">
              <div ref="cropEditorRef" class="crop-editor__wrap" @pointerdown="onCropImagePointerDown">
                <img ref="cropImageRef" :src="cropImageUrl" alt="Recipe Image" class="crop-editor__img" @load="onCropImageLoad" />
                <div class="crop-editor__overlay">
                  <svg v-if="cropPoints.length === 4 && cropDisplaySize.w > 0 && cropDisplaySize.h > 0" class="crop-editor__lines" :viewBox="`0 0 ${cropDisplaySize.w} ${cropDisplaySize.h}`" preserveAspectRatio="none">
                    <polyline :points="cropPolylinePoints" fill="none" stroke="var(--color-primary, #2563eb)" stroke-width="2" stroke-dasharray="6 4" />
                  </svg>
                  <span v-for="(pt, i) in cropPoints" :key="i" class="crop-editor__point" :style="{ left: (pt.x - 12) + 'px', top: (pt.y - 12) + 'px' }" @pointerdown.stop="onCropPointPointerDown($event, i)">{{ i + 1 }}</span>
                </div>
              </div>
              <div class="crop-editor__actions">
                <button
                  type="button"
                  class="btn btn--primary"
                  :disabled="!canRunCropImport || cropping"
                  @click="runCropPerspective"
                >
                  {{ cropping ? 'Applying…' : currentRecipe?.image_processing_pending ? 'Finalize image' : 'Crop Image' }}
                </button>
                <button type="button" class="btn btn--secondary" @click="resetCropPoints">Reset Points</button>
              </div>
              <p v-if="cropError" class="import-preview__error">{{ cropError }}</p>
            </div>
          </section>

          <!-- Step 2 -->
          <section v-if="currentRecipe" class="import-step import-step--step2">
            <h3 class="import-step__title">Step 2: Photo(s) of Recipe Text</h3>
            <p class="import-step__desc">
              One or more photos of the recipe text. When you run extraction, each image is resized on the server and sent to OpenAI immediately in memory—it is
              <strong>not</strong> stored like a deferred Step&nbsp;1 recipe photo (no pending folder).
            </p>
            <div class="import-options" :class="{ 'import-options--camera-live': !!step2CameraStream }">
              <div class="import-option">
                <h4 class="import-option__title">Select Images (multiple allowed)</h4>
                <input ref="step2FileRef" type="file" accept="image/*" multiple class="import-option__input" aria-label="Select text images" @change="onStep2FilesSelected" />
                <button type="button" class="btn btn--secondary" @click="step2FileRef?.click()">Select Images…</button>
              </div>
              <div class="import-option import-option--camera">
                <h4 class="import-option__title">Camera</h4>
                <template v-if="!step2CameraStream">
                  <button type="button" class="btn btn--secondary" :disabled="step2CameraBusy" @click="startStep2Camera">
                    {{ step2CameraBusy ? 'Starting…' : 'Take Photo' }}
                  </button>
                </template>
                <template v-else>
                  <div class="import-option__camera-viewport" :style="step2CameraViewportStyle">
                    <video
                      ref="step2VideoRef"
                      class="import-option__video"
                      autoplay
                      playsinline
                      muted
                      @loadedmetadata="onStep2CameraVideoMetadata"
                    />
                  </div>
                  <div class="import-option__camera-actions">
                    <button type="button" class="btn btn--primary" @click="captureStep2Camera">Add photo</button>
                    <button type="button" class="btn btn--secondary" @click="stopStep2Camera">Close camera</button>
                  </div>
                </template>
              </div>
            </div>
            <div v-if="step2Files.length" class="import-preview import-preview--step2-crop">
              <p class="import-preview__meta">{{ step2Files.length }} image(s). Optionally 4 corners per image for cropping.</p>
              <div class="step2-crop-list">
                <div v-for="(file, idx) in step2Files" :key="idx" class="step2-crop-item">
                  <p class="step2-crop-item__label">Image {{ idx + 1 }}</p>
                  <div :ref="(el) => setStep2CropWrapRef(idx, el)" class="crop-editor__wrap step2-crop-item__wrap" @pointerdown="onStep2CropPointerDown($event, idx)">
                    <img :ref="(el) => setStep2CropImageRef(idx, el)" :src="step2Previews[idx]" :alt="'Text image ' + (idx + 1)" class="crop-editor__img step2-crop-item__img" @load="onStep2CropImageLoad(idx)" />
                    <div class="crop-editor__overlay">
                      <svg v-if="(step2CropPoints[idx]?.length ?? 0) === 4 && (step2DisplaySize[idx]?.w ?? 0) > 0" class="crop-editor__lines" :viewBox="`0 0 ${step2DisplaySize[idx]?.w ?? 0} ${step2DisplaySize[idx]?.h ?? 0}`" preserveAspectRatio="none">
                        <polyline :points="step2PolylinePoints(idx)" fill="none" stroke="var(--color-primary, #2563eb)" stroke-width="2" stroke-dasharray="6 4" />
                      </svg>
                      <span v-for="(pt, pi) in (step2CropPoints[idx] ?? [])" :key="pi" class="crop-editor__point" :style="{ left: (pt.x - 12) + 'px', top: (pt.y - 12) + 'px' }" @pointerdown.stop="onStep2PointPointerDown($event, idx, pi)">{{ pi + 1 }}</span>
                    </div>
                  </div>
                  <button type="button" class="btn btn--secondary step2-crop-item__reset" @click="resetStep2CropPoints(idx)">Reset Points</button>
                </div>
              </div>
              <div class="import-preview__actions">
                <button type="button" class="btn btn--primary" :disabled="extracting" @click="runExtract">
                  {{ extracting ? 'Extracting Text…' : 'Extract Text (OpenAI)' }}
                </button>
                <button type="button" class="btn btn--secondary" @click="clearStep2">Other Images</button>
              </div>
              <p v-if="extractError" class="import-preview__error">{{ extractError }}</p>
            </div>
          </section>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, watch, computed, nextTick, onBeforeUnmount } from 'vue'
import { extractRecipeFromImages } from '../api/recipes'
import type { Recipe } from '../api/recipes'
import { attachCropPointPointerDrag } from '../utils/cropPointerDrag'

const emit = defineEmits<{ done: [recipe: Recipe]; close: [] }>()

const step1FileRef = ref<HTMLInputElement | null>(null)
const step2FileRef = ref<HTMLInputElement | null>(null)
const videoRef = ref<HTMLVideoElement | null>(null)
/** Step 2 text images: separate stream from step 1 so both sections can exist without sharing one video element */
const step2VideoRef = ref<HTMLVideoElement | null>(null)
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
const cameraStream = ref<MediaStream | null>(null)
const cameraBusy = ref(false)
/** Matches native stream dimensions to avoid letterboxing; fallback ~ phone portrait 3472×4624 */
const cameraViewportStyle = ref<Record<string, string>>({
  aspectRatio: '3472 / 4624',
})
const step2CameraStream = ref<MediaStream | null>(null)
const step2CameraBusy = ref(false)
const step2CameraViewportStyle = ref<Record<string, string>>({
  aspectRatio: '3472 / 4624',
})

const cropImageRef = ref<HTMLImageElement | null>(null)
const cropEditorRef = ref<HTMLDivElement | null>(null)
const cropImageUrl = ref('')
const cropPoints = ref<Array<{ x: number; y: number }>>([])
const cropDisplaySize = ref({ w: 0, h: 0 })
const cropping = ref(false)
const cropError = ref('')
let cropDragUnsubscribe: (() => void) | null = null
const step1DeferUpload = ref(false)

const imagePending = computed(() => currentRecipe.value?.image_processing_pending === true)
const canRunCropImport = computed(() => {
  const n = cropPoints.value.length
  if (cropping.value) return false
  if (imagePending.value) return n === 0 || n === 4
  return n === 4
})

const cropPolylinePoints = computed(() => {
  if (cropPoints.value.length !== 4) return ''
  const pts = cropPoints.value
  return `${pts[0].x},${pts[0].y} ${pts[1].x},${pts[1].y} ${pts[2].x},${pts[2].y} ${pts[3].x},${pts[3].y} ${pts[0].x},${pts[0].y}`
})

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

function onCropImagePointerDown(e: PointerEvent) {
  if (cropPoints.value.length >= 4 || !cropEditorRef.value) return
  if ((e.target as HTMLElement).closest?.('.crop-editor__point')) return
  if (e.pointerType === 'mouse' && e.button !== 0) return
  const target = e.currentTarget as HTMLElement
  const rect = target.getBoundingClientRect()
  const x = Math.max(0, Math.min(rect.width, e.clientX - rect.left))
  const y = Math.max(0, Math.min(rect.height, e.clientY - rect.top))
  cropPoints.value = [...cropPoints.value, { x, y }]
  cropError.value = ''
}

function onCropPointPointerDown(e: PointerEvent, index: number) {
  const wrap = cropEditorRef.value
  if (!wrap) return
  attachCropPointPointerDrag(e, {
    wrap,
    onMove: (x, y) => {
      const next = [...cropPoints.value]
      next[index] = { x, y }
      cropPoints.value = next
    },
    onActiveCleanup: (fn) => {
      cropDragUnsubscribe = fn
    },
  })
}

function resetCropPoints() {
  cropPoints.value = []
  cropError.value = ''
}

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
    cropError.value = 'Could not determine image size.'
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
    cropError.value = e instanceof Error ? e.message : 'Cropping failed'
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
  stopStep2Camera()
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
      uploadError.value = 'Camera unavailable'
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

function onStep2CameraVideoMetadata() {
  const v = step2VideoRef.value
  if (!v?.videoWidth || !v?.videoHeight) return
  step2CameraViewportStyle.value = {
    aspectRatio: `${v.videoWidth} / ${v.videoHeight}`,
  }
}

function attachStep2CameraStream(stream: MediaStream) {
  step2CameraStream.value = stream
  nextTick().then(() => {
    if (step2VideoRef.value) {
      step2VideoRef.value.srcObject = stream
      queueMicrotask(() => onStep2CameraVideoMetadata())
    }
  })
}

function startStep2Camera() {
  stopCamera()
  step2CameraBusy.value = true
  extractError.value = ''
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
      attachStep2CameraStream(stream)
    })
    .catch(() => {
      extractError.value = 'Camera unavailable'
    })
    .finally(() => {
      step2CameraBusy.value = false
    })
}

function stopStep2Camera() {
  step2CameraStream.value?.getTracks().forEach((t) => t.stop())
  step2CameraStream.value = null
  if (step2VideoRef.value) step2VideoRef.value.srcObject = null
  step2CameraViewportStyle.value = { aspectRatio: '3472 / 4624' }
}

/** Append a frame from the step 2 camera; keeps the stream open for more shots */
function captureStep2Camera() {
  const video = step2VideoRef.value
  if (!video || !step2CameraStream.value) return
  const canvas = document.createElement('canvas')
  canvas.width = video.videoWidth
  canvas.height = video.videoHeight
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  ctx.drawImage(video, 0, 0)
  canvas.toBlob(
    (blob) => {
      if (!blob) return
      const file = new File([blob], `recipe-text-${Date.now()}.jpg`, { type: 'image/jpeg' })
      const url = URL.createObjectURL(blob)
      step2Files.value = [...step2Files.value, file]
      step2Previews.value = [...step2Previews.value, url]
      step2CropPoints.value = [...step2CropPoints.value, []]
      step2CropImageRefs.value = [...step2CropImageRefs.value, null]
      step2CropWrapRefs.value = [...step2CropWrapRefs.value, null]
      extractError.value = ''
    },
    'image/jpeg',
    0.9
  )
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
      stopStep2Camera()
      step2Files.value = []
      extractError.value = ''
    }
  } catch (e) {
    uploadError.value = e instanceof Error ? e.message : 'Upload failed'
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
      stopStep2Camera()
      step2Files.value = []
      extractError.value = ''
    }
  } catch (e) {
    uploadError.value = e instanceof Error ? e.message : 'Could not create draft'
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
  stopStep2Camera()
  step2Files.value = []
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

function onStep2CropPointerDown(e: PointerEvent, idx: number) {
  const pts = step2CropPoints.value[idx] ?? []
  if (pts.length >= 4) return
  if ((e.target as HTMLElement).closest?.('.crop-editor__point')) return
  if (e.pointerType === 'mouse' && e.button !== 0) return
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

function onStep2PointPointerDown(e: PointerEvent, imageIdx: number, pointIdx: number) {
  const wrap = step2CropWrapRefs.value[imageIdx]
  if (!wrap) return
  attachCropPointPointerDrag(e, {
    wrap,
    onMove: (x, y) => {
      const next = step2CropPoints.value.map((arr, i) => (i === imageIdx ? [...(arr ?? [])] : arr ?? []))
      const imgPts = next[imageIdx]
      if (imgPts[pointIdx] !== undefined) imgPts[pointIdx] = { x, y }
      step2CropPoints.value = next
    },
    onActiveCleanup: (fn) => {
      step2DragState = fn ? { unsubscribe: fn } : null
    },
  })
}

function resetStep2CropPoints(idx: number) {
  const next = [...(step2CropPoints.value ?? [])]
  next[idx] = []
  step2CropPoints.value = next
}

function onStep2FilesSelected(e: Event) {
  stopStep2Camera()
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
  stopStep2Camera()
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

/** Step 2 files (camera or picker) go only to extract-from-images: in-memory resize + AI, no pending/ folder. */
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
        pointsPerImage.push(pts.map((p) => ({ x: Math.round((p.x / rect.width) * nw), y: Math.round((p.y / rect.height) * nh) })))
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
    emit('done', result.recipe)
  } catch (e) {
    extractError.value = e instanceof Error ? e.message : 'Text extraction failed'
  } finally {
    extracting.value = false
  }
}

onBeforeUnmount(() => {
  stopCamera()
  stopStep2Camera()
  if (step1Preview.value) URL.revokeObjectURL(step1Preview.value)
  cropDragUnsubscribe?.()
  step2Previews.value.forEach((url) => URL.revokeObjectURL(url))
  step2DragState?.unsubscribe()
})
</script>

<style scoped>
.overlay {
  position: fixed;
  inset: 0;
  z-index: 1000;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1rem;
}
.overlay__panel {
  background: var(--color-bg-elevated, #fff);
  border-radius: 12px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
  max-width: 42rem;
  width: 100%;
  max-height: 90vh;
  display: flex;
  flex-direction: column;
}
.overlay__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1rem 1.25rem;
  border-bottom: 1px solid var(--color-border);
  flex-shrink: 0;
}
.overlay__title { margin: 0; font-size: 1.25rem; font-weight: 600; color: var(--color-text); }
.overlay__close {
  width: 2.5rem;
  height: 2.5rem;
  padding: 0;
  border: none;
  background: transparent;
  font-size: 1.5rem;
  line-height: 1;
  cursor: pointer;
  color: var(--color-text-muted);
  border-radius: 4px;
}
.overlay__close:hover { background: var(--color-bg-muted); color: var(--color-text); }
.overlay__body { padding: 1.25rem; overflow-y: auto; flex: 1; min-height: 0; }
.overlay__intro { margin: 0 0 1rem 0; font-size: 0.95rem; color: var(--color-text-muted); }

.import-step { margin-bottom: 1.5rem; padding: 1rem; border: 1px solid var(--color-border); border-radius: 8px; background: var(--color-bg-muted); }
.import-step__title { margin: 0 0 0.5rem 0; font-size: 1rem; font-weight: 600; color: var(--color-text); }
.import-step__desc { margin: 0 0 0.75rem 0; font-size: 0.9rem; color: var(--color-text-muted); }
.import-step__skip { margin-top: 0.5rem; }
.import-options { display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem; margin-bottom: 0.75rem; }
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
.import-option { padding: 0.75rem; border: 1px solid var(--color-border); border-radius: 6px; background: var(--color-bg); }
.import-option__title { margin: 0 0 0.5rem 0; font-size: 0.9rem; font-weight: 600; color: var(--color-text); }
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

.import-preview { margin-top: 0.75rem; padding: 0.75rem; border-radius: 6px; background: var(--color-bg); }
.import-preview__img {
  display: block;
  max-width: 100%;
  width: auto;
  height: auto;
  max-height: min(78vh, 52rem);
  margin-inline: auto;
  border-radius: 6px;
  margin-bottom: 0.5rem;
  object-fit: contain;
}
.import-preview__actions { display: flex; gap: 0.5rem; margin-bottom: 0.5rem; }
.import-preview__meta { margin: 0 0 0.5rem 0; font-size: 0.85rem; color: var(--color-text-muted); }
.import-preview__error { margin: 0; color: var(--color-error); font-size: 0.9rem; }
.crop-editor { margin-top: 0.75rem; }
.crop-editor__wrap {
  position: relative;
  display: inline-block;
  max-width: 100%;
  cursor: crosshair;
  touch-action: none;
}
.crop-editor__img { display: block; max-width: 100%; max-height: 320px; vertical-align: top; }
/* Step 2 text crop: use vertical space — do not cap at 240px (too small for touch) */
.step2-crop-item .crop-editor__wrap {
  display: block;
  width: 100%;
}
.step2-crop-item .crop-editor__img {
  max-height: min(78vh, 800px);
  width: 100%;
  height: auto;
  object-fit: contain;
}
.crop-editor__overlay { position: absolute; top: 0; left: 0; width: 100%; height: 100%; pointer-events: none; }
.crop-editor__lines { position: absolute; top: 0; left: 0; width: 100%; height: 100%; pointer-events: none; }
.crop-editor__point {
  position: absolute; width: 24px; height: 24px; margin-left: -12px; margin-top: -12px; border-radius: 50%;
  background: var(--color-primary, #2563eb); color: #fff; font-size: 12px; font-weight: 700;
  display: flex; align-items: center; justify-content: center; pointer-events: auto; cursor: grab; box-shadow: 0 1px 3px rgba(0,0,0,0.3);
}
.crop-editor__point:active { cursor: grabbing; }
.crop-editor__actions { margin-top: 0.5rem; display: flex; gap: 0.5rem; flex-wrap: wrap; }
.step2-crop-list { display: flex; flex-direction: column; gap: 1rem; margin-bottom: 0.75rem; }
.step2-crop-item { padding: 0.75rem; border: 1px solid var(--color-border); border-radius: 6px; background: var(--color-bg); }
.step2-crop-item__label { margin: 0 0 0.5rem 0; font-size: 0.9rem; font-weight: 600; color: var(--color-text); }
.step2-crop-item__wrap { max-width: 100%; }
.step2-crop-item__reset { margin-top: 0.5rem; }

/* Mobile: minimize nested padding + maximize crop area when placing 4 corners */
@media (max-width: 639px) {
  .overlay--step2-crop {
    padding: max(0.25rem, env(safe-area-inset-top, 0px)) max(0.25rem, env(safe-area-inset-right, 0px))
      max(0.25rem, env(safe-area-inset-bottom, 0px)) max(0.25rem, env(safe-area-inset-left, 0px));
    align-items: stretch;
  }
  .overlay--step2-crop .overlay__panel {
    max-width: 100%;
    width: 100%;
    max-height: 100%;
    min-height: min(100dvh, 100vh);
    border-radius: 0;
  }
  .overlay--step2-crop .overlay__body {
    padding: 0.5rem max(0.5rem, env(safe-area-inset-left, 0px)) 0.75rem max(0.5rem, env(safe-area-inset-right, 0px));
  }
  .overlay--step2-crop .import-step--step2 {
    padding: 0.4rem;
    margin-bottom: 0.75rem;
  }
  .overlay--step2-crop .import-preview--step2-crop {
    margin-left: -0.15rem;
    margin-right: -0.15rem;
    padding: 0.35rem 0.25rem;
  }
  .overlay--step2-crop .step2-crop-item {
    padding: 0.35rem;
    border-width: 1px;
  }
  .overlay--step2-crop .step2-crop-item .crop-editor__img {
    max-height: min(86vh, 1200px);
  }
  .overlay--step2-crop .crop-editor__point {
    width: 28px;
    height: 28px;
    margin-left: -14px;
    margin-top: -14px;
    font-size: 13px;
  }
}

.btn { padding: 0.5rem 1rem; border-radius: 4px; font: inherit; cursor: pointer; border: 1px solid transparent; }
.btn:disabled { opacity: 0.7; cursor: not-allowed; }
.btn--primary { background: var(--color-btn-primary-bg); color: var(--color-header-fg); border-color: var(--color-btn-primary-bg); }
.btn--primary:hover:not(:disabled) { background: var(--color-btn-primary-hover); }
.btn--secondary { background: var(--color-btn-secondary-bg); color: var(--color-btn-secondary-fg); border-color: var(--color-btn-secondary-border); }
.btn--secondary:hover:not(:disabled) { background: var(--color-btn-secondary-hover); }
</style>
