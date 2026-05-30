<template>
  <div class="sources-view">
    <div class="sources-header">
      <div class="sources-header__main">
        <h1 class="sources-title">Book Sources</h1>
        <p class="sources-subtitle">
          {{ sources.length }} source{{ sources.length !== 1 ? 's' : '' }}
        </p>
      </div>
      <button
        type="button"
        class="sources-add-btn"
        aria-label="Add book source"
        @click="openNew"
      >
        <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M12 5V19M5 12H19" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </button>
    </div>

    <SourceBookOverlay
      v-if="overlayOpen"
      :source-id="overlaySourceId"
      :initial="overlayInitial"
      @saved="onSourceSaved"
      @deleted="onSourceDeleted"
      @close="closeOverlay"
    />

    <p v-if="listError" class="form__error">{{ listError }}</p>
    <p v-if="loading && !sources.length" class="loading">Loading…</p>

    <ul v-else class="sources-list">
      <li v-for="s in sources" :key="s.id" class="sources-list__item">
        <div class="sources-list__thumb" @click="openEdit(s)">
          <img
            v-if="s.image_path && !s.image_processing_pending"
            :src="s.image_thumb_path ?? s.image_path"
            :alt="s.name"
            class="sources-list__img"
          />
          <span v-else-if="s.image_processing_pending" class="sources-list__pending">Pending</span>
          <span v-else class="sources-list__no-img">No Cover</span>
        </div>
        <div class="sources-list__main" @click="openEdit(s)">
          <strong class="sources-list__name">{{ s.name }}</strong>
          <span v-if="displayOptionalText(s.subtitle)" class="sources-list__subtitle">
            {{ displayOptionalText(s.subtitle) }}
          </span>
          <span v-if="displayOptionalText(s.author) || s.year" class="sources-list__meta">
            {{ [displayOptionalText(s.author), s.year].filter(Boolean).join(', ') }}
          </span>
        </div>
      </li>
    </ul>

    <p v-if="!loading && !sources.length" class="empty">
      No book sources yet. Use + to add one.
    </p>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import SourceBookOverlay from '../components/SourceBookOverlay.vue'
import { listSources } from '../api/sources'
import type { RecipeSource } from '../api/sources'

const sources = ref<RecipeSource[]>([])
const loading = ref(true)
const listError = ref('')
const overlayOpen = ref(false)
const overlaySourceId = ref<number | null>(null)
const overlayInitial = ref<RecipeSource | null>(null)

function displayOptionalText(value: string | null | undefined): string {
  if (value == null || value === 'null') return ''
  const trimmed = String(value).trim()
  return trimmed
}

async function loadList() {
  loading.value = true
  listError.value = ''
  try {
    sources.value = (await listSources()).filter((s) => s.type === 'book')
  } catch (e) {
    listError.value = e instanceof Error ? e.message : 'Failed to load sources'
  } finally {
    loading.value = false
  }
}

function openNew() {
  overlaySourceId.value = null
  overlayInitial.value = null
  overlayOpen.value = true
}

function openEdit(source: RecipeSource) {
  overlaySourceId.value = source.id
  overlayInitial.value = source
  overlayOpen.value = true
}

function closeOverlay() {
  overlayOpen.value = false
  overlaySourceId.value = null
  overlayInitial.value = null
}

function onSourceSaved(source: RecipeSource) {
  const idx = sources.value.findIndex((s) => s.id === source.id)
  if (idx >= 0) sources.value[idx] = source
  else sources.value.unshift(source)
}

function onSourceDeleted(id: number) {
  sources.value = sources.value.filter((s) => s.id !== id)
}

onMounted(() => loadList())
</script>

<style scoped>
.sources-view {
  max-width: 56rem;
  margin: 0 auto;
}

.sources-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  margin-bottom: var(--spacing-xl, 1.5rem);
  gap: var(--spacing-lg, 1rem);
}

.sources-title {
  font-size: 2rem;
  font-weight: 800;
  color: var(--color-text);
  margin: 0 0 var(--spacing-xs, 0.25rem);
  letter-spacing: -0.02em;
}

.sources-subtitle {
  margin: 0;
  font-size: 1rem;
  color: var(--color-text-muted);
}

.sources-add-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 3rem;
  height: 3rem;
  padding: 0;
  border: none;
  border-radius: 50%;
  background: var(--color-primary);
  color: #fff;
  cursor: pointer;
  box-shadow: var(--shadow-md);
  flex-shrink: 0;
  transition: transform var(--transition-fast);
}

.sources-add-btn:hover {
  transform: scale(1.05);
}

.sources-add-btn svg {
  width: 1.5rem;
  height: 1.5rem;
}

.loading,
.empty {
  color: var(--color-text-muted);
}

.form__error {
  color: var(--color-error);
  font-size: 0.9rem;
}

.sources-list {
  list-style: none;
  margin: 0;
  padding: 0;
}

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

.sources-list__img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.sources-list__no-img {
  font-size: 0.7rem;
  color: var(--color-text-muted);
  text-align: center;
  padding: 0.25rem;
}

.sources-list__pending {
  font-size: 0.65rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--color-text-muted);
  text-align: center;
  padding: 0.25rem;
}

.sources-list__main {
  flex: 1;
  min-width: 0;
  cursor: pointer;
}

.sources-list__name {
  display: block;
  color: var(--color-text);
}

.sources-list__subtitle {
  display: block;
  font-size: 0.9rem;
  color: var(--color-text-muted);
}

.sources-list__meta {
  display: block;
  font-size: 0.85rem;
  color: var(--color-text-muted);
  margin-top: 0.2rem;
}

@media (max-width: 768px) {
  .sources-title {
    font-size: 1.75rem;
  }
}
</style>
