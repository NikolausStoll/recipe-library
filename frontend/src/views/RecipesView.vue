<template>
  <div class="recipes-view">
    <div class="recipes-header">
      <div class="recipes-header__main">
        <h1 class="recipes-title">My Recipes</h1>
        <p class="recipes-subtitle">{{ recipes.length }} recipe{{ recipes.length !== 1 ? 's' : '' }} in your collection</p>
      </div>
      <div class="recipes-header__actions">
        <button type="button" class="btn btn--primary btn--with-icon" @click="showImportOverlay = true">
          <svg viewBox="0 0 24 24" fill="none">
            <path d="M21 15V19C21 19.5304 20.7893 20.0391 20.4142 20.4142C20.0391 20.7893 19.5304 21 19 21H5C4.46957 21 3.96086 20.7893 3.58579 20.4142C3.21071 20.0391 3 19.5304 3 19V15" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            <path d="M7 10L12 15L17 10" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            <path d="M12 15V3" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
          <span>Import from Image</span>
        </button>
        <button type="button" class="btn btn--secondary" @click="openManualForm">
          + Add Recipe Manually
        </button>
      </div>
    </div>

    <RecipeImportOverlay
      v-if="showImportOverlay"
      @done="onImportDone"
      @close="showImportOverlay = false"
    />

    <!-- Search and Filter Toolbar -->
    <div class="recipes-toolbar">
      <div class="recipes-toolbar__searches">
        <div class="search-box search-box--title">
          <svg class="search-box__icon" viewBox="0 0 24 24" fill="none">
            <circle cx="11" cy="11" r="8" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            <path d="M21 21L16.65 16.65" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
          <input
            v-model="searchQuery"
            type="search"
            class="search-box__input"
            placeholder="Search recipes by title..."
            aria-label="Search recipes by title"
          />
        </div>
        <div class="search-box search-box--ingredients">
          <svg class="search-box__icon" viewBox="0 0 24 24" fill="none">
            <path
              d="M7 3H17C17.5523 3 18 3.44772 18 4V20C18 20.5523 17.5523 21 17 21H7C6.44772 21 6 20.5523 6 20V4C6 3.44772 6.44772 3 7 3Z"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
            <path
              d="M9 8H15"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
          </svg>
          <input
            v-model="ingredientSearchQuery"
            type="search"
            class="search-box__input"
            placeholder="Search ingredients (comma-separated)"
            aria-label="Search recipes by ingredients"
          />
        </div>
      </div>
      <div class="recipes-toolbar__meta">
        <div class="filter-group">
          <select v-model="sortBy" class="filter-select" aria-label="Sort by">
            <option value="updated-desc">Latest Updated</option>
            <option value="updated-asc">Oldest Updated</option>
            <option value="title-asc">Name (A–Z)</option>
            <option value="title-desc">Name (Z–A)</option>
          </select>
        </div>
        <p class="recipes-toolbar__count" aria-live="polite">
          {{ filteredAndSortedRecipes.length }} recipe{{ filteredAndSortedRecipes.length !== 1 ? 's' : '' }} shown
        </p>
      </div>
    </div>

    <p v-if="error" class="error-message">{{ error }}</p>
    <p v-if="loading && !recipes.length" class="loading-message">Loading recipes...</p>

    <!-- Recipe Grid -->
    <div v-if="!loading || recipes.length" class="recipes-grid">
      <div
        v-for="recipe in filteredAndSortedRecipes"
        :key="recipe.id"
        class="recipe-card"
        @click="viewRecipe(recipe.id)"
      >
        <div class="recipe-card__image">
          <img
            v-if="recipe.image_path"
            :src="recipe.image_path"
            :alt="recipe.title"
            loading="lazy"
          />
          <div v-else class="recipe-card__placeholder">
            <svg viewBox="0 0 24 24" fill="none">
              <path d="M12 2L2 7L12 12L22 7L12 2Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              <path d="M2 17L12 22L22 17" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              <path d="M2 12L12 17L22 12" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </div>
          <span v-if="recipe.status === 'draft'" class="recipe-card__badge recipe-card__badge--draft">
            Draft
          </span>
        </div>
        <div class="recipe-card__content">
          <h3 class="recipe-card__title">{{ recipe.title }}</h3>
          <p v-if="recipe.subtitle" class="recipe-card__subtitle">{{ recipe.subtitle }}</p>
          <div class="recipe-card__meta">
            <span v-if="recipe.servings" class="recipe-card__meta-item">
              <svg viewBox="0 0 24 24" fill="none">
                <path d="M17 21V19C17 17.9391 16.5786 16.9217 15.8284 16.1716C15.0783 15.4214 14.0609 15 13 15H5C3.93913 15 2.92172 15.4214 2.17157 16.1716C1.42143 16.9217 1 17.9391 1 19V21" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                <circle cx="9" cy="7" r="4" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                <path d="M23 21V19C22.9993 18.1137 22.7044 17.2528 22.1614 16.5523C21.6184 15.8519 20.8581 15.3516 20 15.13" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                <path d="M16 3.13C16.8604 3.35031 17.623 3.85071 18.1676 4.55232C18.7122 5.25392 19.0078 6.11683 19.0078 7.005C19.0078 7.89318 18.7122 8.75608 18.1676 9.45769C17.623 10.1593 16.8604 10.6597 16 10.88" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
              {{ recipe.servings }}
            </span>
            <span v-if="recipe.source_name" class="recipe-card__meta-item">
              <svg viewBox="0 0 24 24" fill="none">
                <path d="M4 19.5C4 18.837 4.26339 18.2011 4.73223 17.7322C5.20107 17.2634 5.83696 17 6.5 17H20" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                <path d="M6.5 2H20V22H6.5C5.83696 22 5.20107 21.7366 4.73223 21.2678C4.26339 20.7989 4 20.163 4 19.5V4.5C4 3.83696 4.26339 3.20107 4.73223 2.73223C5.20107 2.26339 5.83696 2 6.5 2Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
              {{ recipe.source_name }}
            </span>
          </div>
        </div>
        <div class="recipe-card__actions">
          <button
            type="button"
            class="recipe-card__action-btn recipe-card__action-btn--edit"
            title="Edit recipe"
            @click.stop="startEdit(recipe.id)"
          >
            <svg viewBox="0 0 24 24" fill="none">
              <path d="M11 4H4C3.46957 4 2.96086 4.21071 2.58579 4.58579C2.21071 4.96086 2 5.46957 2 6V20C2 20.5304 2.21071 21.0391 2.58579 21.4142C2.96086 21.7893 3.46957 22 4 22H18C18.5304 22 19.0391 21.7893 19.4142 21.4142C19.7893 21.0391 20 20.5304 20 20V13" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              <path d="M18.5 2.50001C18.8978 2.10219 19.4374 1.87869 20 1.87869C20.5626 1.87869 21.1022 2.10219 21.5 2.50001C21.8978 2.89784 22.1213 3.4374 22.1213 4.00001C22.1213 4.56262 21.8978 5.10219 21.5 5.50001L12 15L8 16L9 12L18.5 2.50001Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </button>
        </div>
      </div>
    </div>

    <div v-if="!loading && recipes.length && !filteredAndSortedRecipes.length" class="empty-state">
      <svg viewBox="0 0 24 24" fill="none">
        <circle cx="11" cy="11" r="8" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        <path d="M21 21L16.65 16.65" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
      <h3>No recipes match your search</h3>
      <p>Try adjusting your search terms</p>
    </div>

    <div v-if="!loading && !recipes.length" class="empty-state">
      <svg viewBox="0 0 24 24" fill="none">
        <path d="M12 2L2 7L12 12L22 7L12 2Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        <path d="M2 17L12 22L22 17" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        <path d="M2 12L12 17L22 12" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
      <h3>No recipes yet</h3>
      <p>Start building your collection by importing a recipe from an image</p>
      <button type="button" class="btn btn--primary" @click="showImportOverlay = true">
        Import Your First Recipe
      </button>
      <button type="button" class="btn btn--secondary" @click="openManualForm">
        Create Recipe Manually
      </button>
    </div>

    <!-- Recipe Detail View -->
    <div v-if="viewingRecipe" class="recipe-detail-overlay" @click.self="closeDetailView">
      <div class="recipe-detail-panel">
        <button type="button" class="recipe-detail-close" @click="closeDetailView">
          <svg viewBox="0 0 24 24" fill="none">
            <path d="M18 6L6 18M6 6L18 18" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </button>

        <div class="recipe-detail-content">
          <!-- Hero Image -->
          <div v-if="viewingRecipe.image_path" class="recipe-detail-hero">
            <img :src="viewingRecipe.image_path" :alt="viewingRecipe.title" />
          </div>

          <!-- Header -->
          <div class="recipe-detail-header">
            <h1 class="recipe-detail-title">{{ viewingRecipe.title }}</h1>
            <p v-if="viewingRecipe.subtitle" class="recipe-detail-subtitle">{{ viewingRecipe.subtitle }}</p>
            <p v-if="viewingRecipe.description" class="recipe-detail-description">{{ viewingRecipe.description }}</p>

            <div class="recipe-detail-meta">
              <div v-if="viewingRecipe.servings" class="recipe-detail-servings">
                <svg viewBox="0 0 24 24" fill="none">
                  <path d="M17 21V19C17 17.9391 16.5786 16.9217 15.8284 16.1716C15.0783 15.4214 14.0609 15 13 15H5C3.93913 15 2.92172 15.4214 2.17157 16.1716C1.42143 16.9217 1 17.9391 1 19V21" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                  <circle cx="9" cy="7" r="4" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
                <button type="button" class="servings-btn" @click="adjustServings(-1)" :disabled="displayServings <= 1">−</button>
                <span class="servings-value">{{ displayServings }}</span>
                <button type="button" class="servings-btn" @click="adjustServings(1)">+</button>
                <span class="servings-label">servings</span>
              </div>
              <button type="button" class="btn btn--primary" @click="editFromDetail">
                <svg viewBox="0 0 24 24" fill="none">
                  <path d="M11 4H4C3.46957 4 2.96086 4.21071 2.58579 4.58579C2.21071 4.96086 2 5.46957 2 6V20C2 20.5304 2.21071 21.0391 2.58579 21.4142C2.96086 21.7893 3.46957 22 4 22H18C18.5304 22 19.0391 21.7893 19.4142 21.4142C19.7893 21.0391 20 20.5304 20 20V13" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                  <path d="M18.5 2.50001C18.8978 2.10219 19.4374 1.87869 20 1.87869C20.5626 1.87869 21.1022 2.10219 21.5 2.50001C21.8978 2.89784 22.1213 3.4374 22.1213 4.00001C22.1213 4.56262 21.8978 5.10219 21.5 5.50001L12 15L8 16L9 12L18.5 2.50001Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
                Edit Recipe
              </button>
            </div>
          </div>

          <!-- Two Column Layout -->
          <div class="recipe-detail-body">
            <!-- Left: Steps -->
            <div class="recipe-detail-section">
              <h2 class="recipe-detail-section-title">
                <svg viewBox="0 0 24 24" fill="none">
                  <path d="M12 2L2 7L12 12L22 7L12 2Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
                Instructions
              </h2>
              <ol class="recipe-steps-list">
                <li v-for="(step, idx) in viewingRecipe.recipe_steps" :key="idx" class="recipe-step">
                  <span class="recipe-step-number">{{ idx + 1 }}</span>
                  <p class="recipe-step-text">{{ step.instruction }}</p>
                </li>
              </ol>
            </div>

            <!-- Right: Ingredients -->
            <div class="recipe-detail-section recipe-detail-section--sticky">
              <h2 class="recipe-detail-section-title">
                <svg viewBox="0 0 24 24" fill="none">
                  <path d="M9 5H7C5.89543 5 5 5.89543 5 7V19C5 20.1046 5.89543 21 7 21H17C18.1046 21 19 20.1046 19 19V7C19 5.89543 18.1046 5 17 5H15" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
                Ingredients
              </h2>
              <ul class="recipe-ingredients-list">
                <li v-for="(ing, idx) in scaledIngredients" :key="idx" class="recipe-ingredient">
                  <span class="recipe-ingredient-text">{{ ing.text }}</span>
                </li>
              </ul>
            </div>
          </div>

          <!-- Tips -->
          <div v-if="viewingRecipe.tips?.length" class="recipe-detail-section recipe-detail-section--full">
            <h2 class="recipe-detail-section-title">
              <svg viewBox="0 0 24 24" fill="none">
                <path d="M13 2L3 14H12L11 22L21 10H12L13 2Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
              Tips & Notes
            </h2>
            <ul class="recipe-tips-list">
              <li v-for="(tip, idx) in viewingRecipe.tips" :key="idx">{{ tip }}</li>
            </ul>
          </div>

          <!-- Nutrition -->
          <div v-if="hasNutrition" class="recipe-detail-section recipe-detail-section--full">
            <h2 class="recipe-detail-section-title">
              <svg viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
              Nutrition Information
            </h2>
            <div class="recipe-nutrition">
            <div v-if="nutritionPerServing.kcal != null" class="recipe-nutrition-item">
              <span class="recipe-nutrition-label">Calories per serving</span>
              <span class="recipe-nutrition-value">{{ nutritionPerServing.kcal }} kcal</span>
            </div>
            <div v-if="nutritionPerServing.protein != null" class="recipe-nutrition-item">
              <span class="recipe-nutrition-label">Protein per serving</span>
              <span class="recipe-nutrition-value">{{ nutritionPerServing.protein }} g</span>
            </div>
            <div v-if="nutritionPerServing.carbs != null" class="recipe-nutrition-item">
              <span class="recipe-nutrition-label">Carbs per serving</span>
              <span class="recipe-nutrition-value">{{ nutritionPerServing.carbs }} g</span>
            </div>
            <div v-if="nutritionPerServing.fat != null" class="recipe-nutrition-item">
              <span class="recipe-nutrition-label">Fat per serving</span>
              <span class="recipe-nutrition-value">{{ nutritionPerServing.fat }} g</span>
            </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Edit Overlay -->
    <div v-if="showRecipeForm" class="recipe-edit-overlay" @click.self="closeEdit">
      <div class="recipe-edit-panel">
        <div class="recipe-edit-header">
          <h2>{{ editingId ? 'Edit Recipe' : 'New Recipe' }}</h2>
          <div class="recipe-edit-header-actions">
            <button
              v-if="editingId"
              type="button"
              class="btn btn--danger btn--small"
              @click="onDeleteFromEdit"
            >
              <svg viewBox="0 0 24 24" fill="none">
                <path d="M3 6H5H21" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                <path d="M8 6V4C8 3.46957 8.21071 2.96086 8.58579 2.58579C8.96086 2.21071 9.46957 2 10 2H14C14.5304 2 15.0391 2.21071 15.4142 2.58579C15.7893 2.96086 16 3.46957 16 4V6M19 6V20C19 20.5304 18.7893 21.0391 18.4142 21.4142C18.0391 21.7893 17.5304 22 17 22H7C6.46957 22 5.96086 21.7893 5.58579 21.4142C5.21071 21.0391 5 20.5304 5 20V6H19Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
              Delete
            </button>
            <button type="button" class="close-btn" @click="closeEdit">
              <svg viewBox="0 0 24 24" fill="none">
                <path d="M18 6L6 18M6 6L18 18" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
            </button>
          </div>
        </div>
        <div class="recipe-edit-body">
          <RecipeFormMultiStep
            :initial="formInitial"
            :editing-id="editingId"
            :editing-status="editingStatus"
            @submit="onFormSubmit"
            @confirm="onConfirmRecipe"
            @cancel="closeEdit"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import Fuse from 'fuse.js'
