<template>
  <Teleport to="body">
    <div class="app-modal-overlay overlay" @click.self="emit('close')">
      <div class="overlay__panel">
        <div class="overlay__header">
          <h2 class="overlay__title">{{ sourceId ? 'Edit Book Source' : 'New Book Source' }}</h2>
          <button type="button" class="overlay__close" aria-label="Close" @click="emit('close')">×</button>
        </div>

        <div class="overlay__body">
          <form class="form" @submit.prevent="save">
            <div class="form__row">
              <label class="form__label" for="src-name">Title *</label>
              <input id="src-name" v-model="form.name" type="text" class="form__input" required :disabled="saving" />
            </div>
            <div class="form__row">
              <label class="form__label" for="src-subtitle">Subtitle</label>
              <input id="src-subtitle" v-model="form.subtitle" type="text" class="form__input" :disabled="saving" />
            </div>
            <div class="form__row form__row--inline">
              <div>
                <label class="form__label" for="src-author">Author</label>
                <input id="src-author" v-model="form.author" type="text" class="form__input" :disabled="saving" />
              </div>
              <div>
                <label class="form__label" for="src-year">Year</label>
                <input
                  id="src-year"
                  v-model.number="form.year"
                  type="number"
                  class="form__input"
                  min="1"
                  max="2100"
                  :disabled="saving"
                />
              </div>
            </div>

            <div class="form__cover">
              <h3 class="form__cover-title">Cover</h3>
              <SourceCoverPicker
                ref="coverPickerRef"
                :source-id="sourceId ?? null"
                :cover-url="effectiveCoverUrl"
                :cover-pending="effectiveCoverPending"
                :disabled="saving"
                @cover-updated="onCoverUpdated"
              />
            </div>

            <p v-if="formError" class="form__error">{{ formError }}</p>
            <p v-if="coverError" class="form__error">{{ coverError }}</p>

            <div class="form__actions">
              <button type="submit" class="btn btn--primary" :disabled="saving || !form.name.trim()">
                {{ saving ? 'Saving…' : 'Save' }}
              </button>
              <button type="button" class="btn btn--secondary" :disabled="saving" @click="emit('close')">Cancel</button>
              <button
                v-if="sourceId"
                type="button"
                class="btn btn--secondary form__delete"
                :disabled="saving"
                @click="onDelete"
              >
                Delete
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import SourceCoverPicker from './SourceCoverPicker.vue'
import { useBodyModalLock } from '../composables/useBodyModalLock'
import {
  createSource,
  updateSource,
  deleteSource,
  uploadSourceCover,
} from '../api/sources'
import type { RecipeSource, RecipeSourceInput } from '../api/sources'

const props = defineProps<{
  sourceId?: number | null
  initial?: RecipeSource | null
}>()

const emit = defineEmits<{ saved: [source: RecipeSource]; deleted: [id: number]; close: [] }>()

useBodyModalLock()

const coverPickerRef = ref<InstanceType<typeof SourceCoverPicker> | null>(null)
const saving = ref(false)
const formError = ref('')
const coverError = ref('')
const patchedSource = ref<RecipeSource | null>(null)

const form = ref({
  name: '',
  subtitle: '',
  author: '',
  year: null as number | null,
})

const effectiveSource = computed(() => patchedSource.value ?? props.initial ?? null)

const effectiveCoverUrl = computed(() => effectiveSource.value?.image_path ?? null)

const effectiveCoverPending = computed(() => effectiveSource.value?.image_processing_pending === true)

function onCoverUpdated(source: RecipeSource) {
  patchedSource.value = source
}

function resetFormFromInitial() {
  const s = props.initial
  form.value = {
    name: s?.name ?? '',
    subtitle: s?.subtitle && s.subtitle !== 'null' ? s.subtitle : '',
    author: s?.author && s.author !== 'null' ? s.author : '',
    year: s?.year ?? null,
  }
  patchedSource.value = null
  formError.value = ''
  coverError.value = ''
}

watch(() => props.initial, resetFormFromInitial, { immediate: true })

