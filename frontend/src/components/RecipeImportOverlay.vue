<template>
  <Teleport to="body">
    <div class="overlay" @click.self="emit('close')">
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
            <div class="import-options">
              <div class="import-option">
                <h4 class="import-option__title">Select File</h4>
                <input ref="step1FileRef" type="file" accept="image/*" class="import-option__input" aria-label="Select image" @change="onStep1FileSelected" />
                <button type="button" class="btn btn--secondary" @click="step1FileRef?.click()">Select Image…</button>
              </div>
              <div class="import-option">
                <h4 class="import-option__title">Camera</h4>
                <template v-if="!cameraStream">
                  <button type="button" class="btn btn--secondary" :disabled="cameraBusy" @click="startCamera">
                    {{ cameraBusy ? 'Starting…' : 'Take Photo' }}
                  </button>
                </template>
                <template v-else>
                  <video ref="videoRef" class="import-option__video" autoplay playsinline muted />
                  <div class="import-option__camera-actions">
                    <button type="button" class="btn btn--primary" @click="captureStep1">Capture</button>
                    <button type="button" class="btn btn--secondary" @click="stopCamera">Cancel</button>
                  </div>
                </template>
              </div>
            </div>
            <div v-if="step1Preview" class="import-preview">
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
            <p class="import-step__desc">Click four corners in sequence, then optionally “Crop Image”.</p>
            <div class="crop-editor">
              <div ref="cropEditorRef" class="crop-editor__wrap" @click="onCropImageClick">
                <img ref="cropImageRef" :src="cropImageUrl" alt="Recipe Image" class="crop-editor__img" @load="onCropImageLoad" />
                <div class="crop-editor__overlay">
                  <svg v-if="cropPoints.length === 4 && cropDisplaySize.w > 0 && cropDisplaySize.h > 0" class="crop-editor__lines" :viewBox="`0 0 ${cropDisplaySize.w} ${cropDisplaySize.h}`" preserveAspectRatio="none">
                    <polyline :points="cropPolylinePoints" fill="none" stroke="var(--color-primary, #2563eb)" stroke-width="2" stroke-dasharray="6 4" />
                  </svg>
                  <span v-for="(pt, i) in cropPoints" :key="i" class="crop-editor__point" :style="{ left: (pt.x - 12) + 'px', top: (pt.y - 12) + 'px' }" @mousedown.stop="onCropPointMouseDown($event, i)">{{ i + 1 }}</span>
                </div>
              </div>
              <div class="crop-editor__actions">
                <button type="button" class="btn btn--primary" :disabled="cropPoints.length !== 4 || cropping" @click="runCropPerspective">{{ cropping ? 'Cropping…' : 'Crop Image' }}</button>
                <button type="button" class="btn btn--secondary" @click="resetCropPoints">Reset Points</button>
              </div>
              <p v-if="cropError" class="import-preview__error">{{ cropError }}</p>
            </div>
          </section>

          <!-- Step 2 -->
          <section v-if="currentRecipe" class="import-step">
            <h3 class="import-step__title">Step 2: Photo(s) of Recipe Text</h3>
            <p class="import-step__desc">One or more photos of the recipe text. Sent to OpenAI for text recognition.</p>
            <div class="import-options">
              <div class="import-option">
                <h4 class="import-option__title">Select Images (multiple allowed)</h4>
                <input ref="step2FileRef" type="file" accept="image/*" multiple class="import-option__input" aria-label="Select text images" @change="onStep2FilesSelected" />
                <button type="button" class="btn btn--secondary" @click="step2FileRef?.click()">Select Images…</button>
              </div>
            </div>
            <div v-if="step2Files.length" class="import-preview">
              <p class="import-preview__meta">{{ step2Files.length }} image(s). Optionally 4 corners per image for cropping.</p>
              <div class="step2-crop-list">
                <div v-for="(file, idx) in step2Files" :key="idx" class="step2-crop-item">
                  <p class="step2-crop-item__label">Image {{ idx + 1 }}</p>
                  <div :ref="(el) => setStep2CropWrapRef(idx, el)" class="crop-editor__wrap step2-crop-item__wrap" @click="onStep2CropClick($event, idx)">
                    <img :ref="(el) => setStep2CropImageRef(idx, el)" :src="step2Previews[idx]" :alt="'Text image ' + (idx + 1)" class="crop-editor__img step2-crop-item__img" @load="onStep2CropImageLoad(idx)" />
                    <div class="crop-editor__overlay">
                      <svg v-if="(step2CropPoints[idx]?.length ?? 0) === 4 && (step2DisplaySize[idx]?.w ?? 0) > 0" class="crop-editor__lines" :viewBox="`0 0 ${step2DisplaySize[idx]?.w ?? 0} ${step2DisplaySize[idx]?.h ?? 0}`" preserveAspectRatio="none">
                        <polyline :points="step2PolylinePoints(idx)" fill="none" stroke="var(--color-primary, #2563eb)" stroke-width="2" stroke-dasharray="6 4" />
                      </svg>
                      <span v-for="(pt, pi) in (step2CropPoints[idx] ?? [])" :key="pi" class="crop-editor__point" :style="{ left: (pt.x - 12) + 'px', top: (pt.y - 12) + 'px' }" @mousedown.stop="onStep2PointMouseDown($event, idx, pi)">{{ pi + 1 }}</span>
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

