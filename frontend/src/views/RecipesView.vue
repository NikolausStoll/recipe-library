<template>
  <div class="recipes-view">
    <template v-if="!isDetailRoute">
    <header class="recipes-header page-header">
      <h1 class="recipes-title h2">{{ favoritesOnly ? 'Favoriten' : 'Rezepte' }}</h1>
      <router-link to="/add" class="btn btn--primary recipes-header__add-desktop">Rezept hinzufügen</router-link>
    </header>

    <div class="recipes-toolbar">
      <div class="search-field">
        <svg class="search-field__icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <circle cx="11" cy="11" r="8" stroke="currentColor" stroke-width="2" />
          <path d="M21 21L16.65 16.65" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
        </svg>
        <input
          v-model="searchQuery"
          type="search"
          class="search-field__input"
          placeholder="Rezepte, Zutaten, Tags suchen…"
          aria-label="Rezepte suchen"
        />
      </div>
      <div class="recipes-toolbar__filters">
        <div class="chip-row recipes-filter-chips" role="group" aria-label="Rezepte filtern">
          <button
            v-for="chip in filterChips"
            :key="chip.id"
            type="button"
            class="chip"
            :class="{ 'chip--selected': activeFilter === chip.id }"
            @click="activeFilter = chip.id"
          >
            {{ chip.label }}
          </button>
        </div>
        <div class="recipes-toolbar__meta">
          <span class="meta-text recipes-toolbar__count" aria-live="polite">
            {{ filteredAndSortedRecipes.length }} Rezept{{ filteredAndSortedRecipes.length !== 1 ? 'e' : '' }}
          </span>
          <label class="recipes-sort">
            <span class="recipes-sort__visible meta-text">{{ sortByLabel }}</span>
            <select v-model="sortBy" class="recipes-sort__select" aria-label="Sortieren nach">
              <option value="updated-desc">Zuletzt aktualisiert</option>
              <option value="updated-asc">Älteste Aktualisierung</option>
              <option value="title-asc">Name (A–Z)</option>
              <option value="title-desc">Name (Z–A)</option>
            </select>
          </label>
        </div>
      </div>
    </div>

    <p v-if="error" class="error-message">{{ error }}</p>
    <p v-if="loading && !recipes.length" class="loading-message">Rezepte werden geladen…</p>

    <!-- Recipe Grid -->
    <div v-if="!loading || recipes.length" class="recipe-grid recipe-list">
      <article
        v-for="recipe in filteredAndSortedRecipes"
        :key="recipe.id"
        class="recipe-card"
        @click="openRecipeDetail(recipe.id)"
      >
        <div class="recipe-card__thumb">
          <img
            v-if="getRecipeCardImageUrl(recipe)"
            :src="getRecipeCardImageUrl(recipe)!"
            :alt="recipe.title"
            loading="lazy"
          />
          <div
            v-else-if="recipe.image_processing_pending"
            class="recipe-card__placeholder recipe-card__placeholder--pending"
            title="Bild noch nicht verarbeitet"
          >
            <span class="recipe-card__pending-label">Ausstehend</span>
          </div>
          <div v-else class="recipe-card__placeholder" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none">
              <path d="M12 2L2 7L12 12L22 7L12 2Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              <path d="M2 17L12 22L22 17" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              <path d="M2 12L12 17L22 12" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </div>
        </div>
        <div class="recipe-card__body">
          <h3 class="recipe-card__title">{{ recipe.title }}</h3>
          <p v-if="formatRecipeCardMeta(recipe)" class="recipe-card__meta-line meta-text">{{ formatRecipeCardMeta(recipe) }}</p>
          <p v-if="recipeCardDescription(recipe)" class="recipe-card__desc meta-text">{{ recipeCardDescription(recipe) }}</p>
          <span v-if="recipeNeedsReview(recipe.status)" class="recipe-card__review status-chip-review">Prüfen</span>
        </div>
        <div class="recipe-card__actions">
          <button
            type="button"
            class="recipe-card__action-btn recipe-card__action-btn--favorite"
            :class="{ 'recipe-card__action-btn--favorite-active': recipe.favorite }"
            :title="recipe.favorite ? 'Favorit entfernen' : 'Als Favorit speichern'"
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
            title="Rezept bearbeiten"
            @click.stop="startEdit(recipe.id)"
          >
            <svg viewBox="0 0 24 24" fill="none">
              <path d="M11 4H4C3.46957 4 2.96086 4.21071 2.58579 4.58579C2.21071 4.96086 2 5.46957 2 6V20C2 20.5304 2.21071 21.0391 2.58579 21.4142C2.96086 21.7893 3.46957 22 4 22H18C18.5304 22 19.0391 21.7893 19.4142 21.4142C19.7893 21.0391 20 20.5304 20 20V13" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              <path d="M18.5 2.50001C18.8978 2.10219 19.4374 1.87869 20 1.87869C20.5626 1.87869 21.1022 2.10219 21.5 2.50001C21.8978 2.89784 22.1213 3.4374 22.1213 4.00001C22.1213 4.56262 21.8978 5.10219 21.5 5.50001L12 15L8 16L9 12L18.5 2.50001Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </button>
        </div>
      </article>
    </div>

    <div v-if="!loading && recipes.length && !filteredAndSortedRecipes.length" class="empty-state">
      <svg viewBox="0 0 24 24" fill="none">
        <circle cx="11" cy="11" r="8" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        <path d="M21 21L16.65 16.65" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
      <h3>Keine passenden Rezepte</h3>
      <p>Versuche andere Suchbegriffe</p>
    </div>

    <div v-if="!loading && !recipes.length" class="empty-state">
      <svg viewBox="0 0 24 24" fill="none">
        <path d="M12 2L2 7L12 12L22 7L12 2Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        <path d="M2 17L12 22L22 17" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        <path d="M2 12L12 17L22 12" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
      <h3>Noch keine Rezepte</h3>
      <p>Füge ein Rezept per Foto, URL oder manueller Eingabe hinzu.</p>
    </div>
    </template>

    <!-- Cooking mode -->
    <article v-else-if="isCookingMode && viewingRecipe" class="cooking-mode">
      <header class="cooking-mode__top">
        <button type="button" class="cooking-mode__exit" @click="exitCookingMode">Beenden</button>
        <span class="cooking-mode__label meta-text">Kochmodus</span>
      </header>
      <div class="cooking-mode__layout">
        <div class="cooking-mode__main">
          <p class="cooking-mode__progress meta-text">
            Schritt {{ cookingStepIndex + 1 }} von {{ cookingSteps.length }}
          </p>
          <p class="cooking-mode__text">{{ cookingSteps[cookingStepIndex]?.instruction }}</p>
          <div class="cooking-mode__nav">
            <button type="button" class="btn btn--secondary" :disabled="cookingStepIndex <= 0" @click="cookingStepIndex--">
              Zurück
            </button>
            <button
              type="button"
              class="btn btn--primary"
              :disabled="isFinalCookingStep && hasCookedToday(viewingRecipe.id)"
              @click="advanceCookingStep"
            >
              {{ isFinalCookingStep ? 'Heute gekocht' : 'Weiter' }}
            </button>
          </div>
        </div>
        <aside class="cooking-mode__aside" aria-label="Zutaten">
          <h2 class="cooking-mode__aside-title">Zutaten</h2>
          <div class="cooking-mode__ingredient-groups">
            <section
              v-for="(section, sidx) in cookingIngredientSections"
              :key="`cook-d-${section.key}-${sidx}`"
              class="recipe-ingredient-group"
            >
              <h3 v-if="section.heading" class="recipe-ingredient-group__heading">{{ section.heading }}</h3>
              <ul class="recipe-ingredients-list recipe-ingredients-list--panel cooking-mode__ingredient-list">
                <li
                  v-for="(line, idx) in section.items"
                  :key="`cook-d-${sidx}-${idx}`"
                  class="recipe-ingredient"
                >
                  <span class="recipe-ingredient-text">{{ line.text }}</span>
                </li>
              </ul>
            </section>
          </div>
        </aside>
      </div>
      <details class="cooking-mode__ingredients-mobile" open>
        <summary>Alle Zutaten</summary>
        <div class="cooking-mode__ingredient-groups">
          <section
            v-for="(section, sidx) in cookingIngredientSections"
            :key="`cook-m-${section.key}-${sidx}`"
            class="recipe-ingredient-group"
          >
            <h3 v-if="section.heading" class="recipe-ingredient-group__heading">{{ section.heading }}</h3>
            <ul class="recipe-ingredients-list recipe-ingredients-list--panel cooking-mode__ingredient-list">
              <li
                v-for="(line, idx) in section.items"
                :key="`cook-m-${sidx}-${idx}`"
                class="recipe-ingredient"
              >
                <span class="recipe-ingredient-text">{{ line.text }}</span>
              </li>
            </ul>
          </section>
        </div>
      </details>
    </article>

    <!-- Recipe detail (full page) -->
    <p v-else-if="!viewingRecipe" class="loading-message">Rezept wird geladen…</p>
    <article v-else class="recipe-detail-page">
      <header class="recipe-detail-nav">
        <button
          type="button"
          class="recipe-detail-nav__btn recipe-detail-nav__btn--back"
          :aria-label="`Zurück zu ${favoritesOnly ? 'Favoriten' : 'Rezepten'}`"
          @click="closeDetailView"
        >
          <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M15 18L9 12L15 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
          <span class="recipe-detail-nav__back-label">Zurück zu {{ favoritesOnly ? 'Favoriten' : 'Rezepten' }}</span>
        </button>
        <div class="recipe-detail-nav__menu-wrap">
          <button
            type="button"
            class="recipe-detail-nav__btn"
            aria-label="Mehr Aktionen"
            aria-haspopup="true"
            :aria-expanded="detailMenuOpen"
            @click.stop="detailMenuOpen = !detailMenuOpen"
          >
            <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <circle cx="12" cy="6" r="1.5" fill="currentColor"/>
              <circle cx="12" cy="12" r="1.5" fill="currentColor"/>
              <circle cx="12" cy="18" r="1.5" fill="currentColor"/>
            </svg>
          </button>
          <div v-if="detailMenuOpen" class="recipe-detail-nav__menu" @click.stop>
            <button type="button" class="recipe-detail-nav__menu-edit-non-desktop" @click="detailMenuOpen = false; editFromDetail()">
              Rezept bearbeiten
            </button>
            <button
              v-if="hasRecipeUrlSource(viewingRecipe)"
              type="button"
              @click="openOriginalFromMenu"
            >
              Original öffnen
            </button>
            <button
              type="button"
              :disabled="timeEstimateLoading"
              @click="detailMenuOpen = false; runEstimateTimesForDetail()"
            >
              Zeiten neu schätzen
            </button>
            <button
              v-if="recipeNeedsReview(viewingRecipe.status)"
              type="button"
              @click="detailMenuOpen = false; editFromDetail()"
            >
              Rezept prüfen
            </button>
            <button type="button" class="recipe-detail-nav__menu-danger" @click="deleteFromDetail">
              Rezept löschen
            </button>
          </div>
        </div>
      </header>

      <div class="recipe-detail-layout">
        <div
          v-if="
            (viewingRecipe.image_path && viewingRecipe.image_processing_pending) ||
            getRecipeHeroImageUrl(viewingRecipe)
          "
          class="recipe-detail-hero recipe-detail-hero--mobile"
        >
          <button
            v-if="viewingRecipe.image_path && viewingRecipe.image_processing_pending"
            type="button"
            class="recipe-detail-pending-hero"
            @click.stop="startEdit(viewingRecipe.id); closeDetailView()"
          >
            <span class="recipe-detail-pending-hero__text">Bild noch nicht verarbeitet — zum Zuschneiden und Optimieren bitte bearbeiten</span>
          </button>
          <img
            v-else-if="getRecipeHeroImageUrl(viewingRecipe)"
            :src="getRecipeHeroImageUrl(viewingRecipe)!"
            :alt="viewingRecipe.title"
          />
          <button
            type="button"
            class="recipe-detail-favorite-star"
            :aria-label="viewingRecipe.favorite ? 'Favorit entfernen' : 'Zu Favoriten hinzufügen'"
            :title="viewingRecipe.favorite ? 'Favorit entfernen' : 'Zu Favoriten hinzufügen'"
            :class="{ 'recipe-detail-favorite-star--active': viewingRecipe.favorite }"
            @click.stop="toggleFavorite(viewingRecipe.id)"
          >
            <span aria-hidden="true">{{ viewingRecipe.favorite ? '★' : '☆' }}</span>
          </button>
        </div>

        <div class="recipe-detail-main-col">
        <div class="recipe-detail-identity">
        <div v-if="recipeNeedsReview(viewingRecipe.status)" class="recipe-detail-review-inline">
          <span class="status-chip-review">Prüfen</span>
          <button type="button" class="recipe-detail-review-inline__link" @click="editFromDetail">Prüfen</button>
        </div>

        <h1 class="recipe-detail-title">{{ viewingRecipe.title }}</h1>
        <p v-if="viewingRecipe.subtitle" class="recipe-detail-subtitle">{{ viewingRecipe.subtitle }}</p>
        <p v-else-if="viewingRecipe.description && !viewingRecipe.subtitle" class="recipe-detail-subtitle">
          {{ viewingRecipe.description }}
        </p>

        <!-- Mobile: simple text metadata (no icons, no dividers) -->
        <div
          v-if="detailMetaSource || detailMetaServings || detailMetaPrep || detailMetaCook"
          class="recipe-detail-meta-simple"
        >
          <p v-if="detailMetaSource || detailMetaServings" class="recipe-detail-meta-simple__line">
            <span v-if="detailMetaSource">{{ detailMetaSource }}</span>
            <span v-if="detailMetaSource && detailMetaServings" aria-hidden="true"> · </span>
            <span v-if="detailMetaServings">{{ detailMetaServings }} Portionen</span>
          </p>
          <p v-if="detailMetaPrep || detailMetaCook" class="recipe-detail-meta-simple__line">
            <span v-if="detailMetaPrep">{{ detailMetaPrep.value }} Vorb.</span>
            <span v-if="detailMetaPrep && detailMetaCook" aria-hidden="true"> · </span>
            <span v-if="detailMetaCook">{{ detailMetaCook.value }} Garzeit</span>
          </p>
        </div>

        <!-- Desktop/tablet: structured icon metadata row -->
        <div
          v-if="detailMetaSource || detailMetaServings || detailMetaPrep || detailMetaCook"
          class="recipe-detail-meta"
        >
          <div class="recipe-detail-meta__item recipe-detail-meta__item--source">
            <svg v-if="detailMetaSourceKind === 'book'" class="recipe-detail-meta__icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M4 19.5C4 18.837 4.26339 18.2011 4.73223 17.7322C5.20107 17.2634 5.83696 17 6.5 17H20" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"/>
              <path d="M6.5 2H20V22H6.5C5.83696 22 5.20107 21.7366 4.73223 21.2678C4.26339 20.7989 4 20.163 4 19.5V4.5C4 3.83696 4.26339 3.20107 4.73223 2.73223C5.20107 2.26339 5.83696 2 6.5 2Z" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
            <svg v-else-if="detailMetaSourceKind === 'website'" class="recipe-detail-meta__icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="1.75"/>
              <path d="M3 12H21M12 3C14.5 6.5 15.5 9 15.5 12C15.5 15 14.5 17.5 12 21C9.5 17.5 8.5 15 8.5 12C8.5 9 9.5 6.5 12 3Z" stroke="currentColor" stroke-width="1.75"/>
            </svg>
            <svg v-else class="recipe-detail-meta__icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M12 6V12L16 14" stroke="currentColor" stroke-width="1.75" stroke-linecap="round"/>
              <circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="1.75"/>
            </svg>
            <span class="recipe-detail-meta__source">{{ detailMetaSource }}</span>
          </div>
          <template v-if="detailMetaServings">
            <span class="recipe-detail-meta__sep" aria-hidden="true" />
            <div class="recipe-detail-meta__item recipe-detail-meta__item--servings">
              <svg class="recipe-detail-meta__icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <circle cx="9" cy="8" r="3" stroke="currentColor" stroke-width="1.75"/>
                <circle cx="16" cy="10" r="2.5" stroke="currentColor" stroke-width="1.75"/>
                <path d="M4 20C4 16.5 6.5 14 9 14C11 14 12.2 14.8 13 16M13 16C13.8 14.8 15 14 16.5 14C19 14 21 16 21 19" stroke="currentColor" stroke-width="1.75" stroke-linecap="round"/>
              </svg>
              <span class="recipe-detail-meta__servings">{{ detailMetaServings }}</span>
            </div>
          </template>
          <template v-if="detailMetaPrep">
            <span class="recipe-detail-meta__sep" aria-hidden="true" />
            <div class="recipe-detail-meta__item recipe-detail-meta__item--time">
              <svg class="recipe-detail-meta__icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <circle cx="12" cy="13" r="8" stroke="currentColor" stroke-width="1.75"/>
                <path d="M12 9V13L14.5 14.5" stroke="currentColor" stroke-width="1.75" stroke-linecap="round"/>
                <path d="M10 3H14" stroke="currentColor" stroke-width="1.75" stroke-linecap="round"/>
              </svg>
              <div class="recipe-detail-meta__time-stack">
                <span class="recipe-detail-meta__time-value">{{ detailMetaPrep.value }}</span>
                <span class="recipe-detail-meta__time-label">{{ detailMetaPrep.label }}</span>
              </div>
            </div>
          </template>
          <template v-if="detailMetaCook">
            <span class="recipe-detail-meta__sep" aria-hidden="true" />
            <div class="recipe-detail-meta__item recipe-detail-meta__item--time">
              <div class="recipe-detail-meta__time-stack">
                <span class="recipe-detail-meta__time-value">{{ detailMetaCook.value }}</span>
                <span class="recipe-detail-meta__time-label">{{ detailMetaCook.label }}</span>
              </div>
            </div>
          </template>
          <button
            type="button"
            class="recipe-detail-meta__refresh"
            :disabled="timeEstimateLoading"
            title="Zeiten neu schätzen"
            aria-label="Zeiten neu schätzen"
            @click="runEstimateTimesForDetail"
          >
            ↻
          </button>
        </div>
        <p v-if="timeEstimateError" class="recipe-detail-time-inline-error">{{ timeEstimateError }}</p>

        <div class="recipe-detail-actions">
          <button type="button" class="btn btn--primary recipe-detail-action recipe-detail-action--primary" @click="startCookingMode">
            Kochen
          </button>
          <button
            type="button"
            class="recipe-detail-action recipe-detail-action--secondary recipe-detail-action--edit-desktop"
            @click="editFromDetail"
          >
            Bearbeiten
          </button>
        </div>

        </div>

        <div class="recipe-detail-main">
          <section v-if="viewingRecipe.description && viewingRecipe.subtitle" class="recipe-doc-section">
            <p class="recipe-doc-section__text">{{ viewingRecipe.description }}</p>
          </section>

          <section id="recipe-section-steps" class="recipe-doc-section">
            <h2 class="recipe-doc-section__title">Zubereitung</h2>
            <ol class="recipe-steps-list">
              <li v-for="(step, idx) in viewingRecipe.recipe_steps" :key="idx" class="recipe-step">
                <span class="recipe-step-number">{{ idx + 1 }}.</span>
                <p class="recipe-step-text">{{ step.instruction }}</p>
              </li>
            </ol>
          </section>

          <section v-if="viewingRecipe.tips?.length" class="recipe-doc-section">
            <h2 class="recipe-doc-section__title">Tipps</h2>
            <ul class="recipe-tips-list">
              <li v-for="(tip, idx) in viewingRecipe.tips" :key="idx">{{ tip }}</li>
            </ul>
          </section>

          <section id="recipe-section-health" class="recipe-doc-section">
            <div class="recipe-health-section">
              <div class="recipe-doc-section__head">
                <h2 class="recipe-doc-section__title">Gesundheitscheck</h2>
                <button
                  v-if="healthScoreResult && healthScoreResult.estimate.healthScore != null"
                  type="button"
                  class="recipe-detail-section-refresh"
                  :disabled="healthScoreLoading"
                  title="Gesundheitscheck neu berechnen"
                  aria-label="Gesundheitscheck neu berechnen"
                  @click="requestDetailHealthScore"
                >
                  ↻
                </button>
              </div>

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
                    Sicherheit: {{ Math.round(healthScoreResult.estimate.confidence * 100) }}%
                  </span>
                </div>
                <p v-if="healthScoreResult.estimate.summary" class="recipe-health-summary">
                  {{ healthScoreResult.estimate.summary }}
                </p>
                <div class="recipe-health-columns">
                  <div v-if="healthScoreResult.estimate.positives?.length" class="recipe-health-column">
                    <h3 class="recipe-health-column-title">Positiv</h3>
                    <ul class="recipe-health-list">
                      <li v-for="(p, i) in healthScoreResult.estimate.positives" :key="'p-' + i">{{ p }}</li>
                    </ul>
                  </div>
                  <div v-if="healthScoreResult.estimate.concerns?.length" class="recipe-health-column">
                    <h3 class="recipe-health-column-title">Hinweise</h3>
                    <ul class="recipe-health-list">
                      <li v-for="(c, i) in healthScoreResult.estimate.concerns" :key="'c-' + i">{{ c }}</li>
                    </ul>
                  </div>
                </div>
                <div v-if="healthScoreResult.estimate.improvementTips?.length" class="recipe-health-tips">
                  <h3 class="recipe-health-column-title">Tipps</h3>
                  <ul class="recipe-health-list">
                    <li v-for="(t, i) in healthScoreResult.estimate.improvementTips" :key="'t-' + i">{{ t }}</li>
                  </ul>
                </div>
              </div>

              <div v-if="!(healthScoreResult && healthScoreResult.estimate.healthScore != null)" class="recipe-detail-estimate-cta">
                <button
                  type="button"
                  class="btn btn--secondary btn--small"
                  :disabled="healthScoreLoading"
                  @click="requestDetailHealthScore"
                >
                  {{ healthScoreLoading ? 'Wird berechnet…' : 'Gesundheitscheck holen' }}
                </button>
              </div>
            </div>
          </section>

          <section id="recipe-section-nutrition" class="recipe-doc-section">
            <div class="recipe-doc-section__head">
              <h2 class="recipe-doc-section__title">Nährwerte</h2>
              <button
                v-if="hasNutrition"
                type="button"
                class="recipe-detail-section-refresh"
                :disabled="nutritionLoading"
                title="Nährwerte neu schätzen"
                aria-label="Nährwerte neu schätzen"
                @click="requestDetailNutritionEstimate"
              >
                ↻
              </button>
            </div>
            <div v-if="hasNutrition" class="recipe-nutrition">
              <div v-if="nutritionPerServing.kcal != null" class="recipe-nutrition-item">
                <span class="recipe-nutrition-label">Kalorien pro Portion</span>
                <span class="recipe-nutrition-value">{{ nutritionPerServing.kcal }} kcal</span>
              </div>
              <div v-if="nutritionPerServing.protein != null" class="recipe-nutrition-item">
                <span class="recipe-nutrition-label">Eiweiß pro Portion</span>
                <span class="recipe-nutrition-value">{{ nutritionPerServing.protein }} g</span>
              </div>
              <div v-if="nutritionPerServing.carbs != null" class="recipe-nutrition-item">
                <span class="recipe-nutrition-label">Kohlenhydrate pro Portion</span>
                <span class="recipe-nutrition-value">{{ nutritionPerServing.carbs }} g</span>
              </div>
              <div v-if="nutritionPerServing.fat != null" class="recipe-nutrition-item">
                <span class="recipe-nutrition-label">Fett pro Portion</span>
                <span class="recipe-nutrition-value">{{ nutritionPerServing.fat }} g</span>
              </div>
            </div>

            <div v-if="!hasNutrition" class="recipe-detail-estimate-cta">
              <button
                type="button"
                class="btn btn--secondary btn--small"
                @click="requestDetailNutritionEstimate"
                :disabled="nutritionLoading"
              >
                {{ nutritionLoading ? 'Nährwerte werden geschätzt…' : 'Nährwerte schätzen' }}
              </button>
            </div>
          </section>

          <section id="recipe-section-source" class="recipe-doc-section">
            <h2 class="recipe-doc-section__title">Quelle</h2>
            <p
              v-if="!hasRecipeBookSource(viewingRecipe) && !hasRecipeUrlSource(viewingRecipe)"
              class="recipe-detail-source-type meta-text"
            >
              {{ formatRecipeSourceMeta(viewingRecipe) }}
            </p>
            <div v-if="hasRecipeBookSource(viewingRecipe)" class="recipe-detail-book-source">
              <img
                v-if="viewingRecipe.source_image_path && !viewingRecipe.source_image_processing_pending"
                :src="viewingRecipe.source_image_path"
                :alt="viewingRecipe.source_name ?? 'Book cover'"
                class="recipe-detail-book-source__cover"
              />
              <div class="recipe-detail-book-source__text">
                <p v-if="viewingRecipe.source_name" class="recipe-detail-book-source__name">
                  {{ viewingRecipe.source_name }}
                </p>
                <p v-if="viewingRecipe.source_subtitle" class="recipe-detail-book-source__meta">
                  {{ viewingRecipe.source_subtitle }}
                </p>
                <p
                  v-if="viewingRecipe.source_author || viewingRecipe.source_year"
                  class="recipe-detail-book-source__meta"
                >
                  <span v-if="viewingRecipe.source_author">{{ viewingRecipe.source_author }}</span
                  ><span v-if="viewingRecipe.source_author && viewingRecipe.source_year"> · </span
                  ><span v-if="viewingRecipe.source_year">{{ viewingRecipe.source_year }}</span>
                </p>
                <p v-if="viewingRecipe.source_page" class="recipe-detail-book-source__meta">
                  Seite {{ viewingRecipe.source_page }}
                </p>
              </div>
            </div>
            <a
              v-else-if="hasRecipeUrlSource(viewingRecipe)"
              :href="viewingRecipe.source_url!"
              class="recipe-detail-source-link"
              target="_blank"
              rel="noopener noreferrer"
            >
              {{ detailMetaSource }}
            </a>
          </section>

          <section id="recipe-section-history" class="recipe-doc-section recipe-doc-section--history">
            <div class="recipe-doc-section__head recipe-detail-history__head">
              <h2 class="recipe-doc-section__title">Kochverlauf</h2>
              <button
                type="button"
                class="recipe-detail-history__mark btn btn--secondary btn--small"
                :disabled="hasCookedToday(viewingRecipe.id)"
                @click="markCookedToday(viewingRecipe.id)"
              >
                Heute gekocht
              </button>
            </div>
            <div class="recipe-detail-history">
              <p v-if="(recipeHistories[viewingRecipe.id] ?? []).length === 0" class="recipe-detail-history__empty meta-text">
                Noch nicht gekocht
              </p>
              <template v-else>
                <p class="recipe-detail-history__latest">
                  Zuletzt gekocht: {{ formatGermanDate(recipeHistories[viewingRecipe.id]?.[0]) }}
                </p>
                <p v-if="(recipeHistories[viewingRecipe.id] ?? []).length > 1" class="recipe-detail-history__previous meta-text">
                  Vorher: {{ (recipeHistories[viewingRecipe.id] ?? []).slice(1, 4).map(formatGermanDate).join(' · ') }}
                </p>
              </template>
            </div>
          </section>
        </div>
        </div>

        <aside class="recipe-detail-side-panel" aria-label="Recipe image and ingredients">
          <div
            v-if="
              (viewingRecipe.image_path && viewingRecipe.image_processing_pending) ||
              getRecipeHeroImageUrl(viewingRecipe)
            "
            class="recipe-detail-hero recipe-detail-hero--desktop"
          >
            <button
              v-if="viewingRecipe.image_path && viewingRecipe.image_processing_pending"
              type="button"
              class="recipe-detail-pending-hero"
              @click.stop="startEdit(viewingRecipe.id); closeDetailView()"
            >
            <span class="recipe-detail-pending-hero__text">Bild noch nicht verarbeitet — zum Zuschneiden und Optimieren bitte bearbeiten</span>
            </button>
            <img
              v-else-if="getRecipeHeroImageUrl(viewingRecipe)"
              :src="getRecipeHeroImageUrl(viewingRecipe)!"
              :alt="viewingRecipe.title"
            />
            <button
              type="button"
              class="recipe-detail-favorite-star"
              :aria-label="viewingRecipe.favorite ? 'Favorit entfernen' : 'Zu Favoriten hinzufügen'"
              :title="viewingRecipe.favorite ? 'Favorit entfernen' : 'Zu Favoriten hinzufügen'"
              :class="{ 'recipe-detail-favorite-star--active': viewingRecipe.favorite }"
              @click.stop="toggleFavorite(viewingRecipe.id)"
            >
              <span aria-hidden="true">{{ viewingRecipe.favorite ? '★' : '☆' }}</span>
            </button>
          </div>

          <div id="recipe-section-ingredients" class="recipe-detail-ingredients-panel">
            <div class="recipe-detail-ingredients-panel__head">
              <h2 class="recipe-detail-ingredients-panel__title">Zutaten</h2>
              <div v-if="viewingRecipe.servings" class="recipe-detail-servings">
                <button type="button" class="servings-btn" @click="adjustServings(-1)" :disabled="displayServings <= 1">−</button>
                <span class="servings-value">{{ displayServings }}</span>
                <button type="button" class="servings-btn" @click="adjustServings(1)">+</button>
                <span class="servings-label">Portionen</span>
              </div>
            </div>
            <div class="recipe-detail-ingredients-scroll">
              <div
                v-for="(section, sidx) in ingredientSections"
                :key="sidx"
                class="recipe-ingredient-group"
              >
                <h3 v-if="section.heading" class="recipe-ingredient-group__heading">{{ section.heading }}</h3>
                <ul class="recipe-ingredients-list recipe-ingredients-list--panel">
                  <li v-for="(line, idx) in section.items" :key="`${sidx}-${idx}`" class="recipe-ingredient">
                    <span class="recipe-ingredient-text">{{ line.text }}</span>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </aside>
      </div>
    </article>

    <!-- Would cook again prompt (shown once after first "Mark cooked today") -->
    <div
      v-if="showWouldCookAgainPrompt"
      class="would-cook-again-overlay"
      @click.self="showWouldCookAgainPrompt = false"
    >
      <div class="would-cook-again-panel">
        <h3>Würdest du das wieder kochen?</h3>
        <p class="would-cook-again-subtitle">Wähle eine Option. Du kannst sie später in „Bearbeiten“ ändern.</p>
        <div class="would-cook-again-actions">
          <button type="button" class="btn btn--primary" @click="setWouldCookAgain('yes')">Ja</button>
          <button type="button" class="btn btn--secondary" @click="setWouldCookAgain('maybe')">Vielleicht</button>
          <button type="button" class="btn btn--secondary" @click="setWouldCookAgain('no')">Nein</button>
        </div>
        <div class="would-cook-again-close">
          <button type="button" class="btn btn--secondary btn--block" @click="showWouldCookAgainPrompt = false">
            Später
          </button>
        </div>
      </div>
    </div>

    <!-- Edit Overlay -->
    <Teleport to="body">
      <div v-if="showRecipeForm" class="app-modal-overlay recipe-edit-overlay" @click.self="closeEdit">
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
    </Teleport>
  </div>

  <div
    v-if="coverOverlay.visible"
    class="recipe-cover-overlay"
    :style="{ top: coverOverlay.y + 'px', left: coverOverlay.x + 'px' }"
    @click.stop
  >
    <div class="recipe-cover-overlay__frame">
      <img :src="coverOverlay.src ?? undefined" :alt="coverOverlay.title ?? 'Book cover'" />
      <div v-if="coverOverlay.title" class="recipe-cover-overlay__title">
        {{ coverOverlay.title }}
      </div>
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
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount, watch, nextTick } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import Fuse from 'fuse.js'
import type { IFuseOptions } from 'fuse.js'
import RecipeFormMultiStep from '../components/RecipeFormMultiStep.vue'
import RecipeImportOverlay from '../components/RecipeImportOverlayUnified.vue'
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
import { recipeNeedsReview } from '../utils/recipeStatusLabel'
import { formatRecipeCardMeta } from '../utils/recipeCardMeta'
import { formatRecipeSourceMeta, isManagedBookSource, isRecipeWebsiteSource } from '../utils/recipeSourceLabel'
import {
  formatRecipeDetailSourceMeta,
  formatDetailServingsCount,
  formatDetailPrepMeta,
  formatDetailCookMeta,
  getRecipeDetailSourceKind,
} from '../utils/recipeDetailMeta'

