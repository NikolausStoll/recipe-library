<template>
  <Teleport to="body">
    <div
      v-if="open"
      class="app-crop-modal-overlay crop-modal"
      role="dialog"
      aria-modal="true"
      :aria-label="title"
      @click.self="onCancel"
    >
      <div class="crop-modal__panel">
        <header class="crop-modal__header">
          <h2 class="crop-modal__title">{{ title }}</h2>
          <button type="button" class="crop-modal__close" aria-label="Close" @click="onCancel">×</button>
        </header>

        <p class="crop-modal__hint">
          Tap the four corners of the page in order (1 → 2 → 3 → 4). Drag markers to adjust. Nothing is saved until you
          tap Done.
        </p>

        <div class="crop-modal__editor">
          <CropPerspectiveEditor
            ref="editorRef"
            v-model:points="displayPoints"
            :src="src"
            :alt="alt"
            active
            @load="onImageLoaded"
          />
        </div>

        <p v-if="errorText" class="crop-modal__error">{{ errorText }}</p>

        <footer class="crop-modal__footer">
          <button type="button" class="btn btn--secondary" @click="onReset">Reset points</button>
          <div class="crop-modal__footer-end">
            <button type="button" class="btn btn--secondary" @click="onCancel">Cancel</button>
            <button type="button" class="btn btn--primary" @click="onDone">Done</button>
          </div>
        </footer>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { nextTick, ref, watch } from 'vue'
import CropPerspectiveEditor from './CropPerspectiveEditor.vue'
import type { CropPoint } from '../utils/cropOverlay'
import { naturalPointsToDisplay } from '../utils/cropImageRect'
import { useBodyModalLock } from '../composables/useBodyModalLock'

export type CropNaturalPoint = { x: number; y: number }

const props = withDefaults(
  defineProps<{
    open: boolean
    src: string
    alt?: string
    title?: string
    /** Previously saved crop in original image pixels (re-opens markers on the image). */
    initialNaturalPoints?: CropNaturalPoint[] | null
  }>(),
  {
    alt: 'Crop preview',
    title: 'Crop image',
    initialNaturalPoints: null,
  },
)

const emit = defineEmits<{
  confirm: [points: CropNaturalPoint[] | null]
  cancel: []
}>()

useBodyModalLock(() => props.open)

const editorRef = ref<InstanceType<typeof CropPerspectiveEditor> | null>(null)
const displayPoints = ref<CropPoint[]>([])
const errorText = ref('')

watch(
  () => [props.open, props.src] as const,
  async ([isOpen]) => {
    if (!isOpen) return
    errorText.value = ''
    displayPoints.value = []
    await nextTick()
    onImageLoaded()
  },
)

function onImageLoaded() {
  const img = editorRef.value?.getImageElement()
  if (!img || props.initialNaturalPoints?.length !== 4) return
  displayPoints.value = naturalPointsToDisplay(props.initialNaturalPoints, img)
}

function onReset() {
  displayPoints.value = []
  errorText.value = ''
}

function onCancel() {
  emit('cancel')
}

function onDone() {
  const n = displayPoints.value.length
  if (n !== 0 && n !== 4) {
    errorText.value = 'Place all four corners, or tap Reset to clear.'
    return
  }
  if (n === 0) {
    emit('confirm', null)
    return
  }
  const natural = editorRef.value?.getNaturalPoints() ?? []
  if (natural.length !== 4) {
    errorText.value = 'Could not read image size. Try again.'
    return
  }
  emit('confirm', natural)
}
</script>

<style scoped>
.crop-modal__panel {
  background: var(--color-bg-elevated, #fff);
  border-radius: 12px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.25);
  max-width: min(960px, 96vw);
  width: 100%;
  max-height: 94vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.crop-modal__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.85rem 1.1rem;
  border-bottom: 1px solid var(--color-border);
}

.crop-modal__title {
  margin: 0;
  font-size: 1.1rem;
  color: var(--color-text);
}

.crop-modal__close {
  width: 2.25rem;
  height: 2.25rem;
  border: 0;
  background: transparent;
  color: var(--color-text-muted);
  font-size: 1.45rem;
  border-radius: 6px;
  cursor: pointer;
}

.crop-modal__close:hover {
  background: var(--color-bg-muted);
  color: var(--color-text);
}

.crop-modal__hint {
  margin: 0;
  padding: 0.65rem 1.1rem 0;
  font-size: 0.88rem;
  color: var(--color-text-muted);
}

.crop-modal__editor {
  padding: 0.75rem 1.1rem;
  flex: 1;
  min-height: 0;
  overflow: auto;
  display: flex;
  justify-content: center;
}

.crop-modal__error {
  margin: 0;
  padding: 0 1.1rem;
  font-size: 0.88rem;
  color: var(--color-error);
}

.crop-modal__footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  padding: 0.85rem 1.1rem;
  border-top: 1px solid var(--color-border);
  flex-wrap: wrap;
}

.crop-modal__footer-end {
  display: flex;
  gap: 0.5rem;
  margin-left: auto;
}

.btn {
  padding: 0.5rem 0.95rem;
  border-radius: 6px;
  font: inherit;
  border: 1px solid transparent;
  cursor: pointer;
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
</style>
