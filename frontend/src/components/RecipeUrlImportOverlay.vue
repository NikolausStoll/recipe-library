<template>
  <div class="page import-url-page">
    <header class="import-page-header">
      <button type="button" class="import-page-back" @click="emit('close')">
        <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M15 18L9 12L15 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
        Zurück
      </button>
      <h1 class="page-header__title h2">Rezept von Website importieren</h1>
    </header>

    <div class="import-page-content">
      <p class="import-page-intro">
        Füge einen Link zur Rezeptseite ein. Die Seite wird geladen, strukturierte Daten werden wenn möglich gelesen,
        und das Rezept wird per KI normalisiert. Danach kannst du alles prüfen und bearbeiten.
      </p>
      <label class="url-field__label" for="recipe-url-input">Rezept-URL</label>
      <input
        id="recipe-url-input"
        v-model="url"
        type="url"
        class="url-field__input"
        placeholder="https://…"
        autocomplete="url"
        :disabled="importing"
        @keydown.enter.prevent="runImport"
      />
      <div v-if="importing" class="import-status">
        <p class="import-status__text">Import wird durchgeführt…</p>
        <p class="import-status__hint">Das kann einen Moment dauern.</p>
      </div>
      <p v-if="scrapeWarnings.length && !importing" class="url-import__warnings">
        <strong>Hinweis:</strong>
        {{ scrapeWarnings.join(' ') }}
      </p>
      <div v-if="importFailed && !importing" class="import-error">
        <p class="import-error__title">Import fehlgeschlagen</p>
        <p v-if="error" class="import-error__detail">{{ error }}</p>
        <div class="import-error__actions">
          <button type="button" class="btn btn--primary" @click="retryImport">Erneut versuchen</button>
          <button type="button" class="btn btn--secondary" @click="dismissError">URL prüfen</button>
        </div>
      </div>
      <p v-else-if="error && !importing" class="url-import__error">{{ error }}</p>
      <div class="url-import__actions">
        <button type="button" class="btn btn--primary" :disabled="importing || !url.trim()" @click="runImport">
          {{ importing ? 'Import wird durchgeführt…' : 'Importieren' }}
        </button>
        <button type="button" class="btn btn--secondary" :disabled="importing" @click="emit('close')">Abbrechen</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { importRecipeFromUrl } from '../api/recipes'
import type { Recipe } from '../api/recipes'

const emit = defineEmits<{ done: [recipe: Recipe]; close: [] }>()

const url = ref('')
const importing = ref(false)
const importFailed = ref(false)
const error = ref('')
const scrapeWarnings = ref<string[]>([])

async function runImport() {
  const u = url.value.trim()
  if (!u) return
  importing.value = true
  importFailed.value = false
  error.value = ''
  scrapeWarnings.value = []
  try {
    const result = await importRecipeFromUrl(u)
    scrapeWarnings.value = result.scrape.warnings ?? []
    emit('done', result.recipe)
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Import fehlgeschlagen'
    importFailed.value = true
  } finally {
    importing.value = false
  }
}

function retryImport() {
  importFailed.value = false
  void runImport()
}

function dismissError() {
  importFailed.value = false
  error.value = ''
}
</script>

<style scoped>
.import-url-page {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.import-page-header {
  width: 100%;
  max-width: 32rem;
  margin-bottom: var(--spacing-lg);
}

.import-page-back {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  margin-bottom: var(--spacing-sm);
  padding: 0.25rem 0.35rem;
  border: 0;
  background: transparent;
  color: var(--color-text-muted);
  font: inherit;
  font-size: 0.9rem;
  cursor: pointer;
  border-radius: var(--radius-sm);
}

.import-page-back svg {
  width: 1.1rem;
  height: 1.1rem;
}

.import-page-back:hover {
  color: var(--color-text);
  background: var(--color-bg-muted);
}

.import-page-content {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  width: 100%;
  max-width: 32rem;
}

.import-page-intro {
  margin: 0;
  font-size: 0.95rem;
  color: var(--color-text-muted);
  line-height: 1.45;
}

.url-field__label {
  display: block;
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--color-text);
}

.url-field__input {
  width: 100%;
  box-sizing: border-box;
  padding: 0.6rem 0.75rem;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  font: inherit;
  background: var(--color-bg);
  color: var(--color-text);
}

.url-field__input:focus {
  outline: 2px solid var(--color-primary, #2563eb);
  outline-offset: 1px;
}

.url-field__input:disabled {
  opacity: 0.7;
}

.import-status {
  padding: 0.65rem 0.75rem;
  border-radius: 8px;
  background: var(--color-bg-muted);
  border: 1px solid var(--color-border);
}

.import-status__text {
  margin: 0;
  font-size: 0.9rem;
  color: var(--color-text);
}

.import-status__hint {
  margin: 0.25rem 0 0;
  font-size: 0.82rem;
  color: var(--color-text-muted);
}

.import-error {
  padding: 0.75rem;
  border-radius: 8px;
  background: color-mix(in srgb, var(--color-error) 8%, var(--color-bg-muted));
  border: 1px solid color-mix(in srgb, var(--color-error) 25%, transparent);
}

.import-error__title {
  margin: 0;
  font-weight: 600;
  font-size: 0.92rem;
  color: var(--color-text);
}

.import-error__detail {
  margin: 0.35rem 0 0;
  font-size: 0.85rem;
  color: var(--color-text-muted);
}

.import-error__actions {
  margin-top: 0.65rem;
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.url-import__warnings {
  margin: 0;
  font-size: 0.85rem;
  color: var(--color-text-muted);
}

.url-import__error {
  margin: 0;
  color: var(--color-error);
  font-size: 0.9rem;
}

.url-import__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin-top: 0.25rem;
}

.btn {
  padding: 0.5rem 1rem;
  border-radius: 6px;
  font: inherit;
  cursor: pointer;
  border: 1px solid transparent;
}

.btn:disabled {
  opacity: 0.7;
  cursor: not-allowed;
}

.btn--primary {
  background: var(--color-btn-primary-bg);
  color: var(--color-header-fg);
  border-color: var(--color-btn-primary-bg);
}

.btn--primary:hover:not(:disabled) {
  background: var(--color-btn-primary-hover);
}

.btn--secondary {
  background: var(--color-btn-secondary-bg);
  color: var(--color-btn-secondary-fg);
  border-color: var(--color-btn-secondary-border);
}

.btn--secondary:hover:not(:disabled) {
  background: var(--color-btn-secondary-hover);
}
</style>