const props = defineProps<{ favoritesOnly?: boolean }>()

const route = useRoute()
const router = useRouter()
const listPath = computed(() => (props.favoritesOnly ? '/favorites' : '/recipes'))

const isDetailRoute = computed(() => {
  const raw = route.params.id
  if (raw == null || raw === '') return false
  const id = Number(raw)
  return Number.isFinite(id) && id > 0
})

const recipes = ref<RecipeListItemWithIngredients[]>([])
const loading = ref(true)
const error = ref('')
const editingId = ref<number | null>(null)
type RecipeFormInitial = Partial<RecipeFormPayload> & {
  source_type?: string | null
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
}

const formInitial = ref<RecipeFormInitial | null>(null)
const editingStatus = ref<'draft' | 'confirmed' | null>(null)
const searchQuery = ref('')
const sortBy = ref<'title-asc' | 'title-desc' | 'updated-desc' | 'updated-asc'>('updated-desc')
const activeFilter = ref(
  props.favoritesOnly ? 'favorites' : (typeof route.query.filter === 'string' ? route.query.filter : 'all')
)
const cookingStepIndex = ref(0)

const sortByLabels: Record<typeof sortBy.value, string> = {
  'updated-desc': 'Zuletzt aktualisiert',
  'updated-asc': 'Älteste Aktualisierung',
  'title-asc': 'Name (A–Z)',
  'title-desc': 'Name (Z–A)',
}

