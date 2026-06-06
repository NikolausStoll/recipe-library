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
          <button type="button" class="crop-modal__close" aria-label="Schließen" @click="onCancel">×</button>
        </header>

        <p class="crop-modal__hint">
          {{ hint }}
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
          <div class="crop-modal__footer-start">
            <button type="button" class="crop-modal__reset" @click="onReset">Punkte zurücksetzen</button>
            <button
              v-if="showFullFrameAction"
              type="button"
              class="crop-modal__reset"
              @click="onFullFrame"
            >
              {{ fullFrameLabel }}
            </button>
          </div>
          <div class="crop-modal__footer-actions">
            <button type="button" class="btn btn--secondary" @click="onCancel">Abbrechen</button>
            <button type="button" class="btn btn--primary" @click="onDone">{{ confirmLabel }}</button>
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
    confirmLabel?: string
    hint?: string
    /** Show explicit full-frame finalize (pending images). */
    showFullFrameAction?: boolean
    fullFrameLabel?: string
  }>(),
  {
    alt: 'Bildzuschnitt',
    title: 'Bild zuschneiden',
    initialNaturalPoints: null,
    confirmLabel: 'Fertig',
    hint: 'Tippe die vier Ecken der Seite der Reihe nach an. Ziehe die Punkte, um den Ausschnitt anzupassen. Gespeichert wird erst mit „Fertig“.',
    showFullFrameAction: false,
    fullFrameLabel: 'Ohne Zuschnitt übernehmen',
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

function onFullFrame() {
  errorText.value = ''
  emit('confirm', null)
}

function onDone() {
  const n = displayPoints.value.length
  if (n !== 0 && n !== 4) {
    errorText.value = 'Setze alle vier Ecken oder tippe auf „Punkte zurücksetzen“.'
    return
  }
  if (n === 0) {
    emit('confirm', null)
    return
  }
  const natural = editorRef.value?.getNaturalPoints() ?? []
  if (natural.length !== 4) {
    errorText.value = 'Bildgröße konnte nicht gelesen werden. Bitte erneut versuchen.'
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
  flex-direction: column;
  gap: 0.6rem;
  padding: 0.85rem 1.1rem 1rem;
  border-top: 1px solid var(--color-border);
}

.crop-modal__footer-start {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: center;
  gap: 0.35rem 0.75rem;
}

.crop-modal__reset {
  border: 0;
  background: transparent;
  color: var(--color-text-muted);
  font: inherit;
  font-size: 0.85rem;
  padding: 0.2rem 0.35rem;
  cursor: pointer;
  border-radius: var(--radius-sm, 6px);
}

@media (hover: hover) and (pointer: fine) {
  .crop-modal__reset:hover {
    color: var(--color-text);
    background: var(--color-bg-muted);
  }
}

@media (max-width: 1099px), (hover: none), (pointer: coarse) {
  .crop-modal__reset {
    color: var(--color-text);
    background: var(--color-bg-muted);
  }
}

.crop-modal__footer-actions {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.5rem;
}

.crop-modal__footer-actions .btn {
  width: 100%;
  justify-content: center;
}

@media (min-width: 768px) {
  .crop-modal__footer {
    flex-direction: row;
    flex-wrap: wrap;
    align-items: center;
    justify-content: flex-end;
    gap: 0.5rem;
  }

  .crop-modal__footer-start {
    margin-right: auto;
    justify-content: flex-start;
  }

  .crop-modal__footer-actions {
    display: flex;
    width: auto;
  }

  .crop-modal__footer-actions .btn {
    width: auto;
  }
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

<style>
@media (max-width: 767px) {
  .app-crop-modal-overlay.crop-modal {
    align-items: flex-end;
    padding: 0;
  }

  .app-crop-modal-overlay.crop-modal .crop-modal__panel {
    max-width: none;
    max-height: 92vh;
    border-radius: 12px 12px 0 0;
  }

  .app-crop-modal-overlay.crop-modal .crop-modal__hint {
    font-size: 0.82rem;
    line-height: 1.4;
  }
}
</style>
