<template>
  <div class="view view--recipes">
    <h1>Recipes</h1>
    <div class="recipe-view__actions">
      <button type="button" class="btn btn--secondary" @click="showImportOverlay = true">
        Add Recipe from Image
      </button>
    </div>
    <RecipeForm
      :initial="formInitial"
      :editing-id="editingId"
      :editing-status="editingStatus"
      @submit="onFormSubmit"
      @confirm="onConfirmRecipe"
      @cancel="editingId = null; formInitial = null; editingStatus = null"
    />
    <RecipeImportOverlay
      v-if="showImportOverlay"
      @done="onImportDone"
      @close="showImportOverlay = false"
    />
    <div class="recipe-list-toolbar">
      <input
        v-model="searchQuery"
        type="search"
        class="recipe-list-toolbar__search"
        placeholder="Search by title…"
        aria-label="Search by title"
      />
      <select v-model="sortBy" class="recipe-list-toolbar__sort" aria-label="Sort by">
        <option value="title-asc">Name (A–Z)</option>
        <option value="title-desc">Name (Z–A)</option>
        <option value="updated-desc">Last updated (newest first)</option>
        <option value="updated-asc">Last updated (oldest first)</option>
      </select>
    </div>
    <p v-if="error" class="error">{{ error }}</p>
    <p v-if="loading && !recipes.length">Loading…</p>
    <ul v-else class="recipe-list">
      <li v-for="r in filteredAndSortedRecipes" :key="r.id" class="recipe-list__item">
        <div class="recipe-list__main">
          <button type="button" class="recipe-list__title" @click="startEdit(r.id)">
            {{ r.title }}
          </button>
          <span v-if="r.status === 'draft'" class="recipe-list__badge recipe-list__badge--draft">Draft</span>
          <span v-if="r.servings" class="recipe-list__meta"> {{ r.servings }} portions</span>
          <span v-if="r.source_book_title || r.source_name" class="recipe-list__meta">
            · {{ r.source_book_title || r.source_name }}
            <span v-if="r.source_author"> ({{ r.source_author }})</span>
          </span>
        </div>
        <button
          type="button"
          class="recipe-list__delete"
          title="Delete recipe"
          @click="onDelete(r.id)"
        >
          Delete
        </button>
      </li>
    </ul>
    <p v-if="!loading && !recipes.length" class="empty">No recipes yet. Add one above.</p>
    <p v-else-if="!loading && recipes.length && !filteredAndSortedRecipes.length" class="empty">
      No recipes match your search.
    </p>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import RecipeForm from '../components/RecipeForm.vue'
import RecipeImportOverlay from '../components/RecipeImportOverlay.vue'
import {
  listRecipes,
  getRecipe,
  createRecipe,
  updateRecipe,
  deleteRecipe,
} from '../api/recipes'
import type { Recipe, RecipeListItem, RecipeFormPayload, ParsedRecipeFromOcr, ParsedIngredientItem } from '../api/recipes'

const recipes = ref<RecipeListItem[]>([])
const loading = ref(true)
const error = ref('')
const editingId = ref<number | null>(null)
const formInitial = ref<(Partial<RecipeFormPayload> & { parsed_recipe?: ParsedRecipeFromOcr | null }) | null>(null)
const editingStatus = ref<'draft' | 'confirmed' | null>(null)
const searchQuery = ref('')
const sortBy = ref<'title-asc' | 'title-desc' | 'updated-desc' | 'updated-asc'>('updated-desc')
const showImportOverlay = ref(false)