const sortByLabel = computed(() => sortByLabels[sortBy.value])

const filterChips = [
  { id: 'all', label: 'Alle' },
  { id: 'favorites', label: 'Favoriten' },
  { id: 'quick', label: 'Schnell' },
  { id: 'healthy', label: 'Gesund' },
  { id: 'dinner', label: 'Abendessen' },
  { id: 'books', label: 'Aus Büchern' },
  { id: 'review', label: 'Prüfen' },
] as const

const isCookingMode = computed(() => route.query.cook === '1' && viewingRecipe.value != null)

const cookingSteps = computed(() => viewingRecipe.value?.recipe_steps ?? [])

type WakeLockSentinelLike = {
  release: () => Promise<void>
  released?: boolean
}

const cookingWakeLock = ref<WakeLockSentinelLike | null>(null)

const cookingServings = computed(() => {
  const fromQuery = Number(route.query.cookServings)
  if (Number.isFinite(fromQuery) && fromQuery >= 1) return Math.max(1, Math.round(fromQuery))
  if (displayServings.value >= 1) return displayServings.value
  return Math.max(1, viewingRecipe.value?.servings ?? 1)
})

const isFinalCookingStep = computed(() => cookingStepIndex.value >= cookingSteps.value.length - 1)

const cookingIngredientSections = computed(() => {
  const recipe = viewingRecipe.value
  if (!recipe) return []

  const originalServings = recipe.servings || 1
  const scale = cookingServings.value / originalServings
  const servingsChanged = cookingServings.value !== originalServings
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
const showImportOverlay = ref(false)
const showUrlImportOverlay = ref(false)
const showAddMenu = ref(false)
const addMenuAnchorRef = ref<HTMLElement | null>(null)
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

const detailMenuOpen = ref(false)
type DetailTabId = 'ingredients' | 'steps' | 'health' | 'nutrition' | 'source' | 'history'
const activeDetailTab = ref<DetailTabId>('steps')

const detailTabsMobile: { id: DetailTabId; label: string; target: string }[] = [
  { id: 'steps', label: 'Zubereitung', target: 'recipe-section-steps' },
  { id: 'health', label: 'Gesundheitscheck', target: 'recipe-section-health' },
  { id: 'nutrition', label: 'Nährwerte', target: 'recipe-section-nutrition' },
  { id: 'source', label: 'Quelle', target: 'recipe-section-source' },
  { id: 'history', label: 'Kochverlauf', target: 'recipe-section-history' },
]

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
        console.error('Kochverlauf konnte nicht geladen werden für', id, err)
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
    console.error('Rezept konnte nicht als gekocht markiert werden:', err)
  }
}

