<template>
  <div class="recipes-view">
    <div class="recipes-header">
      <div class="recipes-header__main">
        <h1 class="recipes-title">My Recipes</h1>
        <p class="recipes-subtitle">{{ recipes.length }} recipe{{ recipes.length !== 1 ? 's' : '' }} in your collection</p>
      </div>
      <div class="recipes-header__actions">
        <div class="recipes-header__import-group">
          <button type="button" class="btn btn--primary btn--with-icon" @click="showImportOverlay = true">
            <svg viewBox="0 0 24 24" fill="none">
              <path d="M21 15V19C21 19.5304 20.7893 20.0391 20.4142 20.4142C20.0391 20.7893 19.5304 21 19 21H5C4.46957 21 3.96086 20.7893 3.58579 20.4142C3.21071 20.0391 3 19.5304 3 19V15" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              <path d="M7 10L12 15L17 10" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              <path d="M12 15V3" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
            <span>Import from Image</span>
          </button>
          <button type="button" class="btn btn--secondary btn--with-icon" @click="showUrlImportOverlay = true">
            <svg viewBox="0 0 24 24" fill="none">
              <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
            <span>Import from URL</span>
          </button>
        </div>
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
    <RecipeUrlImportOverlay
      v-if="showUrlImportOverlay"
      @done="onImportDone"
      @close="showUrlImportOverlay = false"
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
            v-if="getRecipeCardImageUrl(recipe)"
            :src="getRecipeCardImageUrl(recipe)!"
            :alt="recipe.title"
            loading="lazy"
          />
          <div
            v-else-if="recipe.image_processing_pending"
            class="recipe-card__placeholder recipe-card__placeholder--pending"
            title="Image not processed yet"
          >
            <span class="recipe-card__pending-label">Pending crop</span>
          </div>
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
            <span
              v-if="recipe.source_name"
              class="recipe-card__meta-item recipe-card__source"
              @click.stop="showCoverOverlay($event, recipe)"
            >
              <svg viewBox="0 0 24 24" fill="none">
                <path d="M4 19.5C4 18.837 4.26339 18.2011 4.73223 17.7322C5.20107 17.2634 5.83696 17 6.5 17H20" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                <path d="M6.5 2H20V22H6.5C5.83696 22 5.20107 21.7366 4.73223 21.2678C4.26339 20.7989 4 20.163 4 19.5V4.5C4 3.83696 4.26339 3.20107 4.73223 2.73223C5.20107 2.26339 5.83696 2 6.5 2Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
              <span class="recipe-card__source-label">
                {{ recipe.source_name }}<span v-if="recipe.source_page"> · Page {{ recipe.source_page }}</span>
              </span>
            </span>
          </div>
        </div>
        <div class="recipe-card__actions">
          <button
            type="button"
            class="recipe-card__action-btn recipe-card__action-btn--favorite"
            :class="{ 'recipe-card__action-btn--favorite-active': recipe.favorite }"
            :title="recipe.favorite ? 'Unfavorite' : 'Favorite'"
            @click.stop="toggleFavorite(recipe.id)"
          >
            <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path
                d="M12 17.27L18.18 21L16.54 13.97L22 9.24L14.81 8.63L12 2L9.19 8.63L2 9.24L7.46 13.97L5.82 21L12 17.27Z"
                :fill="recipe.favorite ? 'currentColor' : 'none'"
                stroke="currentColor"
                stroke-width="2"
                stroke-linejoin="round"
              />
            </svg>
          </button>
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
      <p>Start by importing from an image, a URL, or create a recipe manually</p>
      <div class="empty-state__actions">
        <button type="button" class="btn btn--primary" @click="showImportOverlay = true">
          Import from Image
        </button>
        <button type="button" class="btn btn--secondary" @click="showUrlImportOverlay = true">
          Import from URL
        </button>
        <button type="button" class="btn btn--secondary" @click="openManualForm">
          Create Manually
        </button>
      </div>
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
          <!-- Hero Image (upload, or best URL from URL import) -->
          <div
            v-if="
              (viewingRecipe.image_path && viewingRecipe.image_processing_pending) ||
              getRecipeHeroImageUrl(viewingRecipe)
            "
            class="recipe-detail-hero note-block note-block--image"
          >
            <button
              v-if="viewingRecipe.image_path && viewingRecipe.image_processing_pending"
              type="button"
              class="recipe-detail-pending-hero"
              @click.stop="startEdit(viewingRecipe.id); closeDetailView()"
            >
              <span class="recipe-detail-pending-hero__text">Image not processed yet — open editor to crop and optimize</span>
            </button>
            <img
              v-else-if="getRecipeHeroImageUrl(viewingRecipe)"
              :src="getRecipeHeroImageUrl(viewingRecipe)!"
              :alt="viewingRecipe.title"
            />
          </div>

          <!-- Header -->
          <div class="recipe-detail-header note-block note-block--header">
            <h1 class="recipe-detail-title">{{ viewingRecipe.title }}</h1>
            <p v-if="viewingRecipe.subtitle" class="recipe-detail-subtitle">{{ viewingRecipe.subtitle }}</p>
            <div v-if="viewingRecipe.tags?.length" class="recipe-detail-tags">
              <span v-for="t in viewingRecipe.tags" :key="t" class="recipe-detail-tag-chip">{{ formatTagChip(t) }}</span>
            </div>

            <div class="recipe-detail-meta">
              <div class="recipe-detail-times recipe-detail-times--rows">
                <div class="recipe-detail-times__block">
                  <div class="recipe-detail-time-row">
                    <span class="recipe-detail-time-label">Prep</span>
                    <span class="recipe-detail-time-value">{{
                      formatRecipeMinutes(viewingRecipe.prep_time_min, viewingRecipe.prep_time_source)
                    }}</span>
                  </div>
                  <div class="recipe-detail-time-row">
                    <span class="recipe-detail-time-label">Cook</span>
                    <span class="recipe-detail-time-value">{{
                      formatRecipeMinutes(viewingRecipe.cook_time_min, viewingRecipe.cook_time_source)
                    }}</span>
                  </div>
                  <p v-if="timeEstimateError" class="recipe-detail-time-inline-error">{{ timeEstimateError }}</p>
                </div>
                <button
                  type="button"
                  class="btn btn--icon recipe-detail-time-refresh-combined"
                  :disabled="timeEstimateLoading"
                  title="Re-estimate prep and cook times with AI"
                  aria-label="Re-estimate prep and cook times with AI"
                  @click="runEstimateTimesForDetail"
                >
                  <span aria-hidden="true">↻</span>
                </button>
              </div>
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

          <!-- Description -->
          <div v-if="viewingRecipe.description" class="note-block note-block--description">
            <h2 class="note-block__title">
              <svg viewBox="0 0 24 24" fill="none">
                <path d="M4 4H20V20H4V4Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
                <path d="M8 8H16" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
                <path d="M8 12H16" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
                <path d="M8 16H14" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
              </svg>
              Description
            </h2>
            <p class="note-block__content">{{ viewingRecipe.description }}</p>
          </div>

          <!-- Steps -->
          <div class="note-block note-block--steps">
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

          <!-- Ingredients -->
          <div class="note-block note-block--ingredients">
            <h2 class="recipe-detail-section-title">
              <svg viewBox="0 0 24 24" fill="none">
                <path d="M9 5H7C5.89543 5 5 5.89543 5 7V19C5 20.1046 5.89543 21 7 21H17C18.1046 21 19 20.1046 19 19V7C19 5.89543 18.1046 5 17 5H15" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
              Ingredients
            </h2>
            <div
              v-for="(section, sidx) in ingredientSections"
              :key="sidx"
              class="recipe-ingredient-section"
              :class="{ 'recipe-ingredient-section--with-heading': section.heading }"
            >
              <div v-if="section.heading" class="recipe-ingredient-section__heading">
                {{ section.heading }}
              </div>
              <ul class="recipe-ingredients-list">
                <li v-for="(line, idx) in section.items" :key="`${sidx}-${idx}`" class="recipe-ingredient">
                  <span
                    v-if="line.category?.trim()"
                    class="recipe-ingredient-category"
                    :title="line.category"
                  >
                    <span class="recipe-ingredient-category__de">{{ getIngredientCategoryLabelDe(line.category) }}</span>
                    <span class="recipe-ingredient-category__key">({{ line.category }})</span>
                  </span>
                  <span class="recipe-ingredient-text">{{ line.text }}</span>
                </li>
              </ul>
            </div>
          </div>

          <!-- Tips -->
          <div v-if="viewingRecipe.tips?.length" class="note-block note-block--tips">
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

          <!-- Health + Nutrition -->
          <div v-if="viewingRecipe" class="note-block note-block--nutrition">
            <div class="recipe-health-section">
              <h2 class="recipe-detail-section-title">
                <svg viewBox="0 0 24 24" fill="none">
                  <path d="M12 21C12 21 4 13.5 4 8.5C4 5.42 6.42 3 9.5 3C11.24 3 12.91 3.81 14 5.08C15.09 3.81 16.76 3 18.5 3C21.58 3 24 5.42 24 8.5C24 13.5 16 21 16 21H12Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
                Health estimate
              </h2>
              <p class="recipe-health-disclaimer">
                Practical everyday estimate for cooking — not medical advice.
              </p>

              <div v-if="healthScoreError" class="recipe-health-error">{{ healthScoreError }}</div>

              <div
                v-if="healthScoreResult && healthScoreResult.estimate.healthScore != null"
                class="recipe-health-body"
              >
                <div class="recipe-health-score-row">
                  <span class="recipe-health-score-value">{{ healthScoreResult.estimate.healthScore }}</span>
                  <span class="recipe-health-score-max">/ 100</span>
                  <span
                    v-if="healthScoreResult.estimate.confidence != null"
                    class="recipe-health-confidence"
                  >
                    Confidence: {{ Math.round(healthScoreResult.estimate.confidence * 100) }}%
                  </span>
                </div>
                <p v-if="healthScoreResult.estimate.summary" class="recipe-health-summary">
                  {{ healthScoreResult.estimate.summary }}
                </p>
                <div class="recipe-health-columns">
                  <div v-if="healthScoreResult.estimate.positives?.length" class="recipe-health-column">
                    <h3 class="recipe-health-column-title">Positives</h3>
                    <ul class="recipe-health-list">
                      <li v-for="(p, i) in healthScoreResult.estimate.positives" :key="'p-' + i">{{ p }}</li>
                    </ul>
                  </div>
                  <div v-if="healthScoreResult.estimate.concerns?.length" class="recipe-health-column">
                    <h3 class="recipe-health-column-title">Concerns</h3>
                    <ul class="recipe-health-list">
                      <li v-for="(c, i) in healthScoreResult.estimate.concerns" :key="'c-' + i">{{ c }}</li>
                    </ul>
                  </div>
                </div>
                <div v-if="healthScoreResult.estimate.improvementTips?.length" class="recipe-health-tips">
                  <h3 class="recipe-health-column-title">Tips</h3>
                  <ul class="recipe-health-list">
                    <li v-for="(t, i) in healthScoreResult.estimate.improvementTips" :key="'t-' + i">{{ t }}</li>
                  </ul>
                </div>
              </div>

              <div class="recipe-detail-health-cta">
                <button
                  type="button"
                  class="btn btn--secondary"
                  :disabled="healthScoreLoading"
                  @click="requestDetailHealthScore"
                >
                  {{
                    healthScoreLoading
                      ? 'Estimating…'
                      : healthScoreResult && healthScoreResult.estimate.healthScore != null
                        ? 'New health estimate'
                        : 'Get health score'
                  }}
                </button>
                <span v-if="healthScoreLoading" class="recipe-detail-health-cta__status">Working…</span>
              </div>
            </div>

            <div class="recipe-health-nutrition-divider" role="presentation" />

            <h2 class="recipe-detail-section-title">
              <svg viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
              Nutrition Information
            </h2>
            <div v-if="hasNutrition" class="recipe-nutrition">
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

            <div class="recipe-detail-nutrition-cta">
              <button
                type="button"
                class="btn btn--secondary"
                @click="requestDetailNutritionEstimate"
                :disabled="nutritionLoading"
              >
                {{ nutritionLoading ? 'Estimating nutrition…' : hasNutrition ? 'Recalculate nutrition' : 'Estimate nutrition' }}
              </button>
              <span v-if="nutritionLoading" class="recipe-detail-nutrition-cta__status">Updating nutrition…</span>
            </div>
          </div>

          <!-- Cooking history -->
          <div class="note-block note-block--history" v-if="viewingRecipe">
            <div class="recipe-detail-history__header">
              <h2 class="recipe-detail-section-title" style="margin: 0;">
                <svg viewBox="0 0 24 24" fill="none">
                  <path d="M12 8V12L14 14" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                  <path d="M21 12C21 16.9706 16.9706 21 12 21C7.02944 21 3 16.9706 3 12C3 7.02944 7.02944 3 12 3C16.9706 3 21 7.02944 21 12Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
                Cook History
              </h2>
              <button
                type="button"
                class="btn btn--secondary"
                :disabled="hasCookedToday(viewingRecipe.id)"
                @click="markCookedToday(viewingRecipe.id)"
              >
                {{ hasCookedToday(viewingRecipe.id) ? 'Cooked today' : 'Mark cooked today' }}
              </button>
            </div>
            <p v-if="historySummary(viewingRecipe.id)" class="recipe-detail-history__summary">
              {{ historySummary(viewingRecipe.id) }}
            </p>
            <ul class="recipe-detail-history__list">
              <li v-for="date in recipeHistories[viewingRecipe.id] ?? []" :key="date">
                {{ date }}
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>

    <!-- Would cook again prompt (shown once after first "Mark cooked today") -->
    <div
      v-if="showWouldCookAgainPrompt"
      class="would-cook-again-overlay"
      @click.self="showWouldCookAgainPrompt = false"
    >
      <div class="would-cook-again-panel">
        <h3>Would you cook this again?</h3>
        <p class="would-cook-again-subtitle">Select one option. You can always change it later in Edit Recipe.</p>
        <div class="would-cook-again-actions">
          <button type="button" class="btn btn--primary" @click="setWouldCookAgain('yes')">Yes</button>
          <button type="button" class="btn btn--secondary" @click="setWouldCookAgain('maybe')">Maybe</button>
          <button type="button" class="btn btn--secondary" @click="setWouldCookAgain('no')">No</button>
        </div>
        <div class="would-cook-again-close">
          <button type="button" class="btn btn--secondary btn--block" @click="showWouldCookAgainPrompt = false">
            Not now
          </button>
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
            :time-estimate-loading="timeEstimateLoading"
            :tag-generate-loading="tagGenerateLoading"
            @submit="onFormSubmit"
            @confirm="onConfirmRecipe"
            @cancel="closeEdit"
            @estimate-times="onFormEstimateTimes"
            @generate-tags="onFormGenerateTags"
          />
        </div>
      </div>
    </div>
  </div>

  <div
    v-if="coverOverlay.visible"
    class="recipe-cover-overlay"
    :style="{ top: coverOverlay.y + 'px', left: coverOverlay.x + 'px' }"
    @click.stop
  >
    <div class="recipe-cover-overlay__frame">
      <img :src="coverOverlay.src" :alt="coverOverlay.title ?? 'Book cover'" />
      <div v-if="coverOverlay.title" class="recipe-cover-overlay__title">
        {{ coverOverlay.title }}
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount, watch } from 'vue'
import Fuse from 'fuse.js'
import type { FuseOptions } from 'fuse.js'
import RecipeFormMultiStep from '../components/RecipeFormMultiStep.vue'
import RecipeImportOverlay from '../components/RecipeImportOverlay.vue'
import RecipeUrlImportOverlay from '../components/RecipeUrlImportOverlay.vue'
import {
  listRecipesWithIngredients,
  listRecipesWithIngredientsFiltered,
  getRecipe,
  createRecipe,
  updateRecipe,
  deleteRecipe,
  estimateRecipeNutrition,
  postRecipeHealthScore,
  postRecipeCooked,
  getRecipeHistory,
  setRecipeFavorite,
  estimateRecipeTimes,
  postGenerateRecipeTags,
} from '../api/recipes'
import { getIngredientCategoryLabelDe } from '../constants/ingredientCategories'
import type {
  Recipe,
  RecipeListItemWithIngredients,
  RecipeFormPayload,
  ParsedRecipeFromOcr,
  RecipeHealthScoreResponse,
  RecipeTimeEstimateSuccess,
  RecipeTimeSource,
} from '../api/recipes'
import { getPerServingValue } from '../utils/nutrition'
import { getRecipeCardImageUrl, getRecipeHeroImageUrl } from '../utils/recipeDisplayImage'