import type { FuseOptions } from 'fuse.js'
import RecipeFormMultiStep from '../components/RecipeFormMultiStep.vue'
import RecipeImportOverlay from '../components/RecipeImportOverlay.vue'
import {
  listRecipesWithIngredients,
  getRecipe,
  createRecipe,
  updateRecipe,
  deleteRecipe,
} from '../api/recipes'
import type {
  Recipe,
  RecipeListItemWithIngredients,
  RecipeFormPayload,
  ParsedRecipeFromOcr,
} from '../api/recipes'
import { getPerServingValue } from '../utils/nutrition'

const recipes = ref<RecipeListItemWithIngredients[]>([])
const loading = ref(true)
const error = ref('')
const editingId = ref<number | null>(null)
const formInitial = ref<(Partial<RecipeFormPayload> & { parsed_recipe?: ParsedRecipeFromOcr | null }) | null>(null)
const editingStatus = ref<'draft' | 'confirmed' | null>(null)
const searchQuery = ref('')
const ingredientSearchQuery = ref('')
const sortBy = ref<'title-asc' | 'title-desc' | 'updated-desc' | 'updated-asc'>('updated-desc')
const showImportOverlay = ref(false)
const showRecipeForm = ref(false)
const viewingRecipe = ref<Recipe | null>(null)
const displayServings = ref<number>(1)