async function setWouldCookAgain(value: 'yes' | 'maybe' | 'no') {
  const recipeId = wouldCookAgainRecipeId.value
  if (!recipeId) return

  try {
    const updated = await updateRecipe(recipeId, { would_cook_again: value })
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
    error.value = err instanceof Error ? err.message : '„Würdest du das wieder kochen?“ konnte nicht aktualisiert werden'
  }
}

function hasCookedToday(recipeId: number) {
  const history = recipeHistories.value[recipeId] ?? []
  const today = new Date().toISOString().slice(0, 10)
  return history.includes(today)
}

function formatGermanDate(value: string | null | undefined): string {
  if (!value) return ''
  const raw = value.trim()
  if (!raw) return ''
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw)
  if (match) {
    const [, y, m, d] = match
    return `${d}.${m}.${y}`
  }
  const parsed = new Date(raw)
  if (!Number.isNaN(parsed.getTime())) {
    return parsed.toLocaleDateString('de-DE')
  }
  return raw
}

const fuseOptions: IFuseOptions<RecipeListItemWithIngredients> = {
  includeMatches: true,
  threshold: 0.3,
  ignoreLocation: true,
  keys: [
    { name: 'title', weight: 2 },
    { name: 'ingredients.ingredient', weight: 1 },
    { name: 'tags', weight: 1 },
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

function buildFormInitialFromImportedRecipe(recipe: Recipe): RecipeFormInitial {
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
    source_type: recipe.source_type ?? null,
    source_url: recipe.source_url ?? null,
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

const detailMetaSource = computed(() => {
  const recipe = viewingRecipe.value
  if (!recipe) return null
  return formatRecipeDetailSourceMeta(recipe)
})

const detailMetaServings = computed(() => formatDetailServingsCount(viewingRecipe.value?.servings))

const detailMetaSourceKind = computed(() => {
  const recipe = viewingRecipe.value
  if (!recipe) return 'unknown' as const
  return getRecipeDetailSourceKind(recipe)
})

const detailMetaPrep = computed(() => formatDetailPrepMeta(viewingRecipe.value))

const detailMetaCook = computed(() => formatDetailCookMeta(viewingRecipe.value))

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

function recipeMatchesFilter(recipe: RecipeListItemWithIngredients): boolean {
  switch (activeFilter.value) {
    case 'favorites':
      return recipe.favorite
    case 'quick': {
      const tags = recipe.tags ?? []
      const mins = (recipe.prep_time_min ?? 0) + (recipe.cook_time_min ?? 0)
      return tags.includes('quick') || tags.includes('easy') || (mins > 0 && mins <= 35)
    }
    case 'healthy': {
      const tags = recipe.tags ?? []
      return tags.some((t) => /vegetarian|vegan|healthy|salad/i.test(t))
    }
    case 'dinner':
      return (recipe.tags ?? []).includes('dinner')
    case 'books':
      return isManagedBookSource(recipe)
    case 'review':
      return recipe.status === 'draft'
    default:
      return true
  }
}

const filteredAndSortedRecipes = computed(() => {
  let list: RecipeListItemWithIngredients[] = recipes.value
  const term = searchQuery.value.trim()

  if (term) {
    if (!fuseInstance) return []
    list = fuseInstance.search(term).map((res) => res.item)
  }

  list = list.filter(recipeMatchesFilter)

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
    error.value = e instanceof Error ? e.message : 'Rezepte konnten nicht geladen werden'
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
    error.value = e instanceof Error ? e.message : 'Favorit konnte nicht aktualisiert werden'
  }
}

async function loadRecipeDetail(id: number) {
  try {
    viewingRecipe.value = await getRecipe(id)
    displayServings.value = viewingRecipe.value.servings || 1
    healthScoreResult.value = viewingRecipe.value.health_score ?? null
    healthScoreError.value = ''
    document.title = `${viewingRecipe.value.title} – Rezeptbibliothek`
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Rezept konnte nicht geladen werden'
    router.replace(listPath.value)
  }
}

function openRecipeDetail(id: number) {
  router.push(`${listPath.value}/${id}`)
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
      await loadRecipeDetail(recipeId)
    }
  } catch (e) {
    console.error('Nährwert-Schätzung fehlgeschlagen:', e)
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
    healthScoreError.value = e instanceof Error ? e.message : 'Gesundheitscheck fehlgeschlagen'
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
  return `${n} Min.`
}

function recipeCardDescription(recipe: RecipeListItemWithIngredients): string | null {
  const text = (recipe.subtitle || recipe.description || '').trim()
  return text || null
}

function jumpDetailSection(tab: DetailTabId, elementId: string) {
  activeDetailTab.value = tab
  document.getElementById(elementId)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

function openOriginalFromMenu() {
  detailMenuOpen.value = false
  const url = viewingRecipe.value?.source_url
  if (url) window.open(url, '_blank', 'noopener,noreferrer')
}

async function deleteFromDetail() {
  const id = viewingRecipe.value?.id
  if (!id) return
  if (!confirm('Dieses Rezept löschen? Diese Aktion kann nicht rückgängig gemacht werden.')) return
  detailMenuOpen.value = false
  error.value = ''
  try {
    await deleteRecipe(id)
    closeDetailView()
    await loadList()
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Rezept konnte nicht gelöscht werden'
  }
}

function onDocumentClickForDetailMenu(event: MouseEvent) {
  if (!detailMenuOpen.value) return
  const target = event.target as HTMLElement
  if (target.closest('.recipe-detail-nav__menu-wrap')) return
  detailMenuOpen.value = false
}

function hasRecipeBookSource(recipe: Recipe | RecipeListItemWithIngredients | null | undefined): boolean {
  if (!recipe) return false
  return isManagedBookSource(recipe) && !!(recipe.source_name || recipe.source_id)
}

function hasRecipeUrlSource(recipe: Recipe | RecipeListItemWithIngredients | null | undefined): boolean {
  if (!recipe) return false
  return isRecipeWebsiteSource(recipe) && !!recipe.source_url
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
            `Originale Vorbereitungszeit (${p.prep.current} Min.) durch geschätzte Zeit (${p.prep.suggested} Min.) ersetzen?`
          )
        ) {
          rp = true
        }
      }
      if (p.cook) {
        if (
          window.confirm(
            `Originale Garzeit (${p.cook.current} Min.) durch geschätzte Zeit (${p.cook.suggested} Min.) ersetzen?`
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

function clearDetailState() {
  viewingRecipe.value = null
  displayServings.value = 1
  healthScoreResult.value = null
  healthScoreError.value = ''
  timeEstimateError.value = ''
  detailMenuOpen.value = false
  activeDetailTab.value = 'steps'
  const pageTitle = props.favoritesOnly ? 'Favoriten' : 'Rezepte'
  document.title = `${pageTitle} – Rezeptbibliothek`
}

function closeDetailView() {
  clearDetailState()
  if (route.params.id) router.push({ path: listPath.value, query: {} })
}

function startCookingMode() {
  cookingStepIndex.value = 0
  router.push({
    path: route.path,
    query: { ...route.query, cook: '1', cookServings: String(Math.max(1, displayServings.value || 1)) },
  })
}

function exitCookingMode() {
  const q = { ...route.query } as Record<string, string>
  delete q.cook
  delete q.cookServings
  router.push({ path: route.path, query: q })
}

function adjustServings(delta: number) {
  displayServings.value = Math.max(1, displayServings.value + delta)
}

async function advanceCookingStep() {
  if (!viewingRecipe.value) return
  if (isFinalCookingStep.value) {
    if (hasCookedToday(viewingRecipe.value.id)) return
    await markCookedToday(viewingRecipe.value.id)
    return
  }
  cookingStepIndex.value += 1
}

async function requestCookingWakeLock() {
  if (!isCookingMode.value || typeof window === 'undefined' || !('wakeLock' in navigator)) return
  try {
    const navWithWakeLock = navigator as Navigator & {
      wakeLock?: { request: (type: 'screen') => Promise<WakeLockSentinelLike> }
    }
    cookingWakeLock.value = await navWithWakeLock.wakeLock?.request('screen') ?? null
  } catch {
    cookingWakeLock.value = null
  }
}

async function releaseCookingWakeLock() {
  if (!cookingWakeLock.value) return
  try {
    await cookingWakeLock.value.release()
  } catch {
    // Ignore release failures to keep exit flow smooth.
  } finally {
    cookingWakeLock.value = null
  }
}

async function onVisibilityChangeForCookingWakeLock() {
  if (!isCookingMode.value) return
  if (document.visibilityState === 'visible') {
    await requestCookingWakeLock()
    return
  }
  await releaseCookingWakeLock()
}

function editFromDetail() {
  if (viewingRecipe.value) {
    const id = viewingRecipe.value.id
    closeDetailView()
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
      source_type: recipe.source_type ?? null,
      source_url: recipe.source_url ?? null,
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
    error.value = e instanceof Error ? e.message : 'Rezept konnte nicht geladen werden'
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

function toggleAddMenu() {
  showAddMenu.value = !showAddMenu.value
}

function closeAddMenu() {
  showAddMenu.value = false
}

function onAddMenuChoice(kind: 'image' | 'url' | 'manual') {
  closeAddMenu()
  if (kind === 'image') showImportOverlay.value = true
  else if (kind === 'url') showUrlImportOverlay.value = true
  else openManualForm()
}

function onDocumentClickForAddMenu(event: MouseEvent) {
  if (!showAddMenu.value) return
  const anchor = addMenuAnchorRef.value
  if (anchor && !anchor.contains(event.target as Node)) {
    closeAddMenu()
  }
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
        await updateRecipe(recipeId, { image_path: null })
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
          throw new Error('Bild konnte nicht hochgeladen werden')
        }
      }
    }

    // Keep the edit overlay open after saving.
    // We refresh data so the form reflects what was persisted.
    if (recipeId) {
      // Refresh form data without closing overlay
      startEdit(recipeId)
      if (viewingRecipe.value?.id === recipeId) {
        try {
          viewingRecipe.value = await getRecipe(recipeId)
        } catch {
          /* list refresh below still runs */
        }
      }
    }

    if (options?.estimateNutrition && recipeId) {
      await runNutritionEstimate(recipeId, { refreshList: true })
    } else {
      await loadList()
    }
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Rezept konnte nicht gespeichert werden'
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
    error.value = e instanceof Error ? e.message : 'Rezept konnte nicht bestätigt werden'
  }
}

async function onDeleteFromEdit() {
  if (!editingId.value) return
  if (!confirm('Dieses Rezept löschen? Diese Aktion kann nicht rückgängig gemacht werden.')) return
  error.value = ''
  try {
    await deleteRecipe(editingId.value)
    closeEdit()
    await loadList()
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Rezept konnte nicht gelöscht werden'
  }
}

watch(
  () => route.params.id,
  async (raw) => {
    if (!raw) {
      if (viewingRecipe.value) clearDetailState()
      return
    }
    if (raw === 'new') {
      openManualForm()
      return
    }
    const id = Number(raw)
    if (!Number.isFinite(id) || id <= 0) {
      router.replace(listPath.value)
      return
    }
    if (viewingRecipe.value?.id === id) return
    await loadRecipeDetail(id)
    if (route.query.review === '1') {
      startEdit(id)
    }
  },
  { immediate: true },
)

watch(
  () => props.favoritesOnly,
  (fav) => {
    if (fav) activeFilter.value = 'favorites'
  },
  { immediate: true },
)

onMounted(() => {
  loadList()
  document.addEventListener('click', hideCoverOverlay)
  document.addEventListener('click', onDocumentClickForAddMenu)
  document.addEventListener('click', onDocumentClickForDetailMenu)
  document.addEventListener('visibilitychange', onVisibilityChangeForCookingWakeLock)
})

watch(
  () => props.favoritesOnly,
  async () => {
    await loadList()
    // Avoid showing stale detail/edit state from the previous listing filter.
    clearDetailState()
    editingId.value = null
    formInitial.value = null
    editingStatus.value = null
    showRecipeForm.value = false
    displayServings.value = 1
  }
)

watch(showRecipeForm, (open) => {
  document.body.classList.toggle('app-modal-open', open)
})

watch(
  isCookingMode,
  async (active) => {
    if (active) {
      await nextTick()
      window.scrollTo({ top: 0, left: 0, behavior: 'auto' })
      await requestCookingWakeLock()
      return
    }
    await releaseCookingWakeLock()
  },
  { immediate: true },
)

onBeforeUnmount(() => {
  document.removeEventListener('click', hideCoverOverlay)
  document.removeEventListener('click', onDocumentClickForAddMenu)
  document.removeEventListener('click', onDocumentClickForDetailMenu)
  document.removeEventListener('visibilitychange', onVisibilityChangeForCookingWakeLock)
  document.body.classList.remove('app-modal-open')
  releaseCookingWakeLock()
})
</script>

<style scoped>
.recipes-view {
  max-width: 1400px;
  margin: 0 auto;
  min-width: 0;
}

.recipes-view:has(.recipe-detail-page),
.recipes-view:has(.cooking-mode) {
  overflow-x: clip;
}

.recipes-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: var(--spacing-md);
  gap: var(--spacing-md);
}

.recipes-header__main {
  flex: 1;
  min-width: 250px;
}

.recipes-title {
  margin: 0;
  font-size: 1.5rem;
  font-weight: 700;
  letter-spacing: -0.02em;
}

.recipes-subtitle {
  font-size: 1rem;
  color: var(--color-text-muted);
  margin: 0;
}

.recipes-header__add {
  position: relative;
  flex-shrink: 0;
}

.recipes-add-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 3rem;
  height: 3rem;
  padding: 0;
  border: none;
  border-radius: 50%;
  background: var(--color-primary);
  color: #fff;
  cursor: pointer;
  box-shadow: var(--shadow-md);
  transition: transform var(--transition-fast), background var(--transition-fast);
}