const props = defineProps<{ favoritesOnly?: boolean }>()

const recipes = ref<RecipeListItemWithIngredients[]>([])
const loading = ref(true)
const error = ref('')
const editingId = ref<number | null>(null)
const formInitial = ref<
  | (Partial<RecipeFormPayload> & {
      parsed_recipe?: ParsedRecipeFromOcr | null
      import_method?: string | null
      extract_confidence?: number | null
      extract_missing_fields?: string[] | null
      nutrition_kcal?: number | null
      nutrition_protein?: number | null
      nutrition_carbs?: number | null
      nutrition_fat?: number | null
      image_path?: string | null
      image_urls_json?: string | null
      image_processing_pending?: boolean
    })
  | null
>(null)
const editingStatus = ref<'draft' | 'confirmed' | null>(null)
const searchQuery = ref('')
const ingredientSearchQuery = ref('')
const sortBy = ref<'title-asc' | 'title-desc' | 'updated-desc' | 'updated-asc'>('updated-desc')
const showImportOverlay = ref(false)
const showUrlImportOverlay = ref(false)
const showRecipeForm = ref(false)
const viewingRecipe = ref<Recipe | null>(null)
const displayServings = ref<number>(1)
const coverOverlay = ref<{ visible: boolean; x: number; y: number; src?: string | null; title?: string | null }>({
  visible: false,
  x: 0,
  y: 0,
  src: null,
  title: null,
})
const recipeHistories = ref<Record<number, string[]>>({})
const nutritionLoading = ref(false)
const healthScoreLoading = ref(false)
const healthScoreResult = ref<RecipeHealthScoreResponse | null>(null)
const healthScoreError = ref('')

