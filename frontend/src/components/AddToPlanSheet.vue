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
          <div>
            <h2 id="add-to-plan-title" class="add-to-plan__title">Rezept planen</h2>
            <p v-if="dayLabel" class="add-to-plan__subtitle meta-text">{{ dayLabel }}</p>
          </div>
          <button type="button" class="add-to-plan__close" aria-label="Schließen" @click="emit('close')">
            ×
          </button>
        </header>

        <label class="add-to-plan__search">
          <span class="add-to-plan__search-label">Suchen</span>
          <input
            ref="searchRef"
            v-model="query"
            type="search"
            class="form__input"
            placeholder="Rezepttitel…"
            autocomplete="off"
          />
        </label>

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
              <span class="add-to-plan__recipe-title">{{ recipe.title }}</span>
            </button>
          </li>
          <li v-if="filteredRecipes.length === 0" class="add-to-plan__empty meta-text">Kein passendes Rezept.</li>
        </ul>

        <div v-if="selected" class="add-to-plan__servings">
          <label class="add-to-plan__servings-label">
            Portionen
            <input
              v-model.number="servings"
              type="number"
              min="1"
              max="99"
              class="form__input add-to-plan__servings-input"
            />
          </label>
        </div>

        <footer class="add-to-plan__footer">
          <button type="button" class="btn btn--secondary" @click="emit('close')">Abbrechen</button>
          <button type="button" class="btn btn--primary" :disabled="!selected" @click="onConfirm">
            Hinzufügen
          </button>
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
  width: min(100%, 28rem);
  max-height: min(85vh, 36rem);
  display: flex;
  flex-direction: column;
  background: var(--color-surface);
  border-radius: var(--radius-lg, 12px);
  border: 1px solid var(--color-border);
  box-shadow: var(--shadow-soft);
}

.add-to-plan__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--spacing-md);
  padding: var(--spacing-lg) var(--spacing-lg) var(--spacing-sm);
}

.add-to-plan__title {
  font-size: 1.125rem;
  font-weight: 600;
}

.add-to-plan__close {
  border: none;
  background: transparent;
  font-size: 1.5rem;
  color: var(--color-text-muted);
  cursor: pointer;
}

.add-to-plan__search {
  display: block;
  padding: 0 var(--spacing-lg) var(--spacing-sm);
}

.add-to-plan__search-label {
  display: block;
  font-size: 0.875rem;
  color: var(--color-text-muted);
  margin-bottom: 0.25rem;
}

.add-to-plan__list {
  list-style: none;
  margin: 0;
  padding: 0 var(--spacing-lg);
  overflow-y: auto;
  flex: 1;
  min-height: 0;
  max-height: 14rem;
}

.add-to-plan__recipe {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  width: 100%;
  text-align: left;
  padding: 0.55rem 0;
  border: none;
  border-top: 1px solid var(--color-border);
  background: transparent;
  cursor: pointer;
  color: var(--color-text);
}

.add-to-plan__recipe-title {
  flex: 1;
  min-width: 0;
}

.add-to-plan__list li:first-child .add-to-plan__recipe {
  border-top: none;
}

.add-to-plan__recipe:hover,
.add-to-plan__recipe--selected {
  color: var(--color-accent);
}

.add-to-plan__servings {
  padding: var(--spacing-sm) var(--spacing-lg);
  border-top: 1px solid var(--color-border);
}

.add-to-plan__servings-label {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  font-size: 0.9rem;
}

.add-to-plan__servings-input {
  width: 4rem;
}

.add-to-plan__status {
  padding: var(--spacing-md) var(--spacing-lg);
}

.add-to-plan__status--error {
  color: var(--color-danger);
}

.add-to-plan__empty {
  padding: var(--spacing-md) 0;
}

.add-to-plan__footer {
  display: flex;
  justify-content: flex-end;
  gap: var(--spacing-sm);
  padding: var(--spacing-lg);
  border-top: 1px solid var(--color-border);
}
</style>