function buildFormInitialFromImportedRecipe(recipe: Recipe): (Partial<RecipeFormPayload> & {
  parsed_recipe?: ParsedRecipeFromOcr | null
  extract_confidence?: number | null
  extract_missing_fields?: string[] | null
  nutrition_kcal?: number | null
  nutrition_protein?: number | null
  nutrition_carbs?: number | null
  nutrition_fat?: number | null
}) {
  const pr = recipe.parsed_recipe
  type Ing = { amount: string; unit: string; name: string; section_heading?: string | null; original_text?: string | null }
  const ingredients: Ing[] = []
  if (recipe.ingredients?.length) {
    for (const ing of recipe.ingredients) {
      ingredients.push({
        amount: ing.amount != null ? String(ing.amount) : '',
        unit: ing.unit ?? '',
        name: ing.name ?? ing.ingredient ?? '',
        section_heading: ing.section_heading ?? null,
        original_text: ing.original_text ?? null,
      })
    }
  } else if (pr?.ingredientsSections?.length) {
    for (const section of pr.ingredientsSections) {
      for (const item of section.items ?? []) {
        ingredients.push({
          amount: item.amount != null ? String(item.amount) : '',
          unit: (item as ParsedIngredientItem).unit ?? '',
          name: (item as ParsedIngredientItem).ingredient ?? (item as ParsedIngredientItem).originalText ?? '',
          section_heading: section.heading ?? null,
          original_text: (item as ParsedIngredientItem).originalText ?? null,
        })
      }
    }
  }
  if (ingredients.length === 0) ingredients.push({ amount: '', unit: '', name: '' })

  const recipe_steps = (pr?.steps ?? []).map((s) => ({ instruction: s?.text?.trim() ?? '' }))
  if (recipe_steps.length === 0) recipe_steps.push({ instruction: '' })

  return {
    title: recipe.title ?? '',
    subtitle: recipe.subtitle ?? '',
    description: pr?.introText ?? recipe.description ?? '',
    servings: pr?.servings?.value ?? recipe.servings ?? null,
    source_id: recipe.source_id ?? null,
    source_page: recipe.source_page ?? '',
    ingredients,
    recipe_steps,
    parsed_recipe: pr ?? null,
    extract_confidence: recipe.extract_confidence ?? null,
    extract_missing_fields: recipe.extract_missing_fields ?? null,
    nutrition_kcal: recipe.nutrition_kcal ?? pr?.nutritionTotal?.kcal ?? null,
    nutrition_protein: recipe.nutrition_protein ?? pr?.nutritionTotal?.protein ?? null,
    nutrition_carbs: recipe.nutrition_carbs ?? pr?.nutritionTotal?.carbs ?? null,
    nutrition_fat: recipe.nutrition_fat ?? pr?.nutritionTotal?.fat ?? null,
    tips: recipe.tips ?? pr?.tips ?? [],
  }
}

function onImportDone(recipe: Recipe) {
  showImportOverlay.value = false
  editingId.value = recipe.id
  editingStatus.value = 'draft'
  formInitial.value = buildFormInitialFromImportedRecipe(recipe)
  loadList()
}

const filteredAndSortedRecipes = computed(() => {
  let list = recipes.value
  const q = searchQuery.value.trim().toLowerCase()
  if (q) {
    list = list.filter((r) => r.title.toLowerCase().includes(q))
  }
  const sorted = [...list]
  switch (sortBy.value) {
    case 'title-asc':
      sorted.sort((a, b) => a.title.localeCompare(b.title, undefined, { sensitivity: 'base' }))
      break
    case 'title-desc':
      sorted.sort((a, b) => b.title.localeCompare(a.title, undefined, { sensitivity: 'base' }))
      break
    case 'updated-desc':
      sorted.sort((a, b) => (b.updated_at || '').localeCompare(a.updated_at || ''))
      break
    case 'updated-asc':
      sorted.sort((a, b) => (a.updated_at || '').localeCompare(b.updated_at || ''))
      break
  }
  return sorted
})

async function loadList() {
  loading.value = true
  error.value = ''
  try {
    recipes.value = await listRecipes()
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Failed to load recipes'
  } finally {
    loading.value = false
  }
}

function startEdit(id: number) {
  editingId.value = id
  getRecipe(id).then((recipe) => {
    editingStatus.value = (recipe.status === 'draft' || recipe.status === 'confirmed') ? recipe.status : 'draft'
    formInitial.value = {
      title: recipe.title,
      subtitle: recipe.subtitle ?? '',
      description: recipe.description ?? '',
      servings: recipe.servings ?? null,
      source_id: recipe.source_id ?? null,
      source_page: recipe.source_page ?? '',
      ingredients: recipe.ingredients.map((ing) => ({
        amount: ing.amount != null ? String(ing.amount) : '',
        unit: ing.unit ?? '',
        name: ing.name ?? ing.ingredient ?? '',
        section_heading: ing.section_heading ?? null,
        original_text: ing.original_text ?? null,
      })),
      recipe_steps: recipe.recipe_steps.map((s) => ({ instruction: s.instruction ?? '' })),
      parsed_recipe: recipe.parsed_recipe ?? null,
      extract_confidence: recipe.extract_confidence ?? null,
      extract_missing_fields: recipe.extract_missing_fields ?? null,
      nutrition_kcal: recipe.nutrition_kcal ?? null,
      nutrition_protein: recipe.nutrition_protein ?? null,
      nutrition_carbs: recipe.nutrition_carbs ?? null,
      nutrition_fat: recipe.nutrition_fat ?? null,
      tips: recipe.tips ?? [],
    }
  }).catch((e) => {
    error.value = e instanceof Error ? e.message : 'Failed to load recipe'
  })
}