.recipes-add-btn:hover {
  transform: scale(1.05);
  background: var(--color-primary-hover, var(--color-primary));
}

.recipes-add-btn svg {
  width: 1.5rem;
  height: 1.5rem;
}

.add-recipe-menu {
  position: absolute;
  top: calc(100% + var(--spacing-sm));
  right: 0;
  z-index: 50;
  min-width: 11rem;
  padding: var(--spacing-xs);
  background: var(--color-bg-elevated);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-lg);
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.add-recipe-menu__item {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  width: 100%;
  padding: var(--spacing-sm) var(--spacing-md);
  border: none;
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--color-text);
  font: inherit;
  font-size: 0.95rem;
  font-weight: 500;
  text-align: left;
  cursor: pointer;
  transition: background var(--transition-fast);
}

.add-recipe-menu__item:hover {
  background: var(--color-bg-muted, rgba(0, 0, 0, 0.05));
}

.add-recipe-menu__item svg {
  width: 1.125rem;
  height: 1.125rem;
  flex-shrink: 0;
  color: var(--color-text-muted);
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

.recipes-header__add-desktop {
  display: none;
}
@media (min-width: 1024px) and (orientation: landscape), (min-width: 1200px) {
  .recipes-header__add-desktop {
    display: inline-flex;
  }
}

.recipes-toolbar {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
  margin-bottom: var(--spacing-lg);
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
  border-color: var(--color-accent);
  box-shadow: 0 0 0 3px var(--color-accent-soft);
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

.recipes-toolbar__filters {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
}

.recipes-filter-chips {
  min-width: 0;
}

/* Recipe detail — image-first, document layout */
.recipe-detail-page {
  --recipe-detail-radius: 10px;
  max-width: 56rem;
  margin: 0 auto;
  padding-bottom: var(--spacing-2xl);
  overflow-x: clip;
  min-width: 0;
}

@media (min-width: 768px) {
  .recipe-detail-page {
    max-width: 1280px;
  }
}

@media (max-width: 767px) {
  .recipe-detail-page {
    margin-left: calc(-1 * var(--content-padding-mobile));
    margin-right: calc(-1 * var(--content-padding-mobile));
    max-width: none;
    width: calc(100% + 2 * var(--content-padding-mobile));
  }
}

.recipe-detail-nav {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--spacing-sm);
  min-height: 44px;
  margin-bottom: var(--spacing-sm);
  padding: 0 var(--content-padding-mobile);
  overflow: visible;
}

@media (min-width: 768px) {
  .recipe-detail-nav {
    padding: 0;
  }
}

.recipe-detail-nav__btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  min-width: 44px;
  min-height: 44px;
  padding: 0;
  border: none;
  border-radius: 50%;
  background: transparent;
  color: var(--color-text-muted);
  cursor: pointer;
  transition: color var(--transition-fast), background var(--transition-fast);
}

.recipe-detail-nav__btn:hover,
.recipe-detail-nav__btn:focus-visible {
  color: var(--color-text);
  background: var(--color-surface-subtle);
  outline: none;
}

.recipe-detail-nav__btn svg {
  width: 1.35rem;
  height: 1.35rem;
  flex-shrink: 0;
}

.recipe-detail-nav__btn--back {
  justify-content: flex-start;
  width: auto;
  max-width: min(100%, 14rem);
  margin-right: auto;
  padding: 0 12px 0 10px;
  border-radius: 999px;
}

.recipe-detail-nav__back-label {
  display: none;
}

@media (min-width: 768px) {
  .recipe-detail-nav__btn--back {
    max-width: none;
    padding: 0 16px 0 12px;
  }

  .recipe-detail-nav__back-label {
    display: inline;
    font: inherit;
    font-size: 0.9rem;
    font-weight: 500;
    white-space: nowrap;
  }
}

.recipe-detail-nav__menu-wrap {
  position: relative;
}

.recipe-detail-nav__menu {
  position: absolute;
  top: calc(100% + 4px);
  right: 0;
  z-index: 20;
  width: min(280px, calc(100vw - 24px));
  min-width: 240px;
  padding: 4px;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-soft);
}

.recipe-detail-nav__menu button {
  display: block;
  width: 100%;
  min-height: 44px;
  padding: 10px 14px;
  border: none;
  border-radius: var(--radius-sm);
  background: transparent;
  font: inherit;
  font-size: 0.9rem;
  text-align: left;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  color: var(--color-text);
  cursor: pointer;
}

.recipe-detail-nav__menu button:hover {
  background: var(--color-surface-subtle);
}

.recipe-detail-nav__menu button:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.recipe-detail-nav__menu-danger {
  color: var(--color-danger);
}

.recipe-detail-nav__menu-edit-non-desktop {
  display: block;
}

@media (min-width: 1024px) {
  .recipe-detail-nav__menu-edit-non-desktop {
    display: none;
  }
}

.recipe-detail-layout {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.recipe-detail-main-col {
  display: contents;
}

.recipe-detail-hero--desktop {
  display: none;
}

.recipe-detail-hero {
  position: relative;
  width: 100%;
  overflow: hidden;
  background: var(--color-surface-subtle);
}

.recipe-detail-hero--mobile {
  order: 1;
  margin-bottom: var(--spacing-md);
  border-radius: 0;
}

.recipe-detail-hero--mobile img {
  display: block;
  width: 100%;
  max-height: min(52vh, 420px);
  object-fit: cover;
  object-position: center;
}

.recipe-detail-favorite-star {
  position: absolute;
  top: 7px;
  right: 22px;
  width: 30px;
  height: 30px;
  border: 1px solid color-mix(in srgb, var(--color-border) 70%, transparent);
  border-radius: 999px;
  background: color-mix(in srgb, var(--color-bg) 78%, transparent);
  color: var(--color-text-muted);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 1rem;
  line-height: 1;
  cursor: pointer;
  z-index: 2;
  backdrop-filter: blur(2px);
  transition: color var(--transition-fast), background var(--transition-fast), border-color var(--transition-fast);
}

@media (min-width: 1100px) {
  .recipe-detail-favorite-star {
    right: 7px;
  }
}

.recipe-detail-favorite-star:hover {
  color: var(--color-text);
  background: color-mix(in srgb, var(--color-bg) 88%, transparent);
}

.recipe-detail-favorite-star--active {
  color: var(--color-accent);
  border-color: color-mix(in srgb, var(--color-accent) 45%, var(--color-border));
}

.recipe-detail-identity {
  order: 2;
  padding: 0 var(--content-padding-mobile) var(--spacing-md);
  min-width: 0;
}

.recipe-detail-side-panel {
  order: 3;
  min-width: 0;
}

@media (max-width: 767px) {
  .recipe-detail-side-panel {
    padding-left: 0;
  }

  .recipe-detail-side-panel::before {
    display: none;
  }

  .recipe-detail-ingredients-panel {
    margin-top: 10px;
  }
}

.recipe-detail-ingredients-panel {
  padding: 0 var(--content-padding-mobile) var(--spacing-xs);
  min-width: 0;
}

.recipe-detail-ingredients-scroll {
  min-width: 0;
}

.recipe-detail-main {
  order: 4;
  min-width: 0;
  padding: 0 var(--content-padding-mobile);
}

.recipe-detail-main::before,
.recipe-doc-section + .recipe-doc-section::before {
  content: '';
  display: block;
  width: min(68%, 720px);
  height: 1px;
  border: 0;
  margin: 12px auto 28px;
  background: linear-gradient(
    to right,
    transparent,
    color-mix(in srgb, var(--color-border) 55%, transparent),
    var(--color-border),
    color-mix(in srgb, var(--color-border) 55%, transparent),
    transparent
  );
}

@media (min-width: 1024px) and (orientation: landscape), (min-width: 1200px) {
  .recipe-detail-layout {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(300px, 380px);
    gap: clamp(32px, 4vw, 64px);
    align-items: start;
    max-width: 1280px;
    margin: 0 auto;
  }

  .recipe-detail-main-col {
    display: flex;
    flex-direction: column;
    grid-column: 1;
    min-width: 0;
  }

  .recipe-detail-side-panel {
    grid-column: 2;
    grid-row: 1;
    order: unset;
    align-self: start;
    position: relative;
    border-left: none;
    padding-left: clamp(24px, 3vw, 40px);
  }

  .recipe-detail-side-panel::before {
    content: '';
    position: absolute;
    left: 0;
    top: 0;
    width: 1px;
    height: min(100%, 720px);
    pointer-events: none;
    background: linear-gradient(
      to bottom,
      transparent,
      color-mix(in srgb, var(--color-border) 55%, transparent),
      var(--color-border),
      color-mix(in srgb, var(--color-border) 55%, transparent),
      transparent
    );
  }

  .recipe-detail-hero--mobile {
    display: none;
  }

  .recipe-detail-hero--desktop {
    display: block;
    margin-bottom: var(--spacing-md);
    border-radius: var(--recipe-detail-radius);
  }

  .recipe-detail-hero--desktop img {
    display: block;
    width: 100%;
    height: clamp(220px, 24vw, 280px);
    max-height: 300px;
    object-fit: cover;
    object-position: center;
    border-radius: var(--recipe-detail-radius);
  }

  .recipe-detail-hero--desktop .recipe-detail-pending-hero {
    min-height: 220px;
    border-radius: var(--recipe-detail-radius);
  }

  .recipe-detail-identity {
    order: unset;
    padding: 0;
  }

  .recipe-detail-main {
    order: unset;
    padding: 0;
    margin-top: var(--spacing-md);
  }

  .recipe-detail-ingredients-panel {
    padding: 0;
  }

  .recipe-detail-tabs--mobile {
    display: none;
  }
}

@media (min-width: 1024px) and (orientation: landscape), (min-width: 1200px) {
  .recipe-detail-side-panel {
    position: sticky;
    top: calc(var(--top-nav-height) + var(--spacing-md));
    max-height: calc(100vh - var(--top-nav-height) - var(--spacing-xl));
    display: flex;
    flex-direction: column;
  }

  .recipe-detail-ingredients-scroll {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    max-height: calc(100vh - 420px);
    padding-right: 2px;
  }
}

@media (min-width: 768px) and (max-width: 1023px) {
  .recipe-detail-ingredients-scroll {
    overflow: visible;
    max-height: none;
  }
}

.recipe-detail-ingredients-panel__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--spacing-sm);
  margin-bottom: var(--spacing-md);
}

.recipe-detail-ingredients-panel__title {
  margin: 0;
  font-size: 0.95rem;
  font-weight: 650;
  color: var(--color-text);
}

.recipe-ingredients-list--panel .recipe-ingredient {
  padding: 0.65rem 0;
  border-bottom: none;
}

@media (min-width: 768px) {
  .recipe-ingredients-list--panel .recipe-ingredient {
    padding: 0.45rem 0;
  }
}

.recipe-ingredients-list--panel {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  font-size: 0.9375rem;
  line-height: 1.45;
  color: var(--color-text-muted);
}

.recipe-ingredients-list--panel .recipe-ingredient-text {
  font-size: inherit;
  color: inherit;
}

.recipe-detail-section-refresh,
.recipe-detail-meta__refresh {
  flex-shrink: 0;
  margin-left: 4px;
  padding: 4px 8px;
  border: none;
  border-radius: var(--radius-xs);
  background: transparent;
  color: var(--color-text-soft);
  font-size: 0.95rem;
  line-height: 1;
  cursor: pointer;
}

.recipe-detail-section-refresh:hover:not(:disabled),
.recipe-detail-meta__refresh:hover:not(:disabled) {
  color: var(--color-accent);
  background: var(--color-surface-subtle);
}

.recipe-detail-section-refresh:disabled,
.recipe-detail-meta__refresh:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.recipe-detail-estimate-cta {
  margin-top: var(--spacing-sm);
}

.recipe-detail-action.recipe-detail-action--edit-desktop {
  display: none;
}

@media (min-width: 1024px) {
  .recipe-detail-action.recipe-detail-action--edit-desktop {
    display: inline-flex;
  }
}

.recipe-detail-review-inline {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  margin-bottom: var(--spacing-sm);
  font-size: 0.8125rem;
}

.recipe-detail-review-inline__link {
  padding: 0;
  border: none;
  background: none;
  color: var(--color-accent);
  font: inherit;
  font-weight: 500;
  cursor: pointer;
  text-decoration: underline;
}

.recipe-detail-title {
  margin: 0 0 0.35rem;
  font-size: 1.5rem;
  font-weight: 700;
  line-height: 1.25;
  letter-spacing: -0.02em;
}

.recipe-detail-subtitle {
  margin: 0 0 var(--spacing-sm);
  font-size: 1rem;
  line-height: 1.45;
  color: var(--color-text-muted);
}

/* Mobile simple text metadata */
.recipe-detail-meta-simple {
  display: flex;
  flex-direction: column;
  gap: 2px;
  margin-top: var(--spacing-sm);
  margin-bottom: var(--spacing-md);
}

.recipe-detail-meta-simple__line {
  margin: 0;
  font-size: 0.875rem;
  color: var(--color-text-muted);
  line-height: 1.4;
}

@media (min-width: 768px) {
  .recipe-detail-meta-simple {
    display: none;
  }
}

/* Desktop/tablet icon metadata row */
.recipe-detail-meta {
  display: none;
  flex-wrap: nowrap;
  align-items: center;
  gap: 0;
  max-width: 100%;
  margin-bottom: var(--spacing-sm);
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
  scrollbar-width: none;
}

@media (min-width: 768px) {
  .recipe-detail-meta {
    display: flex;
  }
}

.recipe-detail-meta::-webkit-scrollbar {
  display: none;
}

.recipe-detail-meta__item {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
  padding: 0 14px;
  min-height: 40px;
}

.recipe-detail-meta__item:first-child {
  padding-left: 0;
}

.recipe-detail-meta__icon {
  width: 18px;
  height: 18px;
  flex-shrink: 0;
  color: var(--color-text-muted);
}

.recipe-detail-meta__source,
.recipe-detail-meta__servings {
  font-size: 0.9375rem;
  font-weight: 500;
  color: var(--color-text);
  white-space: nowrap;
}

.recipe-detail-meta__sep {
  flex-shrink: 0;
  align-self: stretch;
  width: 1px;
  min-height: 28px;
  margin: 6px 0;
  background: var(--color-border);
}

.recipe-detail-meta__item--time {
  gap: 8px;
}

.recipe-detail-meta__time-stack {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  justify-content: center;
  gap: 1px;
  line-height: 1.15;
}

.recipe-detail-meta__time-value {
  font-size: 0.9375rem;
  font-weight: 500;
  color: var(--color-text);
  white-space: nowrap;
}

.recipe-detail-meta__time-label {
  font-size: 0.625rem;
  font-weight: 650;
  letter-spacing: 0.06em;
  color: var(--color-text-soft);
  white-space: nowrap;
}

.recipe-detail-actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--spacing-sm);
  margin-bottom: var(--spacing-md);
}

.recipe-detail-action {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-height: 40px;
  padding: 8px 14px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  background: var(--color-surface);
  font: inherit;
  font-size: 0.8125rem;
  font-weight: 500;
  color: var(--color-text);
  cursor: pointer;
  transition: border-color var(--transition-fast), background var(--transition-fast), color var(--transition-fast), box-shadow var(--transition-fast);
}

.recipe-detail-action.btn--primary {
  min-height: 40px;
  padding: 8px 16px;
}

.recipe-detail-action--primary {
  background: var(--color-accent);
  color: var(--color-accent-text);
  border-color: transparent;
}

.recipe-detail-action--primary:hover,
.recipe-detail-action--primary:focus-visible,
.recipe-detail-action--primary:active {
  color: var(--color-accent-text);
}

@media (hover: hover) and (pointer: fine) {
  .recipe-detail-action--primary:hover {
    background: var(--color-accent-hover);
  }
}

.recipe-detail-action--primary:focus-visible {
  outline: 2px solid color-mix(in srgb, var(--color-accent) 55%, white);
  outline-offset: 2px;
}

.recipe-detail-action--secondary:hover {
  border-color: var(--color-border-strong);
  background: var(--color-surface-subtle);
}

@media (min-width: 768px) {
  .recipe-detail-action {
    min-height: 40px;
    padding: 8px 14px;
    font-size: 0.8125rem;
  }

  .recipe-detail-action.btn--primary,
  .recipe-detail-action--primary {
    min-height: 42px;
    padding: 9px 18px;
  }
}

@media (max-width: 767px) {
  .recipe-detail-actions {
    width: 100%;
  }

  .recipe-detail-action {
    min-height: 40px;
    padding: 9px 14px;
    font-size: 0.875rem;
  }

  .recipe-detail-action.btn--primary,
  .recipe-detail-action--primary {
    width: 100%;
    min-height: 46px;
    padding: 11px 18px;
    justify-content: center;
  }
}

.recipe-detail-action--active {
  color: var(--color-accent);
  border-color: var(--color-accent-soft);
}

.recipe-detail-tabs {
  display: flex;
  gap: var(--spacing-md);
  max-width: 100%;
  margin-top: var(--spacing-xs);
  overflow-x: auto;
  overflow-y: hidden;
  -webkit-overflow-scrolling: touch;
  border-bottom: 1px solid var(--color-border);
  scrollbar-width: none;
}

.recipe-detail-tabs--mobile {
  display: flex;
}

@media (min-width: 768px) {
  .recipe-detail-tabs--mobile {
    display: none;
  }
}

.recipe-detail-tabs::-webkit-scrollbar {
  display: none;
}

.recipe-detail-tabs__item {
  flex-shrink: 0;
  padding: 0 0 10px;
  margin-bottom: -1px;
  border: none;
  border-bottom: 2px solid transparent;
  background: none;
  font: inherit;
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--color-text-muted);
  cursor: pointer;
}

.recipe-detail-tabs__item:hover {
  color: var(--color-text);
}

.recipe-detail-tabs__item--active {
  color: var(--color-accent);
  border-bottom-color: var(--color-accent);
}

.recipe-doc-section {
  padding: 0 0 var(--spacing-lg);
}

.recipe-detail-main > .recipe-doc-section:last-child {
  padding-bottom: 0;
}

.recipe-doc-section__title {
  margin: 0 0 var(--spacing-md);
  font-size: 1.125rem;
  font-weight: 650;
  color: var(--color-text);
}

.recipe-doc-section__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--spacing-md);
  margin-bottom: var(--spacing-md);
}

.recipe-doc-section__head .recipe-doc-section__title {
  margin-bottom: 0;
}

.recipe-doc-section__text {
  margin: 0;
  line-height: 1.6;
  color: var(--color-text-muted);
  white-space: pre-wrap;
}

.recipe-detail-source-type {
  margin: 0 0 var(--spacing-md);
}

.recipe-detail-source-link {
  color: var(--color-accent);
  font-weight: 500;
  text-decoration: none;
}

.recipe-detail-source-link:hover {
  text-decoration: underline;
}

.cooking-mode {
  max-width: 68rem;
  margin: 0 auto;
  padding-bottom: var(--spacing-xs);
  min-width: 0;
  overflow-x: clip;
}

.cooking-mode__top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--spacing-md);
  margin-bottom: var(--spacing-lg);
}

.cooking-mode__exit {
  padding: 0;
  border: none;
  background: transparent;
  color: var(--color-text-muted);
  font: inherit;
  font-size: 0.95rem;
  font-weight: 500;
  cursor: pointer;
  text-decoration: none;
}

.cooking-mode__exit:hover {
  color: var(--color-text);
}

.cooking-mode__exit:focus-visible {
  outline: 2px solid var(--color-accent);
  outline-offset: 3px;
  border-radius: 2px;
}

.cooking-mode__label {
  font-size: 0.8125rem;
}

.cooking-mode__layout {
  display: block;
  min-width: 0;
}

.cooking-mode__main {
  min-width: 0;
}

.cooking-mode__progress {
  margin: 0 0 var(--spacing-sm);
}

.cooking-mode__text {
  font-size: clamp(1.1rem, 4vw, 2.2rem);
  line-height: 1.3;
  margin: 0 0 var(--spacing-lg);
  font-weight: 300;
  max-width: 42ch;
}

.cooking-mode__nav {
  display: flex;
  gap: var(--spacing-sm);
  justify-content: stretch;
  align-items: center;
  margin-bottom: 0;
  max-width: 28rem;
  width: 100%;
}

.cooking-mode__nav .btn {
  min-height: 44px;
  flex: 1;
  max-width: 13.5rem;
}

.cooking-mode__nav .btn--secondary {
  border: 1px solid var(--color-border);
  background: var(--color-surface);
  color: var(--color-text-muted);
}

.cooking-mode__nav .btn--secondary:hover:not(:disabled) {
  color: var(--color-text);
  background: var(--color-surface-subtle);
}

.cooking-mode__nav .btn--secondary:disabled {
  opacity: 0.7;
}

.cooking-mode__completion {
  margin-top: var(--spacing-sm);
  color: var(--color-text-muted);
  display: flex;
  align-items: center;
  gap: var(--spacing-md);
}

.cooking-mode__completion-exit {
  border: none;
  background: transparent;
  color: var(--color-text-muted);
  font: inherit;
  padding: 0;
  cursor: pointer;
}

.cooking-mode__completion-exit:hover {
  color: var(--color-text);
  text-decoration: underline;
}

.cooking-mode__completion-exit:focus-visible {
  outline: 2px solid var(--color-accent);
  outline-offset: 3px;
  border-radius: 2px;
}

.cooking-mode__aside {
  display: none;
}

.cooking-mode__ingredients-mobile {
  margin-top: var(--spacing-lg);
  padding: var(--spacing-md) 0 0;
  border-top: 1px solid var(--color-border);
}

.cooking-mode__ingredients-mobile summary {
  cursor: pointer;
  font-weight: 500;
  color: var(--color-text-muted);
  list-style: none;
  margin-bottom: var(--spacing-lg);
}

.cooking-mode__ingredients-mobile summary::-webkit-details-marker {
  display: none;
}

.cooking-mode__ingredients-mobile[open] summary {
  color: var(--color-text);
}

.cooking-mode__ingredient-groups {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
}

.cooking-mode__ingredients-mobile .recipe-ingredient-group__heading {
  margin-bottom: var(--spacing-md);
}

.cooking-mode__ingredient-list {
  margin: 0;
  padding: 0;
  list-style: none;
}

.cooking-mode__ingredient-list .recipe-ingredient {
  padding: 0.35rem 0;
}

@media (min-width: 1024px) and (orientation: landscape), (min-width: 1200px) {
  .cooking-mode__layout {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(280px, 380px);
    gap: var(--spacing-xl);
    align-items: start;
  }

  .cooking-mode__main {
    padding-right: var(--spacing-md);
  }

  .cooking-mode__nav .btn {
    flex: 0 1 auto;
    min-width: 7rem;
  }

  .cooking-mode__aside {
    display: block;
    padding: 0 0 0 var(--spacing-lg);
    border-left: 1px solid color-mix(in srgb, var(--color-accent) 18%, var(--color-border));
    max-height: calc(100vh - 8rem);
    overflow-y: auto;
  }

  .cooking-mode__aside-title {
    margin: 0 0 var(--spacing-md);
    font-size: 0.95rem;
    font-weight: 650;
    color: var(--color-text);
  }

  .cooking-mode__ingredient-list {
    font-size: 0.9375rem;
    line-height: 1.45;
    color: var(--color-text-muted);
  }

  .cooking-mode__ingredients-mobile {
    display: none;
  }
}


.recipe-detail-book-source {
  display: flex;
  gap: var(--spacing-md);
  align-items: flex-start;
}

.recipe-detail-book-source__cover {
  width: 56px;
  height: 76px;
  object-fit: cover;
  border-radius: var(--radius-sm);
  border: 1px solid var(--color-border);
  flex-shrink: 0;
}

.recipe-detail-book-source__name {
  margin: 0;
  font-weight: 600;
  color: var(--color-text);
}

.recipe-detail-book-source__meta {
  margin: 0.2rem 0 0;
  font-size: 0.9rem;
  color: var(--color-text-muted);
}

.recipe-ingredient-group {
  margin-bottom: var(--spacing-md);
}

.recipe-ingredient-group__heading {
  margin: 0 0 var(--spacing-sm);
  font-size: 0.9rem;
  font-weight: 600;
  color: var(--color-text-muted);
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

.recipe-detail-time-inline-error {
  margin: var(--spacing-xs) 0 0;
  font-size: 0.875rem;
  color: var(--color-danger, #c62828);
  width: 100%;
}

.recipe-detail-servings {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 0.75rem;
  color: var(--color-text-muted);
  flex-shrink: 0;
}

.servings-btn {
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--color-border);
  border-radius: 999px;
  background: var(--color-surface);
  color: var(--color-text);
  font-size: 1rem;
  font-weight: 650;
  cursor: pointer;
  transition: border-color var(--transition-fast), background var(--transition-fast), color var(--transition-fast);
}

.servings-btn:hover:not(:disabled) {
  background: var(--color-surface-subtle);
  border-color: var(--color-border-strong);
}

.servings-btn:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}

.servings-value {
  min-width: 24px;
  text-align: center;
  font-weight: 650;
  font-size: 0.95rem;
  color: var(--color-text);
}

.servings-label {
  font-size: 0.75rem;
  color: var(--color-text-muted);
}

.recipe-steps-list {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: var(--spacing-lg);
}

.recipe-step {
  display: flex;
  gap: var(--spacing-sm);
  align-items: flex-start;
}

.recipe-step-number {
  flex-shrink: 0;
  min-width: 1.5rem;
  font-weight: 600;
  font-size: 0.9375rem;
  line-height: 1.65;
  color: var(--color-text-muted);
}

.recipe-step-text {
  margin: 0;
  flex: 1;
  font-size: 1rem;
  line-height: 1.65;
  color: var(--color-text);
}

.recipe-ingredients-list {
  list-style: none;
  padding: 0;
  margin: 0;
}

.recipe-ingredient {
  padding: 0.65rem 0;
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
  margin-bottom: 0;
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
  font-size: 2rem;
  font-weight: 700;
  color: var(--color-text);
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
  grid-template-columns: 1fr;
  gap: var(--spacing-lg);
}

@media (min-width: 520px) {
  .recipe-health-columns {
    grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  }
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

.recipe-nutrition {
  display: flex;
  flex-direction: column;
  gap: 0;
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
  margin-top: var(--spacing-xs);
  display: flex;
  flex-direction: column;
  gap: 0.45rem;
}

.recipe-detail-history__head {
  margin-bottom: var(--spacing-sm);
}

.recipe-detail-history__latest,
.recipe-detail-history__previous,
.recipe-detail-history__empty {
  margin: 0;
}

.recipe-detail-history__latest {
  font-size: 0.88rem;
  color: var(--color-text-muted);
}

.recipe-detail-history__previous,
.recipe-detail-history__empty {
  font-size: 0.85rem;
  color: var(--color-text-muted);
}

.recipe-detail-history__mark {
  flex-shrink: 0;
}

@media (max-width: 479px) {
  .recipe-detail-history__head {
    align-items: flex-start;
    flex-wrap: wrap;
    gap: var(--spacing-sm);
  }
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
  justify-content: space-between;
  gap: var(--spacing-md);
  padding: 0.5rem 0;
  border-bottom: 1px solid var(--color-border);
}

.recipe-nutrition-label {
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--color-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.recipe-nutrition-value {
  font-size: 1rem;
  font-weight: 600;
  color: var(--color-text);
}

/* Edit Overlay */
.recipe-edit-overlay {
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

@media (max-width: 768px) {
  .recipes-title {
    font-size: 1.375rem;
  }

  .recipe-detail-title {
    font-size: 1.375rem;
  }

  .recipe-ingredient-text,
  .recipe-step-text {
    font-size: 1.0625rem;
  }

  .recipe-edit-panel {
    max-height: 95vh;
  }

  .recipe-edit-body {
    padding: var(--spacing-md);
  }
}

@media (max-width: 480px) {
  .recipe-nutrition {
    grid-template-columns: 1fr;
  }
}
</style>