const timeEstimateLoading = ref(false)
const tagGenerateLoading = ref(false)
const timeEstimateError = ref('')

const showWouldCookAgainPrompt = ref(false)
const wouldCookAgainRecipeId = ref<number | null>(null)
const wouldCookAgainValue = ref<'yes' | 'maybe' | 'no' | null>(null)

async function loadRecipeHistories(recipeIds: number[]) {
  const map: Record<number, string[]> = {}
  await Promise.all(
    recipeIds.map(async (id) => {
      try {
        const res = await getRecipeHistory(id)
        map[id] = res.history
      } catch (err) {
        console.error('Failed to load history for', id, err)
        map[id] = []
      }
    })
  )
  recipeHistories.value = map
}

async function markCookedToday(recipeId: number) {
  if (!recipeId) return
  try {
    const res = await postRecipeCooked(recipeId)
    recipeHistories.value = { ...recipeHistories.value, [recipeId]: res.history }

    const current = viewingRecipe.value?.id === recipeId ? viewingRecipe.value : null
    const would = current?.would_cook_again ?? null
    if (would == null) {
      wouldCookAgainRecipeId.value = recipeId
      wouldCookAgainValue.value = null
      showWouldCookAgainPrompt.value = true
    }
  } catch (err) {
    console.error('Failed to mark recipe cooked:', err)
  }
}