const emit = defineEmits<{ done: [recipe: Recipe]; close: [] }>()

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
const cameraStream = ref<MediaStream | null>(null)
const cameraBusy = ref(false)

const cropImageRef = ref<HTMLImageElement | null>(null)
const cropEditorRef = ref<HTMLDivElement | null>(null)
const cropImageUrl = ref('')
const cropPoints = ref<Array<{ x: number; y: number }>>([])
const cropDisplaySize = ref({ w: 0, h: 0 })
const cropping = ref(false)
const cropError = ref('')
let cropDragUnsubscribe: (() => void) | null = null

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

async function runCropPerspective() {
  const recipe = currentRecipe.value
  const img = cropImageRef.value
  if (!recipe || !recipe.image_path || cropPoints.value.length !== 4 || !img) return
  const rect = img.getBoundingClientRect()
  const nw = img.naturalWidth
  const nh = img.naturalHeight
  if (rect.width <= 0 || rect.height <= 0 || nw <= 0 || nh <= 0) {
    cropError.value = 'Could not determine image size.'
    return
  }
  const points = cropPoints.value.map((p) => ({
    x: Math.round((p.x / rect.width) * nw),
    y: Math.round((p.y / rect.height) * nh),
  }))
  cropping.value = true
  cropError.value = ''
  try {
    const res = await fetch(`/api/recipes/${recipe.id}/crop-perspective`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ points }),
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

function startCamera() {
  cameraBusy.value = true
  uploadError.value = ''
  navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false }).then(
    (stream) => {
      cameraStream.value = stream
      nextTick().then(() => {
        if (videoRef.value) videoRef.value.srcObject = stream
      })
    },
    () => { uploadError.value = 'Camera nicht verfügbar' }
  ).finally(() => { cameraBusy.value = false })
}

function stopCamera() {
  cameraStream.value?.getTracks().forEach((t) => t.stop())
  cameraStream.value = null
  if (videoRef.value) videoRef.value.srcObject = null
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
    const res = await fetch('/api/upload', { method: 'POST', body: form })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error((data as { error?: string }).error || res.statusText)
    const payload = data as { url?: string; recipe?: Recipe }
    if (payload.recipe) {
      currentRecipe.value = payload.recipe
      step1Preview.value = null
      step1File.value = null
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
  currentRecipe.value = null
  uploadError.value = ''
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
@media (max-width: 480px) { .import-options { grid-template-columns: 1fr; } }
.import-option { padding: 0.75rem; border: 1px solid var(--color-border); border-radius: 6px; background: var(--color-bg); }
.import-option__title { margin: 0 0 0.5rem 0; font-size: 0.9rem; font-weight: 600; color: var(--color-text); }
.import-option__input { position: absolute; width: 0; height: 0; opacity: 0; pointer-events: none; }
.import-option__video { display: block; width: 100%; max-height: 200px; border-radius: 6px; margin-bottom: 0.5rem; background: #000; }
.import-option__camera-actions { display: flex; gap: 0.5rem; }
.import-preview { margin-top: 0.75rem; padding: 0.75rem; border-radius: 6px; background: var(--color-bg); }
.import-preview__img { display: block; max-width: 100%; max-height: 240px; border-radius: 6px; margin-bottom: 0.5rem; }
.import-preview__actions { display: flex; gap: 0.5rem; margin-bottom: 0.5rem; }
.import-preview__meta { margin: 0 0 0.5rem 0; font-size: 0.85rem; color: var(--color-text-muted); }
.import-preview__error { margin: 0; color: var(--color-error); font-size: 0.9rem; }
.crop-editor { margin-top: 0.75rem; }
.crop-editor__wrap { position: relative; display: inline-block; max-width: 100%; cursor: crosshair; }
.crop-editor__img { display: block; max-width: 100%; max-height: 320px; vertical-align: top; }
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
.step2-crop-item__img { max-height: 240px; }
.step2-crop-item__reset { margin-top: 0.5rem; }
.btn { padding: 0.5rem 1rem; border-radius: 4px; font: inherit; cursor: pointer; border: 1px solid transparent; }
.btn:disabled { opacity: 0.7; cursor: not-allowed; }
.btn--primary { background: var(--color-btn-primary-bg); color: var(--color-header-fg); border-color: var(--color-btn-primary-bg); }
.btn--primary:hover:not(:disabled) { background: var(--color-btn-primary-hover); }
.btn--secondary { background: var(--color-btn-secondary-bg); color: var(--color-btn-secondary-fg); border-color: var(--color-btn-secondary-border); }
.btn--secondary:hover:not(:disabled) { background: var(--color-btn-secondary-hover); }
</style>