const fuseOptions: FuseOptions<RecipeListItemWithIngredients> = {
  includeMatches: true,
  threshold: 0.3,
  ignoreLocation: true,
  keys: [
    { name: 'title', weight: 2 },
    { name: 'ingredients.ingredient', weight: 1 },
  ],
}
let fuseInstance: Fuse<RecipeListItemWithIngredients> | null = null

function rebuildFuse() {
  if (!recipes.value.length) {
    fuseInstance = null
    return
  }
  fuseInstance = new Fuse(recipes.value, fuseOptions)
}

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
          unit: (item as any).unit ?? '',
          name: (item as any).ingredient ?? (item as any).originalText ?? '',
          section_heading: section.heading ?? null,
          original_text: (item as any).originalText ?? null,
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
  showRecipeForm.value = true
  loadList()
}

const nutritionPerServing = computed(() => {
  const recipe = viewingRecipe.value
  if (!recipe) return { kcal: null, protein: null, carbs: null, fat: null }
  const totals = {
    kcal: recipe.nutrition_kcal ?? recipe.parsed_recipe?.nutritionTotal?.kcal ?? null,
    protein: recipe.nutrition_protein ?? recipe.parsed_recipe?.nutritionTotal?.protein ?? null,
    carbs: recipe.nutrition_carbs ?? recipe.parsed_recipe?.nutritionTotal?.carbs ?? null,
    fat: recipe.nutrition_fat ?? recipe.parsed_recipe?.nutritionTotal?.fat ?? null,
  }
  const servings = recipe.servings ?? 1
  return {
    kcal: getPerServingValue(totals.kcal, servings),
    protein: getPerServingValue(totals.protein, servings),
    carbs: getPerServingValue(totals.carbs, servings),
    fat: getPerServingValue(totals.fat, servings),
  }
})