async function applyCover(sourceId: number): Promise<RecipeSource | null> {
  const picker = coverPickerRef.value
  if (!picker) return null

  if (picker.wantsRemoveCover()) {
    return updateSource(sourceId, { image_path: null })
  }

  const payload = picker.getUploadPayload()
  if (!payload?.file) return null
  const { source } = await uploadSourceCover(sourceId, payload.file, payload.imagePoints, {
    processImageLater: payload.processImageLater,
  })
  return source
}

async function save() {
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

    let source: RecipeSource
    if (props.sourceId) {
      source = await updateSource(props.sourceId, payload)
    } else {
      source = await createSource(payload)
    }

    const picker = coverPickerRef.value
    const hasCoverWork = Boolean(picker?.getUploadPayload() || picker?.wantsRemoveCover())
    if (hasCoverWork) {
      try {
        const updated = await applyCover(source.id)
        if (updated) source = updated
      } catch (e) {
        coverError.value = e instanceof Error ? e.message : 'Cover konnte nicht gespeichert werden'
        emit('saved', source)
        return
      }
    }

    emit('saved', source)
    emit('close')
  } catch (e) {
    formError.value = e instanceof Error ? e.message : 'Failed to save'
  } finally {
    saving.value = false
  }
}

async function onDelete() {
  if (!props.sourceId) return
  if (
    !confirm(
      'Kochbuch-Quelle löschen?\n\nNur möglich, wenn kein Rezept diese Quelle verwendet.',
    )
  ) {
    return
  }
  saving.value = true
  formError.value = ''
  try {
    await deleteSource(props.sourceId)
    emit('deleted', props.sourceId)
    emit('close')
  } catch (e) {
    formError.value = e instanceof Error ? e.message : 'Delete failed'
  } finally {
    saving.value = false
  }
}
</script>

<style scoped>
.overlay {
  /* extends .app-modal-overlay */
}
.overlay__panel {
  background: var(--color-bg-elevated, #fff);
  border-radius: 12px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
  max-width: 36rem;
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
}
.overlay__title { margin: 0; font-size: 1.15rem; color: var(--color-text); }
.overlay__close {
  width: 2.25rem;
  height: 2.25rem;
  border: 0;
  background: transparent;
  color: var(--color-text-muted);
  font-size: 1.45rem;
  border-radius: 6px;
  cursor: pointer;
}
.overlay__body { padding: 1rem 1.25rem 1.25rem; overflow-y: auto; }
.form__row { margin-bottom: 1rem; }
.form__row--inline { display: flex; gap: 1rem; flex-wrap: wrap; }
.form__row--inline > div { flex: 1; min-width: 140px; }
.form__label { display: block; margin-bottom: 0.25rem; font-size: 0.9rem; font-weight: 500; color: var(--color-text); }
.form__input {
  width: 100%;
  padding: 0.5rem;
  font: inherit;
  border: 1px solid var(--color-border);
  border-radius: 4px;
  background: var(--color-bg);
  color: var(--color-text);
}
.form__cover { margin-top: 0.5rem; padding-top: 1rem; border-top: 1px solid var(--color-border); }
.form__cover-title { margin: 0 0 0.75rem; font-size: 1rem; font-weight: 600; color: var(--color-text); }
.form__actions { display: flex; gap: 0.5rem; flex-wrap: wrap; margin-top: 1rem; }
.form__delete { margin-left: auto; }
.form__error { margin: 0.5rem 0 0; color: var(--color-error); font-size: 0.9rem; }
.btn { padding: 0.5rem 1rem; border-radius: 6px; font: inherit; cursor: pointer; border: 1px solid transparent; }
.btn:disabled { opacity: 0.7; cursor: not-allowed; }
.btn--primary { background: var(--color-btn-primary-bg); color: var(--color-header-fg); }
.btn--secondary { background: var(--color-btn-secondary-bg); color: var(--color-btn-secondary-fg); border-color: var(--color-btn-secondary-border); }

@media (max-width: 767px) {
  .overlay { padding: 0; align-items: stretch; }
  .overlay__panel { max-width: 100%; max-height: 100%; border-radius: 0; }
}
</style>
