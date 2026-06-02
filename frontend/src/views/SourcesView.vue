<template>
  <div class="page sources-view">
    <header class="page-header sources-header">
      <div>
        <h1 class="page-header__title h2">Quellen</h1>
      </div>
      <button type="button" class="btn btn--primary" aria-label="Kochbuch hinzufügen" @click="openNewBook">
        Kochbuch hinzufügen
      </button>
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

    <template v-else>
      <section class="sources-section" aria-labelledby="sources-books-heading">
        <div class="sources-section__head">
          <h2 id="sources-books-heading" class="sources-section__title">Kochbücher</h2>
          <p class="sources-section__count meta-text">
            {{ bookSources.length }} Kochbuch{{ bookSources.length !== 1 ? 'er' : '' }}
          </p>
        </div>

        <div v-if="bookSources.length" class="source-grid">
          <button
            v-for="s in bookSources"
            :key="s.id"
            type="button"
            class="source-card"
            @click="openEditBook(s)"
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
              <h3 class="source-card__title">{{ s.name }}</h3>
              <p v-if="displayOptionalText(s.author)" class="source-card__author meta-text">
                {{ displayOptionalText(s.author) }}
              </p>
              <p v-if="s.recipe_count != null && s.recipe_count > 0" class="source-card__count meta-text">
                {{ s.recipe_count }} Rezept{{ s.recipe_count !== 1 ? 'e' : '' }}
              </p>
            </div>
          </button>
        </div>
        <p v-else class="sources-section__empty meta-text">
          Noch keine Kochbücher. Füge Bücher hinzu, aus denen du häufig kochst.
        </p>
      </section>

      <section class="sources-section sources-section--websites" aria-labelledby="sources-websites-heading">
        <div class="sources-section__head">
          <h2 id="sources-websites-heading" class="sources-section__title">Websites</h2>
          <p class="sources-section__count meta-text">
            {{ websiteSources.length }} Website{{ websiteSources.length !== 1 ? 's' : '' }}
          </p>
        </div>

        <ul v-if="websiteSources.length" class="website-source-list">
          <li v-for="s in websiteSources" :key="s.id" class="website-source-row">
            <span class="website-source-row__icon" aria-hidden="true">
              <img
                v-if="s.favicon_url"
                :src="s.favicon_url"
                alt=""
                width="20"
                height="20"
                loading="lazy"
                @error="onFaviconError($event)"
              />
              <svg v-else viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="1.5" />
                <path d="M3 12h18M12 3c2.5 2.8 4 6 4 9s-1.5 6.2-4 9M12 3c-2.5 2.8-4 6-4 9s1.5 6.2 4 9" stroke="currentColor" stroke-width="1.5" />
              </svg>
            </span>
            <span class="website-source-row__domain">{{ websiteDisplayName(s) }}</span>
            <span class="website-source-row__count meta-text">
              {{ s.recipe_count ?? 0 }} Rezept{{ (s.recipe_count ?? 0) !== 1 ? 'e' : '' }}
            </span>
          </li>
        </ul>
        <p v-else class="sources-section__empty meta-text">
          Websites werden automatisch angelegt, wenn du Rezepte per URL importierst.
        </p>
      </section>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, onMounted } from 'vue'
import SourceBookOverlay from '../components/SourceBookOverlay.vue'
import { listSources } from '../api/sources'
import type { RecipeSource } from '../api/sources'

const sources = ref<RecipeSource[]>([])
const loading = ref(true)
const listError = ref('')
const overlayOpen = ref(false)
const overlaySourceId = ref<number | null>(null)
const overlayInitial = ref<RecipeSource | null>(null)

const bookSources = computed(() => sources.value.filter((s) => s.type === 'book'))
const websiteSources = computed(() =>
  sources.value.filter((s) => s.type === 'url' || s.source_kind === 'website'),
)

function displayOptionalText(value: string | null | undefined): string {
  if (value == null || value === 'null') return ''
  return String(value).trim()
}

function websiteDisplayName(s: RecipeSource): string {
  return (s.domain ?? s.name ?? '').trim() || 'Website'
}

function onFaviconError(event: Event) {
  const img = event.target as HTMLImageElement
  img.style.display = 'none'
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

function openNewBook() {
  overlaySourceId.value = null
  overlayInitial.value = null
  overlayOpen.value = true
}

function openEditBook(s: RecipeSource) {
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
  margin-bottom: var(--spacing-lg);
}

.sources-section {
  margin-bottom: var(--spacing-2xl);
}

.sources-section__head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: var(--spacing-md);
  margin-bottom: var(--spacing-md);
}

.sources-section__title {
  margin: 0;
  font-size: 1.125rem;
  font-weight: 650;
  color: var(--color-text);
}

.sources-section__count {
  margin: 0;
  white-space: nowrap;
}

.sources-section__empty {
  margin: 0;
  padding: var(--spacing-md) 0;
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
  min-height: 120px;
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

.website-source-list {
  list-style: none;
  margin: 0;
  padding: 0;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  background: var(--color-surface);
  overflow: hidden;
}

.website-source-row {
  display: flex;
  align-items: center;
  gap: var(--spacing-md);
  padding: 0.75rem 1rem;
  border-bottom: 1px solid var(--color-border);
}

.website-source-row:last-child {
  border-bottom: none;
}

.website-source-row__icon {
  flex: 0 0 24px;
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--color-text-soft);
}

.website-source-row__icon img {
  width: 20px;
  height: 20px;
  border-radius: 4px;
  object-fit: contain;
}

.website-source-row__icon svg {
  width: 20px;
  height: 20px;
}

.website-source-row__domain {
  flex: 1;
  min-width: 0;
  font-size: 0.95rem;
  font-weight: 500;
  color: var(--color-text);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.website-source-row__count {
  flex-shrink: 0;
  font-size: 0.8125rem;
}

.loading {
  padding: var(--spacing-xl);
}
</style>