const hasNutrition = computed(() => {
  const { kcal, protein, carbs, fat } = nutritionPerServing.value
  return kcal != null || protein != null || carbs != null || fat != null
})

const scaledIngredients = computed(() => {
  const recipe = viewingRecipe.value
  if (!recipe || !recipe.ingredients) return []

  const originalServings = recipe.servings || 1
  const scale = displayServings.value / originalServings
  const servingsChanged = displayServings.value !== originalServings

  return recipe.ingredients.map(ing => {
    // If servings haven't changed and original_text exists, use it
    if (!servingsChanged && ing.original_text) {
      return { text: ing.original_text }
    }

    // Otherwise calculate scaled amounts
    let text = ''
    if (ing.amount) {
      const scaledAmount = parseFloat(String(ing.amount)) * scale
      // Round to reasonable precision
      const rounded = Math.round(scaledAmount * 100) / 100
      text = `${rounded} `
    }
    if (ing.unit) {
      text += `${ing.unit} `
    }
    text += ing.name || ing.ingredient || ''

    // Append additional_info if available
    if (ing.additional_info) {
      text += ` (${ing.additional_info})`
    }

    return { text: text.trim() }
  })
})

const ingredientTokens = computed(() =>
  ingredientSearchQuery.value
    .split(',')
    .map((token) => token.trim())
    .filter((token) => token.length > 0)
)

