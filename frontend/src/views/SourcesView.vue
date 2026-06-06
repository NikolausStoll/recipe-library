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
            {{ bookSources.length }} {{ bookSources.length === 1 ? 'Kochbuch' : 'Kochbücher' }}
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
              <div v-if="getSourceCoverImageUrl(s)" class="pending-media">
                <img
                  :src="getSourceCoverImageUrl(s)!"
                  :alt="s.name"
                  loading="lazy"
                />
                <div v-if="s.image_processing_pending" class="pending-media__overlay">
                  <span class="pending-media__label">Noch nicht verarbeitet</span>
                </div>
              </div>
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
          <li
            v-for="s in websiteSources"
            :key="s.id"
            class="website-source-row"
            :class="{ 'website-source-row--menu-open': websiteMenuOpenId === s.id }"
          >
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
            <div class="website-source-row__menu-wrap">
              <button
                type="button"
                class="website-source-row__menu-btn"
                :aria-expanded="websiteMenuOpenId === s.id"
                aria-haspopup="true"
                aria-label="Weitere Aktionen"
                @click.stop="toggleWebsiteMenu(s.id)"
              >
                <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <circle cx="12" cy="6" r="1.5" fill="currentColor" />
                  <circle cx="12" cy="12" r="1.5" fill="currentColor" />
                  <circle cx="12" cy="18" r="1.5" fill="currentColor" />
                </svg>
              </button>
              <div
                v-if="websiteMenuOpenId === s.id"
                class="website-source-row__menu"
                role="menu"
                @click.stop
              >
                <button
                  type="button"
                  role="menuitem"
                  class="website-source-row__menu-danger"
                  @click="openWebsiteDeleteDialog(s)"
                >
                  Website-Quelle löschen
                </button>
              </div>
            </div>
          </li>
        </ul>
        <p v-else class="sources-section__empty meta-text">
          Websites werden automatisch angelegt, wenn du Rezepte per URL importierst.
        </p>
      </section>
    </template>

    <div
      v-if="websiteDeleteTarget"
      class="source-delete-dialog-overlay"
      role="presentation"
      @click.self="closeWebsiteDeleteDialog"
    >
      <div
        class="source-delete-dialog"
        role="dialog"
        aria-modal="true"
        :aria-labelledby="websiteDeleteTarget ? 'website-delete-title' : undefined"
      >
        <h3 id="website-delete-title" class="source-delete-dialog__title">Website-Quelle löschen?</h3>
        <p v-if="websiteDeleteRecipeCount === 0" class="source-delete-dialog__text">
          Diese Quelle wird entfernt.
        </p>
        <template v-else>
          <p class="source-delete-dialog__text">
            Diese Quelle ist mit {{ websiteDeleteRecipeCount }} Rezept{{
              websiteDeleteRecipeCount !== 1 ? 'en' : ''
            }}
            verknüpft.
          </p>
          <p class="source-delete-dialog__hint meta-text">
            Die Rezepte bleiben erhalten. Original-URLs der Rezepte werden beibehalten.
          </p>
        </template>
        <p v-if="websiteDeleteError" class="form__error">{{ websiteDeleteError }}</p>
        <div class="source-delete-dialog__actions">
          <button
            type="button"
            class="btn btn--secondary"
            :disabled="websiteDeleteLoading"
            @click="closeWebsiteDeleteDialog"
          >
            Abbrechen
          </button>
          <button
            type="button"
            class="btn btn--danger"
            :disabled="websiteDeleteLoading"
            @click="confirmWebsiteDelete"
          >
            {{
              websiteDeleteRecipeCount > 0
                ? 'Rezepte behalten und Quelle entfernen'
                : 'Löschen'
            }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, onMounted, onBeforeUnmount } from 'vue'
import SourceBookOverlay from '../components/SourceBookOverlay.vue'
import { deleteSource, listSources } from '../api/sources'
import type { RecipeSource } from '../api/sources'
import { getSourceCoverImageUrl } from '../utils/recipeDisplayImage'

const sources = ref<RecipeSource[]>([])
const loading = ref(true)
const listError = ref('')
const overlayOpen = ref(false)
const overlaySourceId = ref<number | null>(null)
const overlayInitial = ref<RecipeSource | null>(null)
const websiteMenuOpenId = ref<number | null>(null)
const websiteDeleteTarget = ref<RecipeSource | null>(null)
const websiteDeleteLoading = ref(false)
const websiteDeleteError = ref('')

/** Ignore the document click that opened the menu (same gesture). */
let ignoreWebsiteMenuOutsideClick = false

const websiteDeleteRecipeCount = computed(() => websiteDeleteTarget.value?.recipe_count ?? 0)

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

