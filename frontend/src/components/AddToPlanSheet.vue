<template>
  <Teleport to="body">
    <div
      v-if="open"
      class="app-modal-overlay add-to-plan"
      role="dialog"
      aria-modal="true"
      aria-labelledby="add-to-plan-title"
      @click.self="emit('close')"
    >
      <div class="add-to-plan__panel">
        <header class="add-to-plan__header">
          <div class="add-to-plan__header-text">
            <h2 id="add-to-plan-title" class="add-to-plan__title">Rezept planen</h2>
            <p v-if="dayLabel" class="add-to-plan__subtitle meta-text">{{ dayLabel }}</p>
          </div>
          <button type="button" class="add-to-plan__close" aria-label="Schließen" @click="emit('close')">
            ×
          </button>
        </header>

        <div class="add-to-plan__body">
          <div class="search-field add-to-plan__search">
            <svg class="search-field__icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <circle cx="11" cy="11" r="8" stroke="currentColor" stroke-width="2" />
              <path d="M21 21L16.65 16.65" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
            </svg>
            <input
              ref="searchRef"
              v-model="query"
              type="search"
              class="search-field__input add-to-plan__search-input"
              placeholder="Rezept suchen…"
              aria-label="Rezept suchen"
              autocomplete="off"
            />
          </div>

          <div class="add-to-plan__list-wrap">
            <div v-if="loading" class="add-to-plan__status meta-text">Lade Rezepte…</div>
            <div v-else-if="loadError" class="add-to-plan__status add-to-plan__status--error">{{ loadError }}</div>

            <ul v-else class="add-to-plan__list">
              <li v-for="recipe in filteredRecipes" :key="recipe.id">
                <button
                  type="button"
                  class="add-to-plan__recipe"
                  :class="{ 'add-to-plan__recipe--selected': selected?.id === recipe.id }"
                  @click="selectRecipe(recipe)"
                >
                  <PlanRecipeThumb :image-url="getRecipeCardImageUrl(recipe)" :alt="recipe.title" />
                  <span class="add-to-plan__recipe-text">
                    <span class="add-to-plan__recipe-title">{{ recipe.title }}</span>
                    <span v-if="recipeServingsLabel(recipe)" class="add-to-plan__recipe-meta meta-text">
                      {{ recipeServingsLabel(recipe) }}
                    </span>
                  </span>
                </button>
              </li>
              <li v-if="filteredRecipes.length === 0" class="add-to-plan__empty meta-text">
                Kein passendes Rezept.
              </li>
            </ul>
          </div>
        </div>

        <footer class="add-to-plan__footer">
          <label v-if="selected" class="add-to-plan__servings">
            <span class="add-to-plan__servings-label">Portionen</span>
            <input
              v-model.number="servings"
              type="number"
              min="1"
              max="99"
              class="add-to-plan__servings-input"
              aria-label="Portionen"
            />
          </label>
          <div class="add-to-plan__footer-actions">
            <button type="button" class="btn btn--secondary btn--small" @click="emit('close')">Abbrechen</button>
            <button type="button" class="btn btn--primary btn--small" :disabled="!selected" @click="onConfirm">
              Hinzufügen
            </button>
          </div>
        </footer>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { listRecipesWithIngredients, type RecipeListItemWithIngredients } from '../api/recipes'
import PlanRecipeThumb from './PlanRecipeThumb.vue'
import { useBodyModalLock } from '../composables/useBodyModalLock'
import { formatPlanDayLabel } from '../utils/mealPlanDates'
import { isRecipePlannable } from '../utils/mealPlanTypes'
import { getRecipeCardImageUrl } from '../utils/recipeDisplayImage'

const props = defineProps<{
  open: boolean
  targetDate: string | null
}>()

const emit = defineEmits<{
  close: []
  add: [payload: { recipeId: number; recipeTitle: string; recipeImageUrl?: string | null; servings: number }]
}>()

useBodyModalLock(computed(() => props.open))

const query = ref('')
const servings = ref(2)
const selected = ref<RecipeListItemWithIngredients | null>(null)
const recipes = ref<RecipeListItemWithIngredients[]>([])
const loading = ref(false)
const loadError = ref<string | null>(null)
const searchRef = ref<HTMLInputElement | null>(null)

const dayLabel = computed(() => (props.targetDate ? formatPlanDayLabel(props.targetDate) : ''))

const plannableRecipes = computed(() =>
  recipes.value.filter((r) =>
    isRecipePlannable({ status: r.status, wouldCookAgain: r.would_cook_again }),
  ),
)

const filteredRecipes = computed(() => {
  const q = query.value.trim().toLowerCase()
  const list = plannableRecipes.value
  if (!q) return list.slice(0, 40)
  return list.filter((r) => r.title.toLowerCase().includes(q)).slice(0, 40)
})

async function loadRecipes() {
  loading.value = true
  loadError.value = null
  try {
    recipes.value = await listRecipesWithIngredients()
  } catch (e) {
    loadError.value = e instanceof Error ? e.message : 'Rezepte konnten nicht geladen werden.'
    recipes.value = []
  } finally {
    loading.value = false
  }
}

function recipeServingsLabel(recipe: RecipeListItemWithIngredients): string | null {
  const value = recipe.servings_value ?? recipe.servings
  if (value == null) return null
  const n = Math.round(Number(value))
  if (!Number.isFinite(n) || n <= 0) return null
  return `${n} ${n === 1 ? 'Portion' : 'Portionen'}`
}

function selectRecipe(recipe: RecipeListItemWithIngredients) {
  selected.value = recipe
  const base = recipe.servings_value ?? recipe.servings ?? 2
  servings.value = Math.max(1, Math.round(Number(base) || 2))
}