const filteredAndSortedRecipes = computed(() => {
  let list: RecipeListItemWithIngredients[] = recipes.value
  const titleTerm = searchQuery.value.trim()
  const ingredientTerms = ingredientTokens.value

  if (titleTerm) {
    if (!fuseInstance) return []
    const titleResults = fuseInstance.search(titleTerm)
    list = titleResults.map((res) => res.item)
  }

  if (ingredientTerms.length) {
    if (!fuseInstance) {
      list = []
    } else {
      let ingredientMatchIds: Set<number> | null = null
      for (const token of ingredientTerms) {
        const ids = new Set<number>()
        const matches = fuseInstance.search(token)
        for (const match of matches) {
          if (
            match.matches?.some((m) => (m.key ?? '').startsWith('ingredients'))
          ) {
            ids.add(match.item.id)
          }
        }
        if (ids.size === 0) {
          ingredientMatchIds = new Set()
          break
        }
        ingredientMatchIds = ingredientMatchIds
          ? new Set([...ingredientMatchIds].filter((id) => ids.has(id)))
          : ids
        if (ingredientMatchIds.size === 0) break
      }
      if (ingredientMatchIds && ingredientMatchIds.size > 0) {
        list = list.filter((recipe) => ingredientMatchIds.has(recipe.id))
      } else if (ingredientMatchIds && ingredientMatchIds.size === 0) {
        list = []
      }
    }
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
    const data = await listRecipesWithIngredients()
    recipes.value = data
    rebuildFuse()
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Failed to load recipes'
  } finally {
    loading.value = false
  }
}

async function viewRecipe(id: number) {
  try {
    viewingRecipe.value = await getRecipe(id)
    displayServings.value = viewingRecipe.value.servings || 1
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Failed to load recipe'
  }
}

function closeDetailView() {
  viewingRecipe.value = null
  displayServings.value = 1
}

function adjustServings(delta: number) {
  displayServings.value = Math.max(1, displayServings.value + delta)
}

function editFromDetail() {
  if (viewingRecipe.value) {
    const id = viewingRecipe.value.id
    viewingRecipe.value = null
    startEdit(id)
  }
}

function startEdit(id: number) {
  editingId.value = id
  showRecipeForm.value = true
  getRecipe(id).then((recipe) => {
    editingStatus.value = (recipe.status === 'draft' || recipe.status === 'confirmed') ? recipe.status : 'draft'
    formInitial.value = {
      title: recipe.title,
      subtitle: recipe.subtitle ?? '',
      description: recipe.description ?? '',
      servings: recipe.servings ?? null,
      source_id: recipe.source_id ?? null,
      source_page: recipe.source_page ?? '',
      image_path: recipe.image_path ?? null,
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
    showRecipeForm.value = true
  }).catch((e) => {
    error.value = e instanceof Error ? e.message : 'Failed to load recipe'
  })
}

function closeEdit() {
  editingId.value = null
  formInitial.value = null
  editingStatus.value = null
  showRecipeForm.value = false
}

function openManualForm() {
  editingId.value = null
  formInitial.value = null
  editingStatus.value = null
  showRecipeForm.value = true
}

async function onFormSubmit(
  payload: RecipeFormPayload,
  imageFile: File | string | null,
  cropPoints?: Array<{ x: number; y: number }>
) {
  error.value = ''
  try {
    let recipeId: number
    if (editingId.value != null) {
      await updateRecipe(editingId.value, payload)
      recipeId = editingId.value
    } else {
      const newRecipe = await createRecipe(payload)
      recipeId = newRecipe.id
    }

    // Handle image upload or deletion
    if (imageFile && recipeId) {
      if (imageFile === 'DELETE') {
        await updateRecipe(recipeId, { image_path: null } as any)
      } else if (imageFile instanceof File) {
        const formData = new FormData()
        formData.append('image', imageFile)
        if (cropPoints && cropPoints.length === 4) {
          formData.append('points', JSON.stringify(cropPoints))
        }
        const response = await fetch(`/api/recipes/${recipeId}/image`, {
          method: 'POST',
          body: formData,
        })
        if (!response.ok) {
          throw new Error('Failed to upload image')
        }
      }
    }

    closeEdit()
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

async function onDeleteFromEdit() {
  if (!editingId.value) return
  if (!confirm('Delete this recipe? This cannot be undone.')) return
  error.value = ''
  try {
    await deleteRecipe(editingId.value)
    closeEdit()
    await loadList()
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Failed to delete recipe'
  }
}

onMounted(loadList)
</script>

<style scoped>
.recipes-view {
  max-width: 1400px;
  margin: 0 auto;
}

.recipes-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  margin-bottom: var(--spacing-xl);
  gap: var(--spacing-lg);
  flex-wrap: wrap;
}

.recipes-header__main {
  flex: 1;
  min-width: 250px;
}

.recipes-title {
  font-size: 2rem;
  font-weight: 800;
  color: var(--color-text);
  margin: 0 0 var(--spacing-xs) 0;
  letter-spacing: -0.02em;
}

.recipes-subtitle {
  font-size: 1rem;
  color: var(--color-text-muted);
  margin: 0;
}

.recipes-header__actions {
  display: flex;
  gap: var(--spacing-sm);
}

.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--spacing-sm);
  padding: var(--spacing-sm) var(--spacing-lg);
  border: none;
  border-radius: var(--radius-md);
  font: inherit;
  font-weight: 600;
  font-size: 0.95rem;
  cursor: pointer;
  transition: all var(--transition-fast);
  white-space: nowrap;
}

.btn--primary {
  background: var(--color-btn-primary-bg);
  color: var(--color-btn-primary-fg);
  box-shadow: var(--shadow-sm);
}

.btn--primary:hover {
  background: var(--color-btn-primary-hover);
  box-shadow: var(--shadow-md);
  transform: translateY(-1px);
}

.btn--with-icon svg {
  width: 20px;
  height: 20px;
  stroke-width: 2;
}

/* Toolbar */
.recipes-toolbar {
  display: flex;
  gap: var(--spacing-md);
  margin-bottom: var(--spacing-xl);
  flex-wrap: wrap;
  align-items: flex-end;
}

.recipes-toolbar__searches {
  display: flex;
  gap: var(--spacing-md);
  flex: 1;
  flex-wrap: wrap;
  min-width: 0;
}

.recipes-toolbar__meta {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: var(--spacing-sm);
}

.recipes-toolbar__count {
  margin: 0;
  font-size: 0.9rem;
  color: var(--color-text-muted);
}

.search-box {
  position: relative;
  flex: 1;
  min-width: 220px;
  max-width: 420px;
}

.search-box__icon {
  position: absolute;
  left: var(--spacing-md);
  top: 50%;
  transform: translateY(-50%);
  width: 20px;
  height: 20px;
  color: var(--color-text-muted);
  pointer-events: none;
}

.search-box__input {
  width: 100%;
  padding: var(--spacing-sm) var(--spacing-md) var(--spacing-sm) 3rem;
  border: 1px solid var(--color-input-border);
  border-radius: var(--radius-md);
  font: inherit;
  font-size: 0.95rem;
  background: var(--color-input-bg);
  color: var(--color-text);
  transition: all var(--transition-fast);
}

.search-box__input:focus {
  outline: none;
  border-color: var(--color-border-focus);
  box-shadow: 0 0 0 3px rgba(255, 107, 53, 0.1);
}

.filter-group {
  display: flex;
  gap: var(--spacing-sm);
}

.filter-select {
  padding: var(--spacing-sm) var(--spacing-md);
  border: 1px solid var(--color-input-border);
  border-radius: var(--radius-md);
  font: inherit;
  font-size: 0.95rem;
  background: var(--color-input-bg);
  color: var(--color-text);
  cursor: pointer;
  transition: all var(--transition-fast);
}

.filter-select:focus {
  outline: none;
  border-color: var(--color-border-focus);
  box-shadow: 0 0 0 3px rgba(255, 107, 53, 0.1);
}

/* Recipe Grid */
.recipes-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: var(--spacing-lg);
}