async function setWouldCookAgain(value: 'yes' | 'maybe' | 'no') {
  const recipeId = wouldCookAgainRecipeId.value
  if (!recipeId) return

  try {
    const updated = await updateRecipe(recipeId, { would_cook_again: value } as any)
    showWouldCookAgainPrompt.value = false
    wouldCookAgainRecipeId.value = null
    wouldCookAgainValue.value = value

    if (viewingRecipe.value?.id === recipeId) {
      ;(viewingRecipe.value as any).would_cook_again = updated?.would_cook_again ?? value
    }
    if (editingId.value === recipeId && formInitial.value) {
      ;(formInitial.value as any).would_cook_again = updated?.would_cook_again ?? value
    }
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Failed to update would cook again'
  }
}

function hasCookedToday(recipeId: number) {
  const history = recipeHistories.value[recipeId] ?? []
  const today = new Date().toISOString().slice(0, 10)
  return history.includes(today)
}

function historySummary(recipeId: number) {
  const history = recipeHistories.value[recipeId] ?? []
  if (!history.length) return ''
  return `Cooked: ${history.slice(0, 2).join(', ')}${history.length > 2 ? ' …' : ''}`
}

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

function buildFormInitialFromImportedRecipe(recipe: Recipe): Partial<RecipeFormPayload> & {
  parsed_recipe?: ParsedRecipeFromOcr | null
  extract_confidence?: number | null
  extract_missing_fields?: string[] | null
  nutrition_kcal?: number | null
  nutrition_protein?: number | null
  nutrition_carbs?: number | null
  nutrition_fat?: number | null
  import_method?: string | null
  image_path?: string | null
  image_urls_json?: string | null
  image_processing_pending?: boolean
} {
  const pr = recipe.parsed_recipe
  type Ing = {
    amount: string
    unit: string
    name: string
    category?: string | null
    section_id?: number | null
    section_heading?: string | null
    original_text?: string | null
    additional_info?: string | null
  }
  const ingredients: Ing[] = []
  if (recipe.ingredients?.length) {
    for (const ing of recipe.ingredients) {
      ingredients.push({
        amount: ing.amount != null ? String(ing.amount) : '',
        unit: ing.unit ?? '',
        name: ing.name ?? ing.ingredient ?? '',
        category: ing.category ?? null,
        section_id: ing.section_id ?? null,
        section_heading: ing.section_heading ?? null,
        original_text: ing.original_text ?? null,
        additional_info: ing.additional_info ?? (ing as { additionalInfo?: string | null }).additionalInfo ?? null,
      })
    }
  } else if (pr?.ingredientsSections?.length) {
    for (const section of pr.ingredientsSections) {
      for (const item of section.items ?? []) {
        ingredients.push({
          amount: item.amount != null ? String(item.amount) : '',
          unit: (item as any).unit ?? '',
          name: (item as any).ingredient ?? (item as any).originalText ?? '',
          category: (item as any).category ?? null,
          section_heading: section.heading ?? null,
          original_text: (item as any).originalText ?? null,
          additional_info: (item as any).additionalInfo ?? null,
        })
      }
    }
  }
  if (ingredients.length === 0) ingredients.push({ amount: '', unit: '', name: '', additional_info: '' })

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
    import_method: recipe.import_method ?? 'manual',
    prep_time_min: recipe.prep_time_min ?? null,
    cook_time_min: recipe.cook_time_min ?? null,
    prep_time_source: recipe.prep_time_source ?? null,
    cook_time_source: recipe.cook_time_source ?? null,
    prep_time_confidence: recipe.prep_time_confidence ?? null,
    cook_time_confidence: recipe.cook_time_confidence ?? null,
    tags: recipe.tags ?? [],
    image_path: recipe.image_path ?? null,
    image_urls_json: recipe.image_urls_json ?? null,
    image_processing_pending: recipe.image_processing_pending ?? false,
  }
}