watch(
  () => props.open,
  async (isOpen) => {
    if (!isOpen) return
    query.value = ''
    selected.value = null
    servings.value = 2
    await loadRecipes()
    await nextTick()
    searchRef.value?.focus()
  },
)

function onConfirm() {
  if (!selected.value) return
  emit('add', {
    recipeId: selected.value.id,
    recipeTitle: selected.value.title,
    recipeImageUrl: getRecipeCardImageUrl(selected.value),
    servings: Math.max(1, Math.round(servings.value) || 1),
  })
  emit('close')
}
</script>

<style scoped>
.add-to-plan__panel {
  width: min(100%, 26rem);
  max-height: min(88vh, 30rem);
  display: flex;
  flex-direction: column;
  background: var(--color-surface);
  border-radius: var(--radius-lg, 12px);
  border: 1px solid var(--color-border);
  box-shadow: var(--shadow-soft);
  overflow: hidden;
}

.add-to-plan__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--spacing-sm);
  padding: 0.75rem 0.85rem 0.4rem;
  flex-shrink: 0;
}

.add-to-plan__header-text {
  min-width: 0;
}

.add-to-plan__title {
  margin: 0;
  font-size: 1.05rem;
  font-weight: 600;
  line-height: 1.25;
}

.add-to-plan__subtitle {
  margin: 0.12rem 0 0;
  font-size: 0.78rem;
  line-height: 1.3;
}

.add-to-plan__close {
  border: none;
  background: transparent;
  font-size: 1.35rem;
  line-height: 1;
  color: var(--color-text-muted);
  cursor: pointer;
  padding: 0.1rem 0.25rem;
  flex-shrink: 0;
}

.add-to-plan__body {
  display: flex;
  flex-direction: column;
  gap: 0.45rem;
  padding: 0 0.85rem;
  flex: 1;
  min-height: 0;
}

.add-to-plan__search {
  flex-shrink: 0;
}

.add-to-plan__search-input {
  min-height: 2.25rem;
  padding: 0 0.65rem 0 2.15rem;
  font-size: 0.9rem;
  border-radius: var(--radius-sm, 6px);
  background: var(--color-surface-subtle);
}

.add-to-plan__search .search-field__icon {
  left: 0.6rem;
  width: 1rem;
  height: 1rem;
}

.add-to-plan__list-wrap {
  flex: 1;
  min-height: 7.5rem;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md, 8px);
  background: var(--color-surface-subtle);
}

.add-to-plan__list {
  list-style: none;
  margin: 0;
  padding: 0;
  overflow-y: auto;
  flex: 1;
  min-height: 0;
  scrollbar-gutter: stable;
}

.add-to-plan__recipe {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  width: 100%;
  text-align: left;
  padding: 0.38rem 0.5rem;
  border: none;
  border-top: 1px solid var(--color-border);
  background: transparent;
  cursor: pointer;
  color: var(--color-text);
  transition: background 0.12s ease;
}

.add-to-plan__list li:first-child .add-to-plan__recipe {
  border-top: none;
}

.add-to-plan__recipe:hover {
  background: color-mix(in srgb, var(--color-accent) 5%, var(--color-surface-subtle));
}

.add-to-plan__recipe--selected {
  background: color-mix(in srgb, var(--color-accent) 10%, var(--color-surface-subtle));
  box-shadow: inset 3px 0 0 var(--color-accent);
}

.add-to-plan__recipe :deep(.plan-recipe-thumb) {
  width: 2.25rem;
  height: 2.25rem;
  flex-shrink: 0;
}

.add-to-plan__recipe-text {
  display: flex;
  flex-direction: column;
  gap: 0.05rem;
  min-width: 0;
  flex: 1;
}

.add-to-plan__recipe-title {
  font-size: 0.88rem;
  font-weight: 500;
  line-height: 1.3;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.add-to-plan__recipe--selected .add-to-plan__recipe-title {
  color: var(--color-accent);
  font-weight: 600;
}

.add-to-plan__recipe-meta {
  font-size: 0.72rem;
  line-height: 1.2;
}

.add-to-plan__status {
  padding: 0.65rem 0.75rem;
  font-size: 0.85rem;
}

.add-to-plan__status--error {
  color: var(--color-danger);
}

.add-to-plan__empty {
  padding: 0.65rem 0.75rem;
  font-size: 0.85rem;
}

.add-to-plan__footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  padding: 0.55rem 0.85rem 0.7rem;
  border-top: 1px solid var(--color-border);
  background: color-mix(in srgb, var(--color-surface-subtle) 40%, var(--color-surface));
  flex-shrink: 0;
}

.add-to-plan__servings {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  font-size: 0.82rem;
  color: var(--color-text-muted);
  min-width: 0;
}

.add-to-plan__servings-label {
  flex-shrink: 0;
}

.add-to-plan__servings-input {
  width: 3rem;
  min-height: 2rem;
  padding: 0.2rem 0.35rem;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm, 6px);
  background: var(--color-surface);
  color: var(--color-text);
  font: inherit;
  font-size: 0.88rem;
  text-align: center;
}

.add-to-plan__servings-input:focus {
  outline: none;
  border-color: var(--color-accent);
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--color-accent) 20%, transparent);
}

.add-to-plan__footer-actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 0.4rem;
  margin-left: auto;
  flex-shrink: 0;
}

@media (max-width: 639px) {
  .add-to-plan.app-modal-overlay {
    align-items: flex-end;
    padding: 0;
  }

  .add-to-plan__panel {
    width: 100%;
    max-height: min(88vh, 34rem);
    border-radius: var(--radius-lg, 12px) var(--radius-lg, 12px) 0 0;
    border-bottom: none;
  }

  .add-to-plan__list-wrap {
    min-height: 10rem;
  }
}
</style>
