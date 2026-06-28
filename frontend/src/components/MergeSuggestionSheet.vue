<template>
  <Teleport to="body">
    <div
      v-if="open && suggestions.length"
      class="app-modal-overlay merge-suggestions"
      role="dialog"
      aria-modal="true"
      aria-labelledby="merge-suggestions-title"
      @click.self="emit('dismiss')"
    >
      <div class="merge-suggestions__panel">
        <header class="merge-suggestions__header">
          <h2 id="merge-suggestions-title" class="merge-suggestions__title">Zusammenlegen?</h2>
          <button type="button" class="merge-suggestions__close" aria-label="Schließen" @click="emit('dismiss')">
            ×
          </button>
        </header>

        <p class="body-text merge-suggestions__intro">
          Diese Einträge könnten dasselbe meinen. Nur bei Zustimmung zusammenlegen.
        </p>

        <ul class="merge-suggestions__list">
          <li v-for="(suggestion, index) in suggestions" :key="`${suggestion.itemAId}-${suggestion.itemBId}`">
            <p class="merge-suggestions__pair">
              <strong>{{ suggestion.nameA }}</strong>
              <span class="meta-text"> und </span>
              <strong>{{ suggestion.nameB }}</strong>
            </p>
            <div class="merge-suggestions__actions">
              <button
                type="button"
                class="btn btn--secondary btn--small"
                @click="emit('merge', suggestion.itemAId, suggestion.itemBId)"
              >
                Als „{{ suggestion.nameA }}“
              </button>
              <button
                type="button"
                class="btn btn--secondary btn--small"
                @click="emit('merge', suggestion.itemBId, suggestion.itemAId)"
              >
                Als „{{ suggestion.nameB }}“
              </button>
              <button type="button" class="btn btn--secondary btn--small" @click="emit('skip', index)">
                Getrennt lassen
              </button>
            </div>
          </li>
        </ul>

        <footer class="merge-suggestions__footer">
          <button type="button" class="btn btn--primary" @click="emit('dismiss')">Fertig</button>
        </footer>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { MergeSuggestion } from '../utils/shoppingListMergeSuggestions'
import { useBodyModalLock } from '../composables/useBodyModalLock'

const props = defineProps<{
  open: boolean
  suggestions: MergeSuggestion[]
}>()

const emit = defineEmits<{
  dismiss: []
  merge: [keepId: string, removeId: string]
  skip: [index: number]
}>()

useBodyModalLock(computed(() => props.open && props.suggestions.length > 0))
</script>

<style scoped>
.merge-suggestions__panel {
  width: min(100%, 30rem);
  max-height: min(85vh, 32rem);
  display: flex;
  flex-direction: column;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg, 12px);
  box-shadow: var(--shadow-soft);
}

.merge-suggestions__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--spacing-lg) var(--spacing-lg) var(--spacing-sm);
}

.merge-suggestions__title {
  font-size: 1.125rem;
  font-weight: 600;
}

.merge-suggestions__close {
  border: none;
  background: transparent;
  font-size: 1.5rem;
  color: var(--color-text-muted);
  cursor: pointer;
}

.merge-suggestions__intro {
  padding: 0 var(--spacing-lg) var(--spacing-sm);
}

.merge-suggestions__list {
  list-style: none;
  margin: 0;
  padding: 0 var(--spacing-lg);
  overflow-y: auto;
}

.merge-suggestions__list li {
  padding: var(--spacing-md) 0;
  border-top: 1px solid var(--color-border);
}

.merge-suggestions__pair {
  margin-bottom: var(--spacing-sm);
}

.merge-suggestions__actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--spacing-xs);
}

.merge-suggestions__footer {
  padding: var(--spacing-lg);
  border-top: 1px solid var(--color-border);
  display: flex;
  justify-content: flex-end;
}
</style>
