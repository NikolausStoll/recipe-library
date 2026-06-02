<template>
  <div class="page sources-view">
    <header class="page-header sources-header">
      <div>
        <h1 class="page-header__title h2">Quellen</h1>
        <p class="page-header__subtitle meta-text">{{ sources.length }} Kochbuch{{ sources.length !== 1 ? 'er' : '' }}</p>
      </div>
      <button type="button" class="btn btn--primary" aria-label="Buchquelle hinzufügen" @click="openNew">Quelle hinzufügen</button>
    </header>

    <SourceBookOverlay
      v-if="overlayOpen"
      :source-id="overlaySourceId"
      :initial="overlayInitial"
      @saved="onSourceSaved"
      @deleted="onSourceDeleted"
      @close="closeOverlay"
    />

    <p v-if="listError" class="form__error">{{ listError }}</p>
    <p v-if="loading && !sources.length" class="loading meta-text">Wird geladen…</p>

    <div v-else class="source-grid">
      <button
        v-for="s in sources"
        :key="s.id"
        type="button"
        class="source-card"
        @click="openEdit(s)"
      >
        <div class="source-card__cover">
          <img
            v-if="s.image_path && !s.image_processing_pending"
            :src="s.image_thumb_path ?? s.image_path"
            :alt="s.name"
            loading="lazy"
          />
          <span v-else-if="s.image_processing_pending" class="source-card__placeholder">Ausstehend</span>
          <span v-else class="source-card__placeholder">Kein Cover</span>
        </div>
        <div class="source-card__body">
          <h2 class="source-card__title">{{ s.name }}</h2>
          <p v-if="displayOptionalText(s.author)" class="source-card__author meta-text">{{ displayOptionalText(s.author) }}</p>
        </div>
      </button>
    </div>

    <p v-if="!loading && !sources.length" class="empty-state">
      <h3>Noch keine Quellen</h3>
      <p>Füge Kochbücher hinzu, aus denen du häufig kochst.</p>
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
  return String(value).trim()
}

async function load() {
  loading.value = true
  listError.value = ''
  try {
    sources.value = await listSources()
  } catch (e) {
    listError.value = e instanceof Error ? e.message : 'Quellen konnten nicht geladen werden'
  } finally {
    loading.value = false
  }
}

function openNew() {
  overlaySourceId.value = null
  overlayInitial.value = null
  overlayOpen.value = true
}

function openEdit(s: RecipeSource) {
  overlaySourceId.value = s.id
  overlayInitial.value = s
  overlayOpen.value = true
}

function closeOverlay() {
  overlayOpen.value = false
}

async function onSourceSaved() {
  closeOverlay()
  await load()
}

async function onSourceDeleted() {
  closeOverlay()
  await load()
}

onMounted(load)
</script>

<style scoped>
.sources-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--spacing-md);
}

.source-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
  gap: var(--spacing-lg);
}

.source-card {
  display: flex;
  flex-direction: column;
  padding: 0;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  background: var(--color-surface);
  overflow: hidden;
  cursor: pointer;
  text-align: left;
  box-shadow: var(--shadow-card);
  transition: box-shadow var(--transition-fast), transform var(--transition-fast);
}

.source-card:hover {
  box-shadow: var(--shadow-soft);
  transform: translateY(-2px);
}

.source-card__cover {
  aspect-ratio: 3 / 4;
  background: var(--color-surface-subtle);
  overflow: hidden;
}

.source-card__cover img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.source-card__placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  font-size: 0.85rem;
  color: var(--color-text-soft);
}

.source-card__body {
  padding: var(--spacing-md);
}

.source-card__title {
  font-size: 1rem;
  font-weight: 620;
  margin: 0 0 4px;
  color: var(--color-text);
  line-height: 1.3;
}

.source-card__author,
.source-card__count {
  margin: 0;
}

.loading {
  padding: var(--spacing-xl);
}
</style>
