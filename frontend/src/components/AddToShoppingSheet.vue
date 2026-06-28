<template>
  <Teleport to="body">
    <div
      v-if="open"
      class="app-modal-overlay add-to-shopping"
      role="dialog"
      aria-modal="true"
      aria-labelledby="add-to-shopping-title"
      @click.self="emit('close')"
    >
      <div class="add-to-shopping__panel">
        <header class="add-to-shopping__header">
          <div>
            <h2 id="add-to-shopping-title" class="add-to-shopping__title">Zum Einkauf</h2>
            <p class="add-to-shopping__subtitle meta-text">{{ recipeTitle }}</p>
          </div>
          <button type="button" class="add-to-shopping__close" aria-label="Schließen" @click="emit('close')">
            ×
          </button>
        </header>

        <p v-if="servings > 0" class="add-to-shopping__servings meta-text">
          Für {{ servings }} {{ servings === 1 ? 'Portion' : 'Portionen' }}
        </p>

        <div v-if="rows.length === 0" class="add-to-shopping__empty body-text">
          Keine Zutaten in diesem Rezept.
        </div>

        <ul v-else class="add-to-shopping__list">
          <li v-for="row in rows" :key="row.key" class="add-to-shopping__row">
            <label class="add-to-shopping__label">
              <input v-model="row.selected" type="checkbox" class="add-to-shopping__checkbox" />
              <span class="add-to-shopping__text">{{ row.label }}</span>
            </label>
          </li>
        </ul>

        <footer class="add-to-shopping__footer">
          <button type="button" class="btn btn--secondary" @click="emit('close')">Abbrechen</button>
          <button
            type="button"
            class="btn btn--primary"
            :disabled="selectedCount === 0"
            @click="onConfirm"
          >
            {{ selectedCount === 1 ? '1 Zutat hinzufügen' : `${selectedCount} Zutaten hinzufügen` }}
          </button>
        </footer>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { Recipe } from '../api/recipes'
import { useBodyModalLock } from '../composables/useBodyModalLock'
import { useShoppingList } from '../composables/useShoppingList'
import { extractShoppingIngredientsFromRecipe } from '../utils/recipeShoppingIngredients'
import { isIngredientSelectedByDefault } from '../utils/shoppingListDefaults'
import { formatShoppingLine } from '../utils/shoppingListFormat'
import { buildShoppingListItemsFromInputs } from '../utils/shoppingListMerge'
import type { ShoppingIngredientInput } from '../utils/shoppingListTypes'

const props = defineProps<{
  open: boolean
  recipe: Recipe | null
  servings: number
}>()

const emit = defineEmits<{
  close: []
  added: [count: number]
}>()

useBodyModalLock(computed(() => props.open))

const { addIngredients } = useShoppingList()

type PickerRow = {
  key: string
  label: string
  input: ShoppingIngredientInput
  selected: boolean
}

const rows = ref<PickerRow[]>([])

const recipeTitle = computed(() => props.recipe?.title?.trim() || 'Rezept')

const selectedCount = computed(() => rows.value.filter((r) => r.selected).length)

function rebuildRows() {
  if (!props.recipe) {
    rows.value = []
    return
  }
  const ingredients = extractShoppingIngredientsFromRecipe(props.recipe, Math.max(1, props.servings))
  rows.value = ingredients.map((input, index) => {
    const preview = buildShoppingListItemsFromInputs([input], {
      id: props.recipe!.id,
      title: props.recipe!.title,
    })[0]
    return {
      key: `${index}-${input.ingredientName}-${input.category ?? ''}`,
      label: preview ? formatShoppingLine(preview) : input.ingredientName,
      input,
      selected: isIngredientSelectedByDefault(input.category, input.ingredientName),
    }
  })
}

watch(
  () => [props.open, props.recipe?.id, props.servings] as const,
  ([open]) => {
    if (open) rebuildRows()
  },
  { immediate: true },
)

function onConfirm() {
  if (!props.recipe) return
  const selected = rows.value.filter((r) => r.selected).map((r) => r.input)
  const count = addIngredients(selected, { id: props.recipe.id, title: props.recipe.title })
  emit('added', count)
  emit('close')
}
</script>

<style scoped>
.add-to-shopping__panel {
  width: min(100%, 28rem);
  max-height: min(85vh, 36rem);
  display: flex;
  flex-direction: column;
  background: var(--color-surface);
  border-radius: var(--radius-lg, 12px);
  box-shadow: var(--shadow-soft);
  border: 1px solid var(--color-border);
}

.add-to-shopping__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--spacing-md);
  padding: var(--spacing-lg) var(--spacing-lg) var(--spacing-sm);
}

.add-to-shopping__title {
  font-size: 1.125rem;
  font-weight: 600;
}

.add-to-shopping__subtitle {
  margin-top: 0.25rem;
}

.add-to-shopping__close {
  border: none;
  background: transparent;
  font-size: 1.5rem;
  line-height: 1;
  color: var(--color-text-muted);
  cursor: pointer;
  padding: 0.125rem 0.375rem;
}

.add-to-shopping__servings {
  padding: 0 var(--spacing-lg) var(--spacing-sm);
}

.add-to-shopping__empty {
  padding: var(--spacing-lg);
}

.add-to-shopping__list {
  list-style: none;
  margin: 0;
  padding: 0 var(--spacing-lg);
  overflow-y: auto;
  flex: 1;
  min-height: 0;
}

.add-to-shopping__row + .add-to-shopping__row {
  border-top: 1px solid var(--color-border);
}

.add-to-shopping__label {
  display: flex;
  align-items: flex-start;
  gap: var(--spacing-md);
  padding: var(--spacing-md) 0;
  cursor: pointer;
}

.add-to-shopping__checkbox {
  margin-top: 0.2rem;
  flex-shrink: 0;
}

.add-to-shopping__text {
  line-height: 1.4;
}

.add-to-shopping__footer {
  display: flex;
  justify-content: flex-end;
  gap: var(--spacing-sm);
  padding: var(--spacing-lg);
  border-top: 1px solid var(--color-border);
}
</style>
