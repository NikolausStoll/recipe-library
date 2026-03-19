<template>
  <Teleport to="body">
    <div class="overlay" @click.self="emit('close')">
      <div class="overlay__panel">
        <div class="overlay__header">
          <h2 class="overlay__title">Import Recipe from URL</h2>
          <button type="button" class="overlay__close" aria-label="Close" @click="emit('close')">×</button>
        </div>
        <div class="overlay__body">
          <p class="overlay__intro">
            Paste a link to a recipe page. The page is fetched, structured data is read when available, and the recipe is
            normalized with AI. You can review and edit everything afterward.
          </p>
          <label class="url-field__label" for="recipe-url-input">Recipe URL</label>
          <input
            id="recipe-url-input"
            v-model="url"
            type="url"
            class="url-field__input"
            placeholder="https://…"
            autocomplete="url"
            @keydown.enter.prevent="runImport"
          />
          <p v-if="scrapeWarnings.length" class="url-import__warnings">
            <strong>Note:</strong>
            {{ scrapeWarnings.join(' ') }}
          </p>
          <p v-if="error" class="url-import__error">{{ error }}</p>
          <div class="url-import__actions">
            <button type="button" class="btn btn--primary" :disabled="importing || !url.trim()" @click="runImport">
              {{ importing ? 'Importing…' : 'Import' }}
            </button>
            <button type="button" class="btn btn--secondary" :disabled="importing" @click="emit('close')">Cancel</button>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { importRecipeFromUrl } from '../api/recipes'
import type { Recipe } from '../api/recipes'

const emit = defineEmits<{ done: [recipe: Recipe]; close: [] }>()

const url = ref('')
const importing = ref(false)
const error = ref('')
const scrapeWarnings = ref<string[]>([])

async function runImport() {
  const u = url.value.trim()
  if (!u) return
  importing.value = true
  error.value = ''
  scrapeWarnings.value = []
  try {
    const result = await importRecipeFromUrl(u)
    scrapeWarnings.value = result.scrape.warnings ?? []
    emit('done', result.recipe)
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Import failed'
  } finally {
    importing.value = false
  }
}
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
  max-width: 32rem;
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
.overlay__title {
  margin: 0;
  font-size: 1.25rem;
  font-weight: 600;
  color: var(--color-text);
}
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
.overlay__close:hover {
  background: var(--color-bg-muted);
  color: var(--color-text);
}
.overlay__body {
  padding: 1.25rem;
  overflow-y: auto;
  flex: 1;
  min-height: 0;
}
.overlay__intro {
  margin: 0 0 1rem 0;
  font-size: 0.95rem;
  color: var(--color-text-muted);
}
.url-field__label {
  display: block;
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--color-text);
  margin-bottom: 0.35rem;
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
  margin-bottom: 0.75rem;
}
.url-field__input:focus {
  outline: 2px solid var(--color-primary, #2563eb);
  outline-offset: 1px;
}
.url-import__warnings {
  margin: 0 0 0.75rem 0;
  font-size: 0.85rem;
  color: var(--color-text-muted);
}
.url-import__error {
  margin: 0 0 0.75rem 0;
  color: var(--color-error);
  font-size: 0.9rem;
}
.url-import__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}
.btn {
  padding: 0.5rem 1rem;
  border-radius: 4px;
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