.recipe-card {
  background: var(--color-bg-elevated);
  border-radius: var(--radius-lg);
  overflow: hidden;
  box-shadow: var(--shadow-card);
  transition: all var(--transition-base);
  cursor: pointer;
  position: relative;
}

.recipe-card:hover {
  box-shadow: var(--shadow-hover);
  transform: translateY(-2px);
}

.recipe-card__image {
  position: relative;
  width: 100%;
  height: 200px;
  overflow: hidden;
  background: var(--color-bg-muted);
}

.recipe-card__image img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: transform var(--transition-slow);
}

.recipe-card:hover .recipe-card__image img {
  transform: scale(1.05);
}

.recipe-card__placeholder {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--color-text-light);
}

.recipe-card__placeholder svg {
  width: 64px;
  height: 64px;
  opacity: 0.3;
}

.recipe-card__badge {
  position: absolute;
  top: var(--spacing-sm);
  left: var(--spacing-sm);
  padding: var(--spacing-xs) var(--spacing-sm);
  border-radius: var(--radius-sm);
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.recipe-card__badge--draft {
  background: var(--color-draft-bg);
  color: var(--color-draft-fg);
}

.recipe-card__content {
  padding: var(--spacing-lg);
}

.recipe-card__title {
  font-size: 1.125rem;
  font-weight: 700;
  color: var(--color-text);
  margin: 0 0 var(--spacing-xs) 0;
  line-height: 1.4;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.recipe-card__subtitle {
  font-size: 0.875rem;
  color: var(--color-text-muted);
  margin: 0 0 var(--spacing-md) 0;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.recipe-card__meta {
  display: flex;
  gap: var(--spacing-md);
  flex-wrap: wrap;
}

.recipe-card__meta-item {
  display: flex;
  align-items: center;
  gap: var(--spacing-xs);
  font-size: 0.875rem;
  color: var(--color-text-muted);
}

.recipe-card__meta-item svg {
  width: 16px;
  height: 16px;
  stroke-width: 2;
}

.recipe-card__actions {
  position: absolute;
  top: var(--spacing-sm);
  right: var(--spacing-sm);
  display: flex;
  gap: var(--spacing-xs);
  opacity: 0;
  transition: opacity var(--transition-fast);
}

.recipe-card:hover .recipe-card__actions {
  opacity: 1;
}

.recipe-card__action-btn {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  border-radius: var(--radius-md);
  background: rgba(255, 255, 255, 0.95);
  cursor: pointer;
  transition: all var(--transition-fast);
}

.recipe-card__action-btn svg {
  width: 18px;
  height: 18px;
  stroke-width: 2;
}

.recipe-card__action-btn--edit {
  color: var(--color-primary);
}

.recipe-card__action-btn--edit:hover {
  background: var(--color-primary);
  color: white;
}

/* Messages */
.error-message,
.loading-message {
  padding: var(--spacing-md) var(--spacing-lg);
  border-radius: var(--radius-md);
  margin-bottom: var(--spacing-lg);
  text-align: center;
}

.error-message {
  background: var(--color-error-bg);
  color: var(--color-error);
  border: 1px solid var(--color-delete-border);
}

.loading-message {
  background: var(--color-bg-elevated);
  color: var(--color-text-muted);
}

/* Empty State */
.empty-state {
  text-align: center;
  padding: var(--spacing-2xl) var(--spacing-lg);
  background: var(--color-bg-elevated);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-card);
}

.empty-state svg {
  width: 80px;
  height: 80px;
  color: var(--color-text-light);
  margin-bottom: var(--spacing-lg);
}

.empty-state h3 {
  font-size: 1.5rem;
  font-weight: 700;
  color: var(--color-text);
  margin: 0 0 var(--spacing-sm) 0;
}

.empty-state p {
  font-size: 1rem;
  color: var(--color-text-muted);
  margin: 0 0 var(--spacing-lg) 0;
}

/* Recipe Detail View */
.recipe-detail-overlay {
  position: fixed;
  inset: 0;
  z-index: 200;
  background: var(--color-bg-overlay);
  display: flex;
  align-items: flex-start;
  justify-content: center;
  overflow-y: auto;
  backdrop-filter: blur(4px);
}

.recipe-detail-panel {
  background: var(--color-bg);
  width: 100%;
  max-width: 1200px;
  min-height: 100vh;
  position: relative;
}

.recipe-detail-close {
  position: fixed;
  top: var(--spacing-lg);
  right: var(--spacing-lg);
  width: 48px;
  height: 48px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  border-radius: var(--radius-full);
  background: rgba(0, 0, 0, 0.8);
  color: white;
  cursor: pointer;
  transition: all var(--transition-fast);
  z-index: 10;
}

.recipe-detail-close:hover {
  background: var(--color-error);
  transform: scale(1.1);
}

.recipe-detail-close svg {
  width: 24px;
  height: 24px;
  stroke-width: 2;
}

.recipe-detail-content {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-2xl);
}

.recipe-detail-hero {
  width: 100%;
  max-height: 500px;
  overflow: hidden;
}

.recipe-detail-hero img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.recipe-detail-header {
  padding: 0 var(--spacing-xl);
  max-width: 900px;
  margin: 0 auto;
}

.recipe-detail-title {
  font-size: 3rem;
  font-weight: 800;
  color: var(--color-text);
  margin: 0 0 var(--spacing-md) 0;
  line-height: 1.2;
  letter-spacing: -0.02em;
}

.recipe-detail-subtitle {
  font-size: 1.5rem;
  color: var(--color-text-muted);
  margin: 0 0 var(--spacing-lg) 0;
  line-height: 1.4;
}

.recipe-detail-description {
  font-size: 1.125rem;
  color: var(--color-text);
  margin: 0 0 var(--spacing-xl) 0;
  line-height: 1.6;
}

.recipe-detail-meta {
  display: flex;
  align-items: center;
  gap: var(--spacing-lg);
  flex-wrap: wrap;
  padding-top: var(--spacing-lg);
  border-top: 1px solid var(--color-border);
}

.recipe-detail-meta-item {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  font-size: 1rem;
  font-weight: 600;
  color: var(--color-text);
}

.recipe-detail-meta-item svg {
  width: 20px;
  height: 20px;
  stroke-width: 2;
  color: var(--color-primary);
}

.recipe-detail-servings {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  padding: var(--spacing-sm) var(--spacing-md);
  background: var(--color-bg-elevated);
  border-radius: var(--radius-md);
  border: 1px solid var(--color-border);
}

.recipe-detail-servings svg {
  width: 20px;
  height: 20px;
  stroke-width: 2;
  color: var(--color-primary);
}

.servings-btn {
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  background: var(--color-bg);
  color: var(--color-text);
  font-size: 1.125rem;
  font-weight: 700;
  cursor: pointer;
  transition: all var(--transition-fast);
}

.servings-btn:hover:not(:disabled) {
  background: var(--color-primary);
  color: white;
  border-color: var(--color-primary);
}

.servings-btn:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}

