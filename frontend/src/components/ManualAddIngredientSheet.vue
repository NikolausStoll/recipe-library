<template>
  <Teleport to="body">
    <div
      v-if="props.open"
      class="app-modal-overlay manual-add-ingredient"
      role="dialog"
      aria-modal="true"
      aria-labelledby="manual-add-title"
      @click.self="emit('close')"
    >
      <div class="manual-add-ingredient__panel">
        <header class="manual-add-ingredient__header">
          <h2 id="manual-add-title" class="manual-add-ingredient__title">Zutat hinzufügen</h2>
          <button type="button" class="manual-add-ingredient__close" aria-label="Schließen" @click="emit('close')">
            ×
          </button>
        </header>

        <label class="manual-add-ingredient__field">
          <span class="manual-add-ingredient__label">Zutat</span>
          <input
            ref="inputRef"
            v-model="query"
            type="text"
            class="form__input manual-add-ingredient__input"
            autocomplete="off"
            placeholder="z. B. Tomaten"
            @keydown.enter.prevent="onSubmit"
            @keydown.escape="emit('close')"
          />
        </label>

        <ul v-if="suggestions.length" class="manual-add-ingredient__suggestions">
          <li v-for="item in suggestions" :key="item.name">
            <button type="button" class="manual-add-ingredient__suggestion" @click="selectSuggestion(item)">
              <span>{{ item.name }}</span>
              <span class="manual-add-ingredient__category meta-text">{{ categoryLabel(item.category) }}</span>
            </button>
          </li>
        </ul>

        <p v-else-if="query.trim()" class="meta-text manual-add-ingredient__empty">
          Kein Vorschlag — Enter legt „{{ query.trim() }}“ unter Sonstiges an.
        </p>

        <footer class="manual-add-ingredient__footer">
          <button type="button" class="btn btn--secondary" @click="emit('close')">Fertig</button>
          <button type="button" class="btn btn--primary" :disabled="!query.trim()" @click="onSubmit">
            Hinzufügen
          </button>
        </footer>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import type { CommonShoppingIngredient } from '../constants/commonShoppingIngredients'
import { getIngredientCategoryLabelDe } from '../constants/ingredientCategories'
import { useBodyModalLock } from '../composables/useBodyModalLock'
import { matchCommonIngredient, searchCommonShoppingIngredients } from '../utils/commonIngredientSearch'

const props = defineProps<{ open: boolean }>()

const emit = defineEmits<{
  close: []
  add: [payload: { name: string; category: string | null }]
}>()

useBodyModalLock(computed(() => props.open))

const query = ref('')
const inputRef = ref<HTMLInputElement | null>(null)

const suggestions = computed(() => searchCommonShoppingIngredients(query.value, 8))

watch(
  () => props.open,
  async (isOpen) => {
    if (!isOpen) return
    query.value = ''
    await nextTick()
    inputRef.value?.focus()
  },
)

function categoryLabel(category: string) {
  return getIngredientCategoryLabelDe(category)
}

function selectSuggestion(item: CommonShoppingIngredient) {
  emit('add', { name: item.name, category: item.category })
  void afterAdd()
}

function onSubmit() {
  const name = query.value.trim()
  if (!name) return
  const match = matchCommonIngredient(name)
  emit('add', { name: match?.name ?? name, category: match?.category ?? 'other' })
  void afterAdd()
}

async function afterAdd() {
  query.value = ''
  await nextTick()
  inputRef.value?.focus()
}
</script>

<style scoped>
.manual-add-ingredient__panel {
  width: min(100%, 26rem);
  background: var(--color-surface);
  border-radius: var(--radius-lg, 12px);
  border: 1px solid var(--color-border);
  box-shadow: var(--shadow-soft);
}

.manual-add-ingredient__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--spacing-lg) var(--spacing-lg) var(--spacing-sm);
}

.manual-add-ingredient__title {
  font-size: 1.125rem;
  font-weight: 600;
}

.manual-add-ingredient__close {
  border: none;
  background: transparent;
  font-size: 1.5rem;
  color: var(--color-text-muted);
  cursor: pointer;
}

.manual-add-ingredient__field {
  display: block;
  padding: 0 var(--spacing-lg);
}

.manual-add-ingredient__label {
  display: block;
  font-size: 0.875rem;
  margin-bottom: 0.25rem;
  color: var(--color-text-muted);
}

.manual-add-ingredient__input {
  width: 100%;
}

.manual-add-ingredient__suggestions {
  list-style: none;
  margin: var(--spacing-sm) var(--spacing-lg) 0;
  padding: 0;
  max-height: 14rem;
  overflow-y: auto;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md, 8px);
}

.manual-add-ingredient__suggestion {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--spacing-sm);
  width: 100%;
  padding: 0.55rem var(--spacing-sm);
  border: none;
  border-top: 1px solid var(--color-border);
  background: transparent;
  text-align: left;
  cursor: pointer;
}

.manual-add-ingredient__suggestions li:first-child .manual-add-ingredient__suggestion {
  border-top: none;
}

.manual-add-ingredient__suggestion:hover {
  background: var(--color-surface-subtle);
}

.manual-add-ingredient__category {
  font-size: 0.8rem;
  flex-shrink: 0;
}

.manual-add-ingredient__empty {
  padding: var(--spacing-sm) var(--spacing-lg) 0;
}

.manual-add-ingredient__footer {
  display: flex;
  justify-content: flex-end;
  gap: var(--spacing-sm);
  padding: var(--spacing-lg);
}
</style>