async function onFormSubmit(payload: RecipeFormPayload) {
  error.value = ''
  try {
    if (editingId.value != null) {
      await updateRecipe(editingId.value, payload)
      editingId.value = null
      formInitial.value = null
      editingStatus.value = null
    } else {
      await createRecipe(payload)
    }
    await loadList()
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Failed to save recipe'
  }
}

async function onConfirmRecipe() {
  if (editingId.value == null) return
  error.value = ''
  try {
    await updateRecipe(editingId.value, { status: 'confirmed' })
    editingStatus.value = 'confirmed'
    await loadList()
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Failed to confirm recipe'
  }
}

async function onDelete(id: number) {
  if (!confirm('Delete this recipe?')) return
  error.value = ''
  try {
    await deleteRecipe(id)
    if (editingId.value === id) {
      editingId.value = null
      formInitial.value = null
      editingStatus.value = null
    }
    await loadList()
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Failed to delete recipe'
  }
}

onMounted(loadList)
</script>

<style scoped>
.view {
  max-width: 56rem;
}

.view h1 {
  margin: 0 0 1rem 0;
  color: var(--color-text);
}

.recipe-view__actions {
  margin-bottom: 1rem;
}

.recipe-view__actions .btn {
  padding: 0.5rem 1rem;
  border-radius: 4px;
  font: inherit;
  cursor: pointer;
  border: 1px solid var(--color-btn-secondary-border);
  background: var(--color-btn-secondary-bg);
  color: var(--color-btn-secondary-fg);
}

.recipe-view__actions .btn:hover {
  background: var(--color-btn-secondary-hover);
}

.recipe-list-toolbar {
  display: flex;
  gap: 0.75rem;
  align-items: center;
  margin-bottom: 1rem;
  flex-wrap: wrap;
}

.recipe-list-toolbar__search {
  flex: 1;
  min-width: 12rem;
  max-width: 24rem;
  padding: 0.5rem 0.75rem;
  border: 1px solid var(--color-input-border);
  border-radius: 4px;
  font: inherit;
  background: var(--color-input-bg);
  color: var(--color-text);
}

.recipe-list-toolbar__sort {
  padding: 0.5rem 0.75rem;
  border: 1px solid var(--color-input-border);
  border-radius: 4px;
  font: inherit;
  background: var(--color-bg-elevated);
  color: var(--color-text);
}

.error {
  color: var(--color-error);
  margin: 0 0 1rem 0;
}

.empty {
  color: var(--color-text-muted);
  margin: 0;
}

.recipe-list {
  list-style: none;
  padding: 0;
  margin: 0;
}

.recipe-list__item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding: 0.75rem 0;
  border-bottom: 1px solid var(--color-border-subtle);
}

.recipe-list__main {
  flex: 1;
  min-width: 0;
}

.recipe-list__title {
  background: none;
  border: none;
  padding: 0;
  font: inherit;
  font-weight: 600;
  color: var(--color-text);
  cursor: pointer;
  text-align: left;
}

.recipe-list__title:hover {
  text-decoration: underline;
}

.recipe-list__badge {
  display: inline-block;
  margin-left: 0.5rem;
  padding: 0.15rem 0.4rem;
  font-size: 0.75rem;
  font-weight: 500;
  border-radius: 4px;
}

.recipe-list__badge--draft {
  background: var(--color-draft-bg);
  color: var(--color-draft-fg);
}

.recipe-list__meta {
  font-size: 0.9rem;
  color: var(--color-text-muted);
  margin-left: 0.25rem;
}

.recipe-list__delete {
  flex-shrink: 0;
  padding: 0.35rem 0.6rem;
  font-size: 0.85rem;
  color: var(--color-delete-fg);
  background: none;
  border: 1px solid var(--color-delete-border);
  border-radius: 4px;
  cursor: pointer;
}

.recipe-list__delete:hover {
  background: var(--color-delete-hover-bg);
}
</style>