.servings-value {
  min-width: 32px;
  text-align: center;
  font-weight: 700;
  font-size: 1.125rem;
  color: var(--color-text);
}

.servings-label {
  font-size: 0.95rem;
  color: var(--color-text-muted);
}

.recipe-detail-body {
  display: grid;
  grid-template-columns: 1fr 400px;
  gap: var(--spacing-2xl);
  padding: 0 var(--spacing-xl);
  max-width: 1400px;
  margin: 0 auto;
}

.recipe-detail-section {
  background: var(--color-bg-elevated);
  border-radius: var(--radius-lg);
  padding: var(--spacing-xl);
  box-shadow: var(--shadow-card);
}

.recipe-detail-section--sticky {
  align-self: start;
  position: sticky;
  top: var(--spacing-lg);
}

.recipe-detail-section--full {
  grid-column: 1 / -1;
  padding: 0 var(--spacing-xl);
  max-width: 1400px;
  margin: 0 auto;
  background: transparent;
  box-shadow: none;
}

.recipe-detail-section-title {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  font-size: 1.5rem;
  font-weight: 700;
  color: var(--color-text);
  margin: 0 0 var(--spacing-lg) 0;
}

.recipe-detail-section-title svg {
  width: 24px;
  height: 24px;
  stroke-width: 2;
  color: var(--color-primary);
}