function toggleWebsiteMenu(id: number) {
  if (websiteMenuOpenId.value === id) {
    websiteMenuOpenId.value = null
    return
  }
  websiteMenuOpenId.value = id
  ignoreWebsiteMenuOutsideClick = true
  requestAnimationFrame(() => {
    ignoreWebsiteMenuOutsideClick = false
  })
}

function closeWebsiteMenu() {
  websiteMenuOpenId.value = null
}

function openWebsiteDeleteDialog(source: RecipeSource) {
  closeWebsiteMenu()
  websiteDeleteError.value = ''
  websiteDeleteTarget.value = source
}

function closeWebsiteDeleteDialog() {
  if (websiteDeleteLoading.value) return
  websiteDeleteTarget.value = null
  websiteDeleteError.value = ''
}

async function confirmWebsiteDelete() {
  const target = websiteDeleteTarget.value
  if (!target) return
  websiteDeleteLoading.value = true
  websiteDeleteError.value = ''
  const unlinkRecipes = (target.recipe_count ?? 0) > 0
  try {
    await deleteSource(target.id, { unlinkRecipes })
    closeWebsiteDeleteDialog()
    await load()
  } catch (e) {
    websiteDeleteError.value =
      e instanceof Error ? e.message : 'Website-Quelle konnte nicht gelöscht werden'
  } finally {
    websiteDeleteLoading.value = false
  }
}

function onDocumentClickForWebsiteMenu(event: MouseEvent) {
  if (ignoreWebsiteMenuOutsideClick) return
  if (websiteMenuOpenId.value == null) return
  const el = event.target as HTMLElement
  if (el.closest('.website-source-row__menu-wrap')) return
  closeWebsiteMenu()
}

onMounted(() => {
  load()
  document.addEventListener('click', onDocumentClickForWebsiteMenu)
})

onBeforeUnmount(() => {
  document.removeEventListener('click', onDocumentClickForWebsiteMenu)
})
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
  overflow: visible;
}

.website-source-row {
  display: flex;
  align-items: center;
  gap: var(--spacing-md);
  padding: 0.75rem 1rem;
  border-bottom: 1px solid var(--color-border);
  position: relative;
}

.website-source-row--menu-open {
  z-index: 20;
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

.website-source-row__menu-wrap {
  position: relative;
  flex-shrink: 0;
  z-index: 2;
}

.website-source-row__menu-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 44px;
  margin: -4px -8px -4px 0;
  padding: 0;
  border: none;
  border-radius: var(--radius-md);
  background: transparent;
  color: var(--color-text-muted);
  cursor: pointer;
  touch-action: manipulation;
  -webkit-tap-highlight-color: transparent;
}

.website-source-row__menu-btn:hover,
.website-source-row__menu-btn:focus-visible {
  color: var(--color-text);
  background: var(--color-surface-subtle);
  outline: none;
}

.website-source-row__menu-btn svg {
  width: 1.25rem;
  height: 1.25rem;
  pointer-events: none;
}

.website-source-row__menu {
  position: absolute;
  top: calc(100% + 4px);
  right: 0;
  z-index: 50;
  min-width: 12rem;
  padding: 4px;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-soft);
}

.website-source-row__menu button {
  display: block;
  width: 100%;
  min-height: 40px;
  padding: 8px 12px;
  border: none;
  border-radius: var(--radius-sm);
  background: transparent;
  font: inherit;
  font-size: 0.875rem;
  text-align: left;
  color: var(--color-text);
  cursor: pointer;
}

.website-source-row__menu button:hover {
  background: var(--color-surface-subtle);
}

.website-source-row__menu-danger {
  color: var(--color-danger);
}

.source-delete-dialog-overlay {
  position: fixed;
  inset: 0;
  z-index: var(--z-modal);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--spacing-lg);
  background: var(--color-bg-overlay);
}

.source-delete-dialog {
  width: min(100%, 26rem);
  padding: var(--spacing-lg);
  border-radius: var(--radius-lg);
  border: 1px solid var(--color-border);
  background: var(--color-surface);
  box-shadow: var(--shadow-soft);
}

.source-delete-dialog__title {
  margin: 0 0 var(--spacing-sm);
  font-size: 1.125rem;
  font-weight: 650;
  color: var(--color-text);
}

.source-delete-dialog__text {
  margin: 0 0 var(--spacing-sm);
  color: var(--color-text);
  line-height: 1.45;
}

.source-delete-dialog__hint {
  margin: 0 0 var(--spacing-md);
}

.source-delete-dialog__actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--spacing-sm);
  justify-content: flex-end;
  margin-top: var(--spacing-md);
}

.loading {
  padding: var(--spacing-xl);
}
</style>
