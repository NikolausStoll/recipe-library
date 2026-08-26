<template>
  <div class="page import-text-page">
    <header class="import-page-header">
      <button type="button" class="import-page-back" :disabled="importing" @click="goBack">
        <span aria-hidden="true">‹</span>
        Zurück
      </button>
      <h1 class="page-header__title h2">Rezept aus Text</h1>
    </header>

    <form class="import-page-content" @submit.prevent="runImport">
      <p class="import-page-intro">Füge hier ein vollständiges Rezept oder kopierten Rezepttext ein.</p>
      <label class="text-field__label" for="recipe-text-input">Rezepttext</label>
      <textarea
        id="recipe-text-input"
        v-model="text"
        class="text-field__input"
        placeholder="Rezepttext hier einfügen ..."
        :disabled="importing"
        rows="16"
      />
      <label class="translation-option">
        <input v-model="translateToGerman" type="checkbox" :disabled="importing" />
        <span>Auf Deutsch übersetzen</span>
      </label>
      <div v-if="importing" class="import-status" aria-live="polite">
        <p class="import-status__text">Rezept wird verarbeitet ...</p>
        <p class="import-status__hint">Das kann einen Moment dauern.</p>
      </div>
      <div v-if="error && !importing" class="import-error" role="alert">
        <p class="import-error__title">Import fehlgeschlagen</p>
        <p class="import-error__detail">{{ error }}</p>
        <button type="button" class="btn btn--secondary" @click="error = ''">Text prüfen</button>
      </div>
      <div class="text-import__actions">
        <button type="submit" class="btn btn--primary" :disabled="importing || !text.trim()">
          {{ importing ? 'Rezept wird verarbeitet ...' : 'Rezept verarbeiten' }}
        </button>
        <button type="button" class="btn btn--secondary" :disabled="importing" @click="goBack">Abbrechen</button>
      </div>
    </form>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { importRecipeFromText } from '../api/recipes'

const router = useRouter()
const text = ref('')
const translateToGerman = ref(false)
const importing = ref(false)
const error = ref('')

function goBack() {
  router.push({ name: 'add' })
}

async function runImport() {
  if (!text.value.trim()) return
  importing.value = true
  error.value = ''
  try {
    const result = await importRecipeFromText(text.value, translateToGerman.value)
    router.push({ name: 'recipe-edit', params: { id: String(result.recipe.id) }, query: { from: `/recipes/${result.recipe.id}` } })
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Import fehlgeschlagen'
  } finally {
    importing.value = false
  }
}
</script>

<style scoped>
.import-text-page { display: flex; flex-direction: column; align-items: center; }
.import-page-header, .import-page-content { width: 100%; max-width: 48rem; }
.import-page-header { margin-bottom: var(--spacing-lg); }
.import-page-back { display: inline-flex; align-items: center; gap: .25rem; margin-bottom: var(--spacing-sm); padding: .25rem .35rem; border: 0; background: transparent; color: var(--color-text-muted); font: inherit; cursor: pointer; }
.import-page-back span { font-size: 1.4rem; line-height: .8; }
.import-page-back:disabled { opacity: .7; cursor: not-allowed; }
.import-page-content { display: flex; flex-direction: column; gap: .75rem; }
.import-page-intro { color: var(--color-text-muted); line-height: 1.45; }
.text-field__label { font-weight: 600; }
.text-field__input { width: 100%; min-height: 20rem; resize: vertical; padding: .75rem; border: 1px solid var(--color-border); border-radius: 8px; background: var(--color-bg); color: var(--color-text); font: inherit; line-height: 1.5; }
.text-field__input:focus { outline: 2px solid var(--color-primary); outline-offset: 1px; }
.translation-option { display: inline-flex; align-items: center; gap: .5rem; min-height: 2rem; cursor: pointer; }
.import-status, .import-error { padding: .75rem; border: 1px solid var(--color-border); border-radius: 8px; background: var(--color-bg-muted); }
.import-status__text, .import-status__hint, .import-error__title, .import-error__detail { margin: 0; }
.import-status__hint, .import-error__detail { margin-top: .25rem; color: var(--color-text-muted); font-size: .85rem; }
.import-error { border-color: color-mix(in srgb, var(--color-error) 25%, transparent); }
.import-error__title { font-weight: 600; }
.import-error .btn { margin-top: .65rem; }
.text-import__actions { display: flex; flex-wrap: wrap; gap: .5rem; margin-top: .25rem; }
.btn { padding: .5rem 1rem; border: 1px solid transparent; border-radius: 6px; font: inherit; cursor: pointer; }
.btn:disabled { opacity: .7; cursor: not-allowed; }
.btn--primary { background: var(--color-btn-primary-bg); color: var(--color-header-fg); }
.btn--secondary { background: var(--color-btn-secondary-bg); color: var(--color-btn-secondary-fg); border-color: var(--color-btn-secondary-border); }
</style>