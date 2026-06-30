<template>
  <AddToShoppingSheet
    :open="sheetOpen"
    :recipe="currentRecipe"
    :servings="currentItem?.servings ?? 1"
    :batch-label="batchLabel"
    cancel-label="Batch abbrechen"
    @close="emit('abort')"
    @added="emit('added', $event)"
  />

  <Teleport to="body">
    <div
      v-if="loading && active"
      class="plan-shopping-batch__loading"
      role="status"
      aria-live="polite"
    >
      <p class="plan-shopping-batch__loading-text">Rezept wird geladen…</p>
    </div>

    <div
      v-if="loadError && active"
      class="app-modal-overlay plan-shopping-batch__error"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="plan-shopping-batch-error-title"
      @click.self="emit('skip-error')"
    >
      <div class="plan-shopping-batch__error-panel surface-card">
        <h2 id="plan-shopping-batch-error-title" class="h3">Rezept nicht geladen</h2>
        <p class="body-text">{{ loadError }}</p>
        <div class="plan-shopping-batch__error-actions">
          <button type="button" class="btn btn--secondary" @click="emit('abort')">Batch abbrechen</button>
          <button type="button" class="btn btn--primary" @click="emit('skip-error')">Überspringen</button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { Recipe } from '../api/recipes'
import AddToShoppingSheet from './AddToShoppingSheet.vue'
import type { PlanShoppingBatchItem } from '../utils/planShoppingBatch'

const props = defineProps<{
  active: boolean
  loading: boolean
  loadError: string | null
  currentRecipe: Recipe | null
  currentItem: PlanShoppingBatchItem | null
  batchLabel: string | null
}>()

const emit = defineEmits<{
  added: [count: number]
  abort: []
  'skip-error': []
}>()

const sheetOpen = computed(
  () => props.active && !props.loading && !props.loadError && props.currentRecipe != null,
)
</script>

<style scoped>
.plan-shopping-batch__loading {
  position: fixed;
  inset: 0;
  z-index: var(--z-modal, 200);
  display: flex;
  align-items: center;
  justify-content: center;
  background: color-mix(in srgb, var(--color-surface) 85%, transparent);
}

.plan-shopping-batch__loading-text {
  margin: 0;
  padding: var(--spacing-md) var(--spacing-lg);
  border-radius: var(--radius-md, 8px);
  background: var(--color-surface);
  border: 1px solid var(--color-border);
}

.plan-shopping-batch__error-panel {
  width: min(100%, 24rem);
  padding: var(--spacing-lg);
}

.plan-shopping-batch__error-actions {
  display: flex;
  justify-content: flex-end;
  gap: var(--spacing-sm);
  margin-top: var(--spacing-lg);
}
</style>