function onImportDone(recipe: Recipe) {
  showImportOverlay.value = false
  showUrlImportOverlay.value = false
  editingId.value = recipe.id
  editingStatus.value = 'draft'
  formInitial.value = buildFormInitialFromImportedRecipe(recipe)
  showRecipeForm.value = true
  loadList()
  const rid = recipe.id
  void postGenerateRecipeTags(rid)
    .then(() => getRecipe(rid))
    .then((r) => {
      if (editingId.value === rid) {
        formInitial.value = buildFormInitialFromImportedRecipe(r)
      }
      if (viewingRecipe.value?.id === rid) {
        viewingRecipe.value = r
      }
      return loadList()
    })
    .catch(() => {
      /* optional AI tagging */
    })
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

const ingredientSections = computed(() => {
  const recipe = viewingRecipe.value
  if (!recipe) return []

  const originalServings = recipe.servings || 1
  const scale = displayServings.value / originalServings
  const servingsChanged = displayServings.value !== originalServings
  const isImageBookRecipe = recipe.import_method === 'image' && recipe.source_id != null && recipe.source_type === 'book'
  const shouldShowOriginalText = isImageBookRecipe && !servingsChanged

  type IngredientLine = { text: string; category: string | null }
  const sections: { heading: string | null; key: string; items: IngredientLine[] }[] = []
  const pushToSection = (heading: string | null, key: string, text: string, category: string | null = null) => {
    let section = sections.length ? sections[sections.length - 1] : null
    if (!section || section.key !== key) {
      sections.push({ heading, key, items: [] })
      section = sections[sections.length - 1]
    }
    section.items.push({ text, category })
  }

  const formatAmountRange = (amount: number | null | undefined, amountMax: number | null | undefined) => {
    if (amount == null) return ''
    const scaledMin = parseFloat(String(amount)) * scale
    const roundedMin = Math.round(scaledMin * 100) / 100

    if (amountMax != null && amountMax !== amount) {
      const scaledMax = parseFloat(String(amountMax)) * scale
      const roundedMax = Math.round(scaledMax * 100) / 100
      return `${roundedMin}-${roundedMax}`
    }
    return `${roundedMin}`
  }

  if (recipe.ingredients?.length) {
    for (const ing of recipe.ingredients) {
      let text = ''
      const cat = ing.category?.trim() ? ing.category.trim() : null
      if (shouldShowOriginalText && ing.original_text) {
        text = ing.original_text ?? ''
      } else {
        const amountText = formatAmountRange(ing.amount ?? null, ing.amount_max ?? null)
        const ingredientName = (ing.name || ing.ingredient || '').trim()
        const additional = ing.additional_info ? ` (${ing.additional_info})` : ''
        text = ([amountText, ing.unit ?? null, ingredientName].filter(Boolean).join(' ').trim() + additional).trim()
      }
      if (text) {
        const key = `section-${ing.section_id ?? 'manual'}-${ing.section_heading ?? 'no-heading'}`
        pushToSection(ing.section_heading ?? null, key, text, cat)
      }
    }
  } else if (recipe.parsed_recipe?.ingredientsSections?.length) {
    recipe.parsed_recipe.ingredientsSections.forEach((section, idx) => {
      const sectionKey = `parsed-${idx}-${section.heading ?? 'no-heading'}`
      for (const item of section.items ?? []) {
        const amountText = formatAmountRange(item.amount ?? null, (item as any).amountMax ?? null)
      const ingredientName = (item.ingredient ?? '').trim()
      const additional = (item as any).additionalInfo ? ` (${(item as any).additionalInfo})` : ''
      const catRaw = (item as { category?: string | null }).category
      const cat = catRaw?.trim() ? catRaw.trim() : null

      let text = ''
      if (shouldShowOriginalText && item.originalText?.trim()) {
        text = item.originalText.trim()
      } else {
        text = [amountText, item.unit ?? null, ingredientName]
          .filter(Boolean)
          .join(' ')
          .trim()
        text = (text + additional).trim()
      }

      if (text) pushToSection(section.heading ?? null, sectionKey, text, cat)
      }
    })
  }

  return sections
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
    const data = props.favoritesOnly ? await listRecipesWithIngredientsFiltered({ favoriteOnly: true }) : await listRecipesWithIngredients()
    recipes.value = data
    rebuildFuse()
    await loadRecipeHistories(data.map((recipe) => recipe.id))
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Failed to load recipes'
  } finally {
    loading.value = false
  }
}

async function toggleFavorite(recipeId: number) {
  const current = recipes.value.find((r) => r.id === recipeId)
  if (!current) return
  const nextFavorite = !current.favorite

  try {
    const updated = await setRecipeFavorite(recipeId, nextFavorite)
    // Keep UI in sync quickly; if we are on favorites-only page, refresh list to apply server filter.
    const updatedFav = updated?.recipe?.favorite ?? nextFavorite
    current.favorite = updatedFav
    if (viewingRecipe.value?.id === recipeId) {
      ;(viewingRecipe.value as any).favorite = updatedFav
    }
    if (props.favoritesOnly && !updatedFav) {
      await loadList()
    }
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Failed to update favorite'
  }
}

async function viewRecipe(id: number) {
  try {
    viewingRecipe.value = await getRecipe(id)
    displayServings.value = viewingRecipe.value.servings || 1
    healthScoreResult.value = viewingRecipe.value.health_score ?? null
    healthScoreError.value = ''
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Failed to load recipe'
  }
}

async function runNutritionEstimate(recipeId: number, options?: { refreshList?: boolean }) {
  if (!recipeId || nutritionLoading.value) return
  nutritionLoading.value = true
  try {
    const result = await estimateRecipeNutrition(recipeId)
    console.log('[nutrition] estimate notes (recipe', recipeId, '):', result.notes)
    if (options?.refreshList ?? false) {
      await loadList()
    }
    if (viewingRecipe.value?.id === recipeId) {
      await viewRecipe(recipeId)
    }
  } catch (e) {
    console.error('Nutrition estimate failed:', e)
  } finally {
    nutritionLoading.value = false
  }
}

function showCoverOverlay(event: MouseEvent, recipe: RecipeListItemWithIngredients) {
  if (!recipe.source_image_path) return
  event.stopPropagation()
  const overlayHeight = 300
  const yPosition = Math.max(event.clientY - overlayHeight - 16, 12)
  coverOverlay.value = {
    visible: true,
    x: event.clientX + 12,
    y: yPosition,
    src: recipe.source_image_path,
    title: recipe.source_name ?? null,
  }
}

function hideCoverOverlay() {
  coverOverlay.value.visible = false
}

function requestDetailNutritionEstimate() {
  const id = viewingRecipe.value?.id
  if (!id) return
  runNutritionEstimate(id, { refreshList: true })
}

async function runHealthScoreEstimate(recipeId: number) {
  if (!recipeId || healthScoreLoading.value) return
  healthScoreLoading.value = true
  healthScoreError.value = ''
  try {
    const result = await postRecipeHealthScore(recipeId)
    healthScoreResult.value = result
    if (viewingRecipe.value?.id === recipeId) {
      viewingRecipe.value = { ...viewingRecipe.value, health_score: result }
    }
  } catch (e) {
    healthScoreError.value = e instanceof Error ? e.message : 'Health score request failed'
    healthScoreResult.value = null
  } finally {
    healthScoreLoading.value = false
  }
}

function requestDetailHealthScore() {
  const id = viewingRecipe.value?.id
  if (!id) return
  runHealthScoreEstimate(id)
}

function formatRecipeMinutes(
  v: number | null | undefined,
  source?: RecipeTimeSource | null
): string {
  if (v == null || Number.isNaN(Number(v)) || Number(v) <= 0) return '−'
  const n = Math.round(Number(v))
  const tilde = source === 'estimated' ? '~' : ''
  return `${tilde}${n} min`
}

function formatTagChip(t: string) {
  return t.replace(/_/g, ' ')
}

function mergeTimesIntoFormInitial(recipe: Recipe) {
  if (!formInitial.value) return
  formInitial.value = {
    ...formInitial.value,
    prep_time_min: recipe.prep_time_min ?? null,
    cook_time_min: recipe.cook_time_min ?? null,
    prep_time_source: recipe.prep_time_source ?? null,
    cook_time_source: recipe.cook_time_source ?? null,
    prep_time_confidence: recipe.prep_time_confidence ?? null,
    cook_time_confidence: recipe.cook_time_confidence ?? null,
    tags: recipe.tags ?? [],
  }
}

function applyEstimateResultToUi(recipeId: number, res: RecipeTimeEstimateSuccess) {
  if (viewingRecipe.value?.id === recipeId) {
    viewingRecipe.value = res.recipe
  }
  if (editingId.value === recipeId) {
    mergeTimesIntoFormInitial(res.recipe)
  }
  void loadList()
}

async function runEstimateTimesFlow(recipeId: number) {
  if (timeEstimateLoading.value) return
  timeEstimateLoading.value = true
  timeEstimateError.value = ''
  try {
    let res = await estimateRecipeTimes(recipeId, {})
    applyEstimateResultToUi(recipeId, res)
    const lastEstimate = res.estimate

    while (res.pendingOriginalReplace?.prep || res.pendingOriginalReplace?.cook) {
      const p = res.pendingOriginalReplace!
      let rp = false
      let rc = false
      if (p.prep) {
        if (
          window.confirm(
            `Do you want to overwrite original ${p.prep.current} min with estimated ${p.prep.suggested} min?`
          )
        ) {
          rp = true
        }
      }
      if (p.cook) {
        if (
          window.confirm(
            `Do you want to overwrite original ${p.cook.current} min with estimated ${p.cook.suggested} min?`
          )
        ) {
          rc = true
        }
      }
      if (!rp && !rc) break
      res = await estimateRecipeTimes(recipeId, {
        use_client_estimate: true,
        estimate: lastEstimate,
        replace_prep_if_original: rp,
        replace_cook_if_original: rc,
      })
      applyEstimateResultToUi(recipeId, res)
    }
  } catch (e) {
    timeEstimateError.value = e instanceof Error ? e.message : 'Time estimate failed'
  } finally {
    timeEstimateLoading.value = false
  }
}

function runEstimateTimesForDetail() {
  const id = viewingRecipe.value?.id
  if (id == null) return
  void runEstimateTimesFlow(id)
}

async function onFormEstimateTimes() {
  const id = editingId.value
  if (id == null) return
  await runEstimateTimesFlow(id)
}

async function onFormGenerateTags() {
  const id = editingId.value
  if (id == null || tagGenerateLoading.value) return
  tagGenerateLoading.value = true
  error.value = ''
  try {
    const res = await postGenerateRecipeTags(id)
    mergeTimesIntoFormInitial(res.recipe)
    await loadList()
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Tag generation failed'
  } finally {
    tagGenerateLoading.value = false
  }
}

function closeDetailView() {
  viewingRecipe.value = null
  displayServings.value = 1
  healthScoreResult.value = null
  healthScoreError.value = ''
  timeEstimateError.value = ''
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
      image_processing_pending: recipe.image_processing_pending ?? false,
      would_cook_again: recipe.would_cook_again ?? null,
      ingredients: recipe.ingredients.map((ing) => ({
        amount: ing.amount != null ? String(ing.amount) : '',
        unit: ing.unit ?? '',
        name: ing.name ?? ing.ingredient ?? '',
        category: ing.category ?? null,
        section_id: ing.section_id ?? null,
        section_heading: ing.section_heading ?? null,
        original_text: ing.original_text ?? null,
        additional_info: ing.additional_info ?? (ing as any).additionalInfo ?? null,
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
      import_method: recipe.import_method ?? 'manual',
      prep_time_min: recipe.prep_time_min ?? null,
      cook_time_min: recipe.cook_time_min ?? null,
      prep_time_source: recipe.prep_time_source ?? null,
      cook_time_source: recipe.cook_time_source ?? null,
      prep_time_confidence: recipe.prep_time_confidence ?? null,
      cook_time_confidence: recipe.cook_time_confidence ?? null,
      tags: recipe.tags ?? [],
      image_urls_json: recipe.image_urls_json ?? null,
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
  cropPoints?: Array<{ x: number; y: number }>,
  options?: { estimateNutrition?: boolean; processImageLater?: boolean }
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
        if (options?.processImageLater) {
          formData.append('processImageLater', '1')
        } else if (cropPoints && cropPoints.length === 4) {
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

    // Keep the edit overlay open after saving.
    // We refresh data so the form reflects what was persisted.
    if (recipeId) {
      // Refresh form data without closing overlay
      startEdit(recipeId)
    }

    if (options?.estimateNutrition && recipeId) {
      await runNutritionEstimate(recipeId, { refreshList: true })
    } else {
      await loadList()
    }
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

onMounted(() => {
  loadList()
  document.addEventListener('click', hideCoverOverlay)
})

watch(
  () => props.favoritesOnly,
  async () => {
    await loadList()
    // Avoid showing stale detail/edit state from the previous listing filter.
    viewingRecipe.value = null
    editingId.value = null
    formInitial.value = null
    editingStatus.value = null
    showRecipeForm.value = false
    displayServings.value = 1
  }
)

onBeforeUnmount(() => {
  document.removeEventListener('click', hideCoverOverlay)
})
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
  flex-wrap: wrap;
  gap: var(--spacing-sm);
  align-items: center;
}

.recipes-header__import-group {
  display: flex;
  flex-wrap: wrap;
  gap: var(--spacing-sm);
  align-items: center;
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
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: var(--spacing-lg);
}

.recipe-card {
  background: var(--color-bg-elevated);
  border-radius: var(--radius-lg);
  overflow: visible;
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
  height: 300px;
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

.recipe-card__placeholder--pending {
  background: var(--color-bg-elevated);
  border: 1px dashed var(--color-border);
  padding: var(--spacing-sm);
}

.recipe-card__pending-label {
  font-size: 0.7rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--color-text-muted);
  max-width: 100%;
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
  padding-top: 1rem;
  padding-bottom: 1rem;
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

.recipe-card__source {
  position: relative;
  display: flex;
  align-items: center;
  gap: var(--spacing-xs);
}

.recipe-card__source-label {
  display: inline-flex;
}

.recipe-card__source-label>span {
  font-size: 0.65rem;
  line-height: 1.1rem;
  padding-left: 5px;
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

.recipe-ingredient-section {
  border: 1px solid transparent;
  border-radius: var(--radius-md);
  padding: var(--spacing-sm);
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xs);
  background: var(--color-bg-elevated);
  transition: border-color var(--transition-fast), box-shadow var(--transition-fast);
  margin-bottom: var(--spacing-md);
}

.recipe-ingredient-section--with-heading {
  border-color: var(--color-border);
  box-shadow: var(--shadow-subtle);
}

.recipe-ingredient-section__heading {
  font-size: 0.95rem;
  font-weight: 600;
  color: var(--color-text);
  padding-bottom: var(--spacing-xs);
  border-bottom: 1px solid var(--color-border);
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

.recipe-card__action-btn--favorite {
  color: var(--color-text-muted);
}

.recipe-card__action-btn--favorite:hover {
  background: rgba(255, 255, 255, 0.95);
}

.recipe-card__action-btn--favorite-active {
  color: var(--color-primary);
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

.empty-state__actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--spacing-sm);
  justify-content: center;
  align-items: center;
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

.recipe-detail-pending-hero {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  min-height: 200px;
  padding: var(--spacing-xl);
  margin: 0;
  border: none;
  border-radius: inherit;
  background: var(--color-bg-elevated);
  color: var(--color-text-muted);
  font-size: 1rem;
  text-align: center;
  cursor: pointer;
  transition: background var(--transition-fast), color var(--transition-fast);
}

.recipe-detail-pending-hero:hover {
  background: var(--color-bg-muted);
  color: var(--color-text);
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

.recipe-detail-tags {
  display: flex;
  flex-wrap: wrap;
  gap: var(--spacing-xs);
  margin: calc(var(--spacing-md) * -1) 0 var(--spacing-lg) 0;
}

.recipe-detail-tag-chip {
  display: inline-block;
  padding: 0.2rem 0.6rem;
  border-radius: 999px;
  font-size: 0.85rem;
  background: var(--color-bg-muted, rgba(0, 0, 0, 0.06));
  border: 1px solid var(--color-border);
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

.recipe-detail-times {
  display: flex;
  flex-wrap: wrap;
  gap: var(--spacing-sm);
  align-items: center;
}

.recipe-detail-times--rows {
  flex-direction: row;
  align-items: flex-start;
  gap: var(--spacing-md);
  min-width: min(100%, 360px);
}

.recipe-detail-times__block {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xs);
}

.recipe-detail-time-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--spacing-sm);
  font-size: 0.95rem;
}

.recipe-detail-time-label {
  font-weight: 600;
  color: var(--color-text-muted);
  min-width: 3.25rem;
}

.recipe-detail-time-value {
  font-weight: 700;
  color: var(--color-text);
  min-width: 4rem;
}

.recipe-detail-time-refresh-combined.btn--icon {
  flex-shrink: 0;
  margin-top: 2px;
  padding: var(--spacing-sm) var(--spacing-md);
  min-width: 2.5rem;
  line-height: 1;
  font-size: 1.25rem;
  align-self: center;
}

.recipe-detail-time-inline-error {
  margin: var(--spacing-xs) 0 0;
  font-size: 0.875rem;
  color: var(--color-danger, #c62828);
  width: 100%;
}

.recipe-detail-time-chip {
  font-size: 0.95rem;
  font-weight: 600;
  color: var(--color-text);
  padding: var(--spacing-xs) var(--spacing-md);
  background: var(--color-bg-elevated);
  border-radius: var(--radius-md);
  border: 1px solid var(--color-border);
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
  display: flex;
  align-items: baseline;
  flex-wrap: wrap;
  gap: 0.5rem 0.75rem;
  padding: var(--spacing-sm) 0;
  border-bottom: 1px solid var(--color-border);
}

.recipe-ingredient:last-child {
  border-bottom: none;
}

.recipe-ingredient-category {
  flex-shrink: 0;
  display: inline-flex;
  align-items: baseline;
  flex-wrap: wrap;
  gap: 0.25rem 0.35rem;
  max-width: 100%;
  font-size: 0.75rem;
  line-height: 1.3;
  color: var(--color-text-muted);
  background: var(--color-bg-muted);
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  border: 1px solid var(--color-border);
}

.recipe-ingredient-category__de {
  font-weight: 600;
  color: var(--color-text);
}

.recipe-ingredient-category__key {
  font-size: 0.65rem;
  font-weight: 600;
  letter-spacing: 0.02em;
  color: var(--color-text-muted);
  font-family: ui-monospace, monospace;
}

.recipe-ingredient-text {
  flex: 1;
  min-width: 0;
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

.recipe-health-section {
  margin-bottom: var(--spacing-md);
}

.recipe-health-disclaimer {
  margin: 0 0 var(--spacing-md);
  font-size: 0.9rem;
  color: var(--color-text-muted);
  line-height: 1.5;
}

.recipe-health-error {
  margin-bottom: var(--spacing-sm);
  padding: var(--spacing-sm) var(--spacing-md);
  border-radius: var(--radius-md);
  background: var(--color-error-bg);
  color: var(--color-error);
  font-size: 0.9rem;
}

.recipe-health-body {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
}

.recipe-health-score-row {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: var(--spacing-sm);
}

.recipe-health-score-value {
  font-size: 2.25rem;
  font-weight: 800;
  color: var(--color-primary);
  line-height: 1;
}

.recipe-health-score-max {
  font-size: 1.25rem;
  font-weight: 600;
  color: var(--color-text-muted);
}

.recipe-health-confidence {
  margin-left: auto;
  font-size: 0.9rem;
  color: var(--color-text-muted);
}

.recipe-health-summary {
  margin: 0;
  font-size: 1rem;
  line-height: 1.6;
  color: var(--color-text);
}

.recipe-health-columns {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: var(--spacing-lg);
}

.recipe-health-column-title {
  margin: 0 0 var(--spacing-xs);
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--color-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.recipe-health-list {
  margin: 0;
  padding-left: var(--spacing-lg);
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xs);
  color: var(--color-text);
  font-size: 0.95rem;
  line-height: 1.5;
}

.recipe-health-tips {
  padding-top: var(--spacing-sm);
  border-top: 1px solid var(--color-border);
}

.recipe-detail-health-cta {
  margin-top: var(--spacing-md);
  display: flex;
  gap: var(--spacing-sm);
  align-items: center;
}

.recipe-detail-health-cta__status {
  font-size: 0.9rem;
  color: var(--color-text-muted);
}

.recipe-health-nutrition-divider {
  height: 1px;
  margin: var(--spacing-xl) 0;
  background: var(--color-border);
}

.recipe-nutrition {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: var(--spacing-lg);
}

.recipe-detail-nutrition-cta {
  margin-top: var(--spacing-md);
  display: flex;
  gap: var(--spacing-sm);
  align-items: center;
}

.recipe-detail-nutrition-cta__status {
  font-size: 0.9rem;
  color: var(--color-text-muted);
}

.recipe-detail-history {
  margin-top: var(--spacing-md);
  padding: var(--spacing-md);
  border-radius: var(--radius-lg);
  background: var(--color-bg-elevated);
  border: 1px solid var(--color-border);
}

.recipe-detail-history__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--spacing-md);
}

.recipe-detail-history__header h2 {
  margin: 0;
  font-size: 1.25rem;
}

.recipe-detail-history__summary {
  margin: var(--spacing-sm) 0 0;
  font-size: 0.95rem;
  color: var(--color-text-muted);
}

.recipe-detail-history__list {
  margin: var(--spacing-sm) 0 0;
  padding-left: var(--spacing-lg);
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xs);
}

.recipe-cover-overlay {
  position: fixed;
  z-index: 300;
}

.recipe-cover-overlay__frame {
  background: var(--color-bg);
  border-radius: var(--radius-xl);
  box-shadow: var(--shadow-xl);
  border: 1px solid var(--color-border);
  padding: var(--spacing-sm);
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xs);
}

.recipe-cover-overlay__frame img {
  width: 220px;
  height: 260px;
  object-fit: cover;
  border-radius: var(--radius-lg);
}

.recipe-cover-overlay__title {
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--color-text);
  max-width: 220px;
  text-align: center;
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

/* Would Cook Again prompt */
.would-cook-again-overlay {
  position: fixed;
  inset: 0;
  z-index: 250;
  background: var(--color-bg-overlay);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--spacing-lg);
  backdrop-filter: blur(4px);
}

.would-cook-again-panel {
  background: var(--color-bg-elevated);
  border-radius: var(--radius-xl);
  box-shadow: var(--shadow-xl);
  max-width: 520px;
  width: 100%;
  padding: var(--spacing-xl);
  border: 1px solid var(--color-border);
}

.would-cook-again-panel h3 {
  margin: 0 0 var(--spacing-md) 0;
  font-size: 1.25rem;
  font-weight: 800;
  color: var(--color-text);
}

.would-cook-again-subtitle {
  margin: 0 0 var(--spacing-lg) 0;
  color: var(--color-text-muted);
}

.would-cook-again-actions {
  display: flex;
  gap: var(--spacing-sm);
  flex-wrap: wrap;
}

.would-cook-again-actions .btn {
  flex: 1;
  min-width: 120px;
}

.would-cook-again-close {
  margin-top: var(--spacing-lg);
}

/* Note/Paper blocks (recipe detail) */
.note-block {
  background: var(--color-bg-elevated);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-xl);
  box-shadow: var(--shadow-sm);
  padding: var(--spacing-xl);
  position: relative;
  overflow: hidden;
  transform-origin: center;
}

.note-block::before {
  content: '';
  position: absolute;
  inset: -20px;
  background:
    radial-gradient(circle at 10% 20%, rgba(0, 0, 0, 0.06), transparent 35%),
    radial-gradient(circle at 80% 10%, rgba(0, 0, 0, 0.05), transparent 40%),
    radial-gradient(circle at 30% 90%, rgba(0, 0, 0, 0.04), transparent 45%),
    repeating-linear-gradient(
      25deg,
      rgba(0, 0, 0, 0.03),
      rgba(0, 0, 0, 0.03) 2px,
      transparent 2px,
      transparent 7px
    );
  opacity: 0.35;
  pointer-events: none;
  mix-blend-mode: multiply;
}

.note-block--image {
  padding: 0;
  transform: rotate(-0.6deg);
}

.note-block--header {
  transform: rotate(0.35deg);
  padding: 0 var(--spacing-xl);
  max-width: 900px;
  margin: 0 auto;
}

.note-block--description {
  transform: rotate(-0.2deg);
}

.note-block--steps {
  transform: rotate(0.2deg);
}

.note-block--ingredients {
  transform: rotate(-0.15deg);
}

.note-block--tips {
  transform: rotate(0.1deg);
}

.note-block--nutrition {
  transform: rotate(-0.1deg);
}

.note-block--history {
  transform: rotate(0.2deg);
}

.note-block__title,
.recipe-detail-section-title {
  position: relative;
  z-index: 1;
}

.note-block__content {
  position: relative;
  z-index: 1;
  margin: 0;
  color: var(--color-text-muted);
  white-space: pre-wrap;
  line-height: 1.6;
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

  .recipe-nutrition {
    grid-template-columns: 1fr;
  }
}
</style>