.recipe-steps-list {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xl);
}

.recipe-step {
  display: grid;
  grid-template-columns: 40px 1fr;
  gap: var(--spacing-md);
}

.recipe-step-number {
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-full);
  background: var(--color-primary);
  color: white;
  font-weight: 700;
  font-size: 1.125rem;
  flex-shrink: 0;
}

.recipe-step-text {
  margin: 0;
  font-size: 1rem;
  line-height: 1.6;
  color: var(--color-text);
  padding-top: 8px;
}

.recipe-ingredients-list {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
}

.recipe-ingredient {
  padding: var(--spacing-sm) 0;
  border-bottom: 1px solid var(--color-border);
}

.recipe-ingredient:last-child {
  border-bottom: none;
}

.recipe-ingredient-text {
  color: var(--color-text);
  font-size: 0.95rem;
  line-height: 1.5;
}

.recipe-tips-list {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
}

.recipe-tips-list li {
  padding-left: var(--spacing-lg);
  position: relative;
  color: var(--color-text);
  font-size: 1rem;
  line-height: 1.6;
}

.recipe-tips-list li::before {
  content: '💡';
  position: absolute;
  left: 0;
}

.recipe-nutrition {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: var(--spacing-lg);
}

.recipe-nutrition-item {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xs);
  padding: var(--spacing-md);
  background: var(--color-bg-elevated);
  border-radius: var(--radius-md);
  border: 1px solid var(--color-border);
}

.recipe-nutrition-label {
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--color-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.recipe-nutrition-value {
  font-size: 1.25rem;
  font-weight: 700;
  color: var(--color-primary);
}

/* Edit Overlay */
.recipe-edit-overlay {
  position: fixed;
  inset: 0;
  z-index: 200;
  background: var(--color-bg-overlay);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--spacing-lg);
  backdrop-filter: blur(4px);
}

.recipe-edit-panel {
  background: var(--color-bg-elevated);
  border-radius: var(--radius-xl);
  box-shadow: var(--shadow-xl);
  max-width: 900px;
  width: 100%;
  max-height: 90vh;
  display: flex;
  flex-direction: column;
}

.recipe-edit-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--spacing-lg) var(--spacing-xl);
  border-bottom: 1px solid var(--color-border);
  flex-shrink: 0;
}

.recipe-edit-header h2 {
  margin: 0;
  font-size: 1.5rem;
  font-weight: 700;
  color: var(--color-text);
}

.recipe-edit-header-actions {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
}

.btn--danger {
  background: var(--color-error-bg);
  color: var(--color-error);
  border: 1px solid var(--color-delete-border);
}

.btn--danger:hover {
  background: var(--color-error);
  color: white;
}

.btn--small {
  padding: var(--spacing-xs) var(--spacing-md);
  font-size: 0.875rem;
}

.close-btn {
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  border-radius: var(--radius-md);
  background: transparent;
  color: var(--color-text-muted);
  cursor: pointer;
  transition: all var(--transition-fast);
}

.close-btn:hover {
  background: var(--color-bg-muted);
  color: var(--color-text);
}

.close-btn svg {
  width: 24px;
  height: 24px;
  stroke-width: 2;
}

.recipe-edit-body {
  overflow-y: auto;
  flex: 1;
  padding: var(--spacing-xl);
}

@media (max-width: 768px) {
  .recipes-title {
    font-size: 1.75rem;
  }

  .recipes-header {
    flex-direction: column;
  }

  .recipes-header__actions {
    width: 100%;
  }

  .btn {
    flex: 1;
  }

  .recipes-grid {
    grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
    gap: var(--spacing-md);
  }

  .recipes-toolbar {
    flex-direction: column;
    align-items: stretch;
  }

  .recipes-toolbar__searches {
    flex-direction: column;
  }

  .recipes-toolbar__meta {
    align-items: flex-start;
    width: 100%;
  }

  .recipes-toolbar__count {
    align-self: flex-start;
  }

  .search-box {
    max-width: none;
  }

  .recipe-detail-title {
    font-size: 2rem;
  }

  .recipe-detail-subtitle {
    font-size: 1.25rem;
  }

  .recipe-detail-body {
    grid-template-columns: 1fr;
  }

  .recipe-detail-section--sticky {
    position: static;
  }

  .recipe-detail-header,
  .recipe-detail-body,
  .recipe-detail-section--full {
    padding-left: var(--spacing-md);
    padding-right: var(--spacing-md);
  }

  .recipe-detail-section {
    padding: var(--spacing-md);
  }

  .recipe-edit-panel {
    max-height: 95vh;
  }

  .recipe-edit-body {
    padding: var(--spacing-md);
  }
}

@media (max-width: 480px) {
  .recipes-grid {
    grid-template-columns: 1fr;
  }

  .filter-group {
    width: 100%;
  }

  .filter-select {
    flex: 1;
  }

  .recipe-detail-close {
    top: var(--spacing-sm);
    right: var(--spacing-sm);
    width: 40px;
    height: 40px;
  }

  .recipe-ingredient {
    grid-template-columns: 80px 1fr;
  }

  .recipe-nutrition {
    grid-template-columns: 1fr;
  }
}
</style>
