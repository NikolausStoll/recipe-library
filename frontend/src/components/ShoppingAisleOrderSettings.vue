<template>
  <section class="shopping-aisle-settings no-print" aria-labelledby="shopping-aisle-settings-title">
    <button
      type="button"
      class="shopping-aisle-settings__toggle"
      :aria-expanded="open"
      @click="open = !open"
    >
      <span id="shopping-aisle-settings-title">Supermarkt-Gangfolge</span>
      <span class="shopping-aisle-settings__chevron" aria-hidden="true">{{ open ? '▾' : '▸' }}</span>
    </button>

    <div v-if="open" class="shopping-aisle-settings__panel">
      <p class="meta-text shopping-aisle-settings__hint">
        Reihenfolge der Kategorien in der Einkaufsliste und beim Drucken.
      </p>
      <ol class="shopping-aisle-settings__list">
        <li v-for="key in order" :key="key" class="shopping-aisle-settings__row">
          <span class="shopping-aisle-settings__label">{{ labelFor(key) }}</span>
          <span class="shopping-aisle-settings__actions">
            <button
              type="button"
              class="shopping-aisle-settings__move"
              :disabled="key === order[0]"
              aria-label="Nach oben"
              @click="move(key, -1)"
            >
              ↑
            </button>
            <button
              type="button"
              class="shopping-aisle-settings__move"
              :disabled="key === order[order.length - 1]"
              aria-label="Nach unten"
              @click="move(key, 1)"
            >
              ↓
            </button>
          </span>
        </li>
      </ol>
      <button type="button" class="btn btn--secondary btn--small" @click="onReset">Standard wiederherstellen</button>
    </div>
  </section>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { getIngredientCategoryLabelDe } from '../constants/ingredientCategories'
import {
  getDefaultCategoryOrder,
  getEffectiveCategoryOrder,
  moveCategoryKey,
  resetCustomCategoryOrder,
  saveCustomCategoryOrder,
} from '../utils/shoppingCategoryOrderStorage'

const emit = defineEmits<{ changed: [] }>()

const open = ref(false)
const order = ref<string[]>([])

onMounted(() => {
  order.value = getEffectiveCategoryOrder()
})

function labelFor(key: string) {
  return getIngredientCategoryLabelDe(key)
}

function move(key: string, direction: -1 | 1) {
  order.value = moveCategoryKey(order.value, key, direction)
  saveCustomCategoryOrder(order.value)
  emit('changed')
}

function onReset() {
  resetCustomCategoryOrder()
  order.value = getDefaultCategoryOrder()
  emit('changed')
}
</script>

<style scoped>
.shopping-aisle-settings {
  margin-bottom: var(--spacing-lg);
  max-width: 40rem;
}

.shopping-aisle-settings__toggle {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  padding: var(--spacing-sm) 0;
  border: none;
  background: transparent;
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--color-text);
  cursor: pointer;
}

.shopping-aisle-settings__chevron {
  color: var(--color-text-muted);
}

.shopping-aisle-settings__panel {
  padding: var(--spacing-sm) 0 var(--spacing-md);
}

.shopping-aisle-settings__hint {
  margin-bottom: var(--spacing-sm);
}

.shopping-aisle-settings__list {
  list-style: none;
  margin: 0 0 var(--spacing-md);
  padding: 0;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md, 8px);
  overflow: hidden;
}

.shopping-aisle-settings__row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--spacing-sm);
  padding: 0.45rem var(--spacing-sm);
  border-top: 1px solid var(--color-border);
}

.shopping-aisle-settings__row:first-child {
  border-top: none;
}

.shopping-aisle-settings__label {
  font-size: 0.9rem;
}

.shopping-aisle-settings__actions {
  display: inline-flex;
  gap: 0.15rem;
}

.shopping-aisle-settings__move {
  width: 1.75rem;
  height: 1.75rem;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  background: var(--color-surface-raised);
  color: var(--color-text);
  cursor: pointer;
}

.shopping-aisle-settings__move:disabled {
  opacity: 0.35;
  cursor: not-allowed;
}
</style>
