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
    <div v-if="!loading || recipes.length" class="recipe-overview-wrap">
      <div class="recipe-grid recipe-list">
      <article
        v-for="recipe in filteredAndSortedRecipes"
        :key="recipe.id"
        class="recipe-card"
        @click="openRecipeDetail(recipe.id)"
      >
        <div class="recipe-card__thumb">
          <div v-if="getRecipeCardImageUrl(recipe)" class="pending-media">
            <img
              :src="getRecipeCardImageUrl(recipe)!"
              :alt="recipe.title"
              loading="lazy"
            />
            <div v-if="recipe.image_processing_pending" class="pending-media__overlay">
              <span class="pending-media__label">Noch nicht verarbeitet</span>
            </div>
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
      </article>
      </div>
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
          <div class="cooking-mode__aside-head">
            <h2 class="cooking-mode__aside-title">Zutaten</h2>
            <button
              v-if="detailHasAnyOriginalText"
              type="button"
              class="ingredients-icon-btn cooking-mode__original-toggle"
              :class="{ 'ingredients-icon-btn--active': showDetailOriginalLines }"
              :aria-pressed="showDetailOriginalLines"
              :title="showDetailOriginalLines ? 'Originale ausblenden' : 'Originale anzeigen'"
              :aria-label="showDetailOriginalLines ? 'Originale ausblenden' : 'Originale anzeigen'"
              @click="showDetailOriginalLines = !showDetailOriginalLines"
            >
              <OriginalLanguageIcon />
            </button>
          </div>
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
                  <div class="recipe-ingredient-lines">
                    <span class="recipe-ingredient-text">{{ line.text }}</span>
                    <span
                      v-if="showDetailOriginalLines && line.originalText"
                      class="recipe-ingredient-original"
                    >{{ line.originalText }}</span>
                  </div>
                </li>
              </ul>
            </section>
          </div>
        </aside>
      </div>
      <div class="cooking-mode__ingredients-mobile-wrap">
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
                  <div class="recipe-ingredient-lines">
                    <span class="recipe-ingredient-text">{{ line.text }}</span>
                    <span
                      v-if="showDetailOriginalLines && line.originalText"
                      class="recipe-ingredient-original"
                    >{{ line.originalText }}</span>
                  </div>
                </li>
              </ul>
            </section>
          </div>
        </details>
        <button
          v-if="detailHasAnyOriginalText"
          type="button"
          class="ingredients-icon-btn cooking-mode__original-toggle"
          :class="{ 'ingredients-icon-btn--active': showDetailOriginalLines }"
          :aria-pressed="showDetailOriginalLines"
          :title="showDetailOriginalLines ? 'Originale ausblenden' : 'Originale anzeigen'"
          :aria-label="showDetailOriginalLines ? 'Originale ausblenden' : 'Originale anzeigen'"
          @click="showDetailOriginalLines = !showDetailOriginalLines"
        >
          <OriginalLanguageIcon />
        </button>
      </div>
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
            <button type="button" class="recipe-detail-nav__menu-item recipe-detail-nav__menu-edit-non-desktop" @click="detailMenuOpen = false; editFromDetail()">
              Rezept bearbeiten
            </button>
            <button
              v-if="hasRecipeUrlSource(viewingRecipe)"
              type="button"
              class="recipe-detail-nav__menu-item"
              @click="openOriginalFromMenu"
            >
              Original öffnen
            </button>
            <button
              type="button"
              class="recipe-detail-nav__menu-item"
              :disabled="timeEstimateLoading"
              @click="detailMenuOpen = false; runEstimateTimesForDetail()"
            >
              Zeiten neu schätzen
            </button>
            <button
              v-if="recipeNeedsReview(viewingRecipe.status)"
              type="button"
              class="recipe-detail-nav__menu-item"
              @click="detailMenuOpen = false; editFromDetail()"
            >
              Rezept prüfen
            </button>
            <button type="button" class="recipe-detail-nav__menu-item recipe-detail-nav__menu-danger" @click="deleteFromDetail">
              Rezept löschen
            </button>
          </div>
        </div>
      </header>

      <div class="recipe-detail-layout">
        <div
          v-if="getRecipeHeroImageUrl(viewingRecipe)"
          class="recipe-detail-hero recipe-detail-hero--mobile"
        >
          <div class="pending-media pending-media--hero">
            <img
              :src="getRecipeHeroImageUrl(viewingRecipe)!"
              :alt="viewingRecipe.title"
            />
            <button
              v-if="viewingRecipe.image_processing_pending"
              type="button"
              class="pending-media__overlay pending-media__overlay--interactive"
              @click.stop="navigateToEdit(viewingRecipe.id)"
            >
              <span class="pending-media__label">Noch nicht verarbeitet</span>
            </button>
          </div>
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
        <h1 class="recipe-detail-title">
          {{ viewingRecipe.title }}
          <button
            v-if="recipeNeedsReview(viewingRecipe.status)"
            type="button"
            class="status-chip-review recipe-detail-review-badge"
            @click="editFromDetail"
          >
            Prüfen
          </button>
        </h1>
        <p v-if="viewingRecipe.subtitle?.trim()" class="recipe-detail-subtitle">{{ viewingRecipe.subtitle }}</p>

        <!-- Mobile/tablet: simple text metadata (no icons, no dividers) -->
        <div class="recipe-detail-meta-simple">
          <div class="recipe-detail-meta-simple__content">
            <p
              v-if="detailMetaSource || !detailMetaServingsOnTimeLine"
              class="recipe-detail-meta-simple__line"
            >
              <span v-if="detailMetaSource">{{ detailMetaSource }}</span>
              <template v-if="!detailMetaServingsOnTimeLine">
                <span v-if="detailMetaSource" aria-hidden="true"> · </span>
                <span>{{ detailMetaServings }} Portionen</span>
              </template>
            </p>
            <p class="recipe-detail-meta-simple__line">
              <template v-if="detailMetaServingsOnTimeLine">
                <span>{{ detailMetaServings }} Portionen</span>
                <span aria-hidden="true"> · </span>
              </template>
              <span>{{ detailMetaPrep.value }} Vorb.</span>
              <span aria-hidden="true"> · </span>
              <span>{{ detailMetaCook.value }} Garzeit</span>
            </p>
          </div>
          <button
            type="button"
            class="recipe-detail-meta__refresh recipe-detail-meta-simple__refresh"
            :disabled="timeEstimateLoading"
            title="Zeiten neu schätzen"
            aria-label="Zeiten neu schätzen"
            :aria-busy="timeEstimateLoading"
            @click="runEstimateTimesForDetail"
          >
            <AiSparkleIcon />
          </button>
        </div>

        <!-- Desktop/tablet: structured icon metadata row -->
        <div class="recipe-detail-meta">
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
          <span class="recipe-detail-meta__sep" aria-hidden="true" />
          <div class="recipe-detail-meta__item recipe-detail-meta__item--servings">
            <svg class="recipe-detail-meta__icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <circle cx="9" cy="8" r="3" stroke="currentColor" stroke-width="1.75"/>
              <circle cx="16" cy="10" r="2.5" stroke="currentColor" stroke-width="1.75"/>
              <path d="M4 20C4 16.5 6.5 14 9 14C11 14 12.2 14.8 13 16M13 16C13.8 14.8 15 14 16.5 14C19 14 21 16 21 19" stroke="currentColor" stroke-width="1.75" stroke-linecap="round"/>
            </svg>
            <span class="recipe-detail-meta__servings">{{ detailMetaServings }}</span>
          </div>
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
          <span class="recipe-detail-meta__sep" aria-hidden="true" />
          <div class="recipe-detail-meta__item recipe-detail-meta__item--time">
            <div class="recipe-detail-meta__time-stack">
              <span class="recipe-detail-meta__time-value">{{ detailMetaCook.value }}</span>
              <span class="recipe-detail-meta__time-label">{{ detailMetaCook.label }}</span>
            </div>
          </div>
          <button
            type="button"
            class="recipe-detail-meta__refresh"
            :disabled="timeEstimateLoading"
            title="Zeiten neu schätzen"
            aria-label="Zeiten neu schätzen"
            :aria-busy="timeEstimateLoading"
            @click="runEstimateTimesForDetail"
          >
            <AiSparkleIcon />
          </button>
        </div>
        <p v-if="timeEstimateError" class="recipe-detail-time-inline-error">{{ timeEstimateError }}</p>

        <div class="recipe-detail-actions">
          <button type="button" class="recipe-detail-action recipe-detail-action--primary" @click="startCookingMode">
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
          <section v-if="viewingRecipe.description?.trim()" class="recipe-doc-section">
            <button
              v-if="descriptionClampable"
              type="button"
              class="recipe-detail-description-toggle"
              :aria-expanded="descriptionExpanded"
              aria-label="Beschreibung ein- oder ausklappen"
              @click="toggleDetailDescription"
            >
              <span
                ref="detailDescriptionEl"
                class="recipe-detail-description recipe-doc-section__text"
                :class="descriptionClampable && descriptionExpanded
                  ? 'recipe-detail-description--expanded'
                  : 'recipe-detail-description--clamp'"
              >{{ viewingRecipe.description }}</span>
            </button>
            <span
              v-else
              ref="detailDescriptionEl"
              class="recipe-detail-description recipe-doc-section__text"
              :class="descriptionClampable === null
                ? 'recipe-detail-description--clamp'
                : 'recipe-detail-description--full'"
            >{{ viewingRecipe.description }}</span>
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
                  type="button"
                  class="recipe-detail-section-refresh"
                  :disabled="healthScoreLoading"
                  :title="detailHealthScoreActionLabel"
                  :aria-label="detailHealthScoreActionLabel"
                  :aria-busy="healthScoreLoading"
                  @click="requestDetailHealthScore"
                >
                  <AiSparkleIcon />
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

            </div>
          </section>

          <section id="recipe-section-nutrition" class="recipe-doc-section">
            <div class="recipe-doc-section__head">
              <h2 class="recipe-doc-section__title">Nährwerte</h2>
              <button
                type="button"
                class="recipe-detail-section-refresh"
                :disabled="nutritionLoading"
                :title="detailNutritionActionLabel"
                :aria-label="detailNutritionActionLabel"
                :aria-busy="nutritionLoading"
                @click="requestDetailNutritionEstimate"
              >
                <AiSparkleIcon />
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
              :href="getRecipeOriginalPageUrl(viewingRecipe)!"
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
            v-if="getRecipeHeroImageUrl(viewingRecipe)"
            class="recipe-detail-hero recipe-detail-hero--desktop"
          >
            <div class="pending-media pending-media--hero">
              <img
                :src="getRecipeHeroImageUrl(viewingRecipe)!"
                :alt="viewingRecipe.title"
              />
              <button
                v-if="viewingRecipe.image_processing_pending"
                type="button"
                class="pending-media__overlay pending-media__overlay--interactive"
                @click.stop="navigateToEdit(viewingRecipe.id)"
              >
                <span class="pending-media__label">Noch nicht verarbeitet</span>
              </button>
            </div>
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
              <div class="recipe-detail-ingredients-panel__title-row">
                <h2 class="recipe-detail-ingredients-panel__title">Zutaten</h2>
                <button
                  v-if="detailHasAnyOriginalText"
                  type="button"
                  class="ingredients-icon-btn"
                  :class="{ 'ingredients-icon-btn--active': showDetailOriginalLines }"
                  :aria-pressed="showDetailOriginalLines"
                  :title="showDetailOriginalLines ? 'Originale ausblenden' : 'Originale anzeigen'"
                  :aria-label="showDetailOriginalLines ? 'Originale ausblenden' : 'Originale anzeigen'"
                  @click="showDetailOriginalLines = !showDetailOriginalLines"
                >
                  <OriginalLanguageIcon />
                </button>
              </div>
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
                    <div class="recipe-ingredient-lines">
                      <span class="recipe-ingredient-text">{{ line.text }}</span>
                      <span
                        v-if="showDetailOriginalLines && line.originalText"
                        class="recipe-ingredient-original"
                      >{{ line.originalText }}</span>
                    </div>
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

</template>

<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount, watch, nextTick } from 'vue'
import AiSparkleIcon from '../components/icons/AiSparkleIcon.vue'
import OriginalLanguageIcon from '../components/icons/OriginalLanguageIcon.vue'
import { useRoute, useRouter } from 'vue-router'
import Fuse from 'fuse.js'
import type { IFuseOptions } from 'fuse.js'
import {
  listRecipesWithIngredients,
  listRecipesWithIngredientsFiltered,
  getRecipe,
  updateRecipe,
  deleteRecipe,
  estimateRecipeNutrition,
  postRecipeHealthScore,
  postRecipeCooked,
  getRecipeHistory,
  setRecipeFavorite,
  estimateRecipeTimes,
} from '../api/recipes'
import { getIngredientCategoryLabelDe } from '../constants/ingredientCategories'
import type {
  Recipe,
  RecipeListItemWithIngredients,
  RecipeHealthScoreResponse,
  RecipeTimeEstimateSuccess,
  RecipeTimeSource,
} from '../api/recipes'
import { getPerServingValue } from '../utils/nutrition'
import { getRecipeCardImageUrl, getRecipeHeroImageUrl } from '../utils/recipeDisplayImage'
import { recipeNeedsReview } from '../utils/recipeStatusLabel'
import { formatRecipeCardMeta } from '../utils/recipeCardMeta'
import {
  formatRecipeSourceMeta,
  getRecipeOriginalPageUrl,
  isManagedBookSource,
  isRecipeWebsiteSource,
} from '../utils/recipeSourceLabel'
import {
  formatRecipeDetailSourceMeta,
  formatDetailServingsCount,
  formatDetailPrepMeta,
  formatDetailCookMeta,
  getRecipeDetailSourceKind,
  type DetailTimeMeta,
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
const searchQuery = ref('')
const sortBy = ref<'title-asc' | 'title-desc' | 'updated-desc' | 'updated-asc'>('updated-desc')
const activeFilter = ref(
  props.favoritesOnly ? 'favorites' : (typeof route.query.filter === 'string' ? route.query.filter : 'all')
)
const cookingStepIndex = ref(0)
const detailDescriptionEl = ref<HTMLElement | null>(null)
const descriptionClampable = ref<boolean | null>(null)
const descriptionExpanded = ref(false)

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

  type IngredientLine = { text: string; originalText: string | null; category: string | null }
  const sections: { heading: string | null; key: string; items: IngredientLine[] }[] = []
  const pushToSection = (
    heading: string | null,
    key: string,
    text: string,
    originalText: string | null = null,
    category: string | null = null
  ) => {
    let section = sections.length ? sections[sections.length - 1] : null
    if (!section || section.key !== key) {
      sections.push({ heading, key, items: [] })
      section = sections[sections.length - 1]
    }
    section.items.push({ text, originalText, category })
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
      const cat = ing.category?.trim() ? ing.category.trim() : null
      const originalText = (ing.original_text || '').trim() || null
      const amountText = formatAmountRange(ing.amount ?? null, ing.amount_max ?? null)
      const ingredientName = (ing.name || ing.ingredient || '').trim()
      const additional = ing.additional_info ? ` (${ing.additional_info})` : ''
      const text = ([amountText, ing.unit ?? null, ingredientName].filter(Boolean).join(' ').trim() + additional).trim()
      if (text) {
        const key = `section-${ing.section_id ?? 'manual'}-${ing.section_heading ?? 'no-heading'}`
        pushToSection(ing.section_heading ?? null, key, text, originalText, cat)
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
        const originalText = (item.originalText || '').trim() || null
        let text = [amountText, item.unit ?? null, ingredientName]
          .filter(Boolean)
          .join(' ')
          .trim()
        text = (text + additional).trim()

        if (text) pushToSection(section.heading ?? null, sectionKey, text, originalText, cat)
      }
    })
  }

  return sections
})
const showAddMenu = ref(false)
const addMenuAnchorRef = ref<HTMLElement | null>(null)
const viewingRecipe = ref<Recipe | null>(null)
const displayServings = ref<number>(1)
const showDetailOriginalLines = ref(false)
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

const hasDetailHealthScore = computed(() => healthScoreResult.value?.estimate.healthScore != null)

const detailHealthScoreActionLabel = computed(() =>
  hasDetailHealthScore.value ? 'Gesundheitscheck neu berechnen' : 'Gesundheitscheck holen'
)

const detailNutritionActionLabel = computed(() =>
  hasNutrition.value ? 'Nährwerte neu schätzen' : 'Nährwerte schätzen'
)

const detailMetaSource = computed(() => {
  const recipe = viewingRecipe.value
  if (!recipe) return null
  return formatRecipeDetailSourceMeta(recipe)
})

const DETAIL_META_EMPTY = '-'

const detailMetaServings = computed(
  () => formatDetailServingsCount(viewingRecipe.value?.servings) ?? DETAIL_META_EMPTY
)

const detailMetaSourceKind = computed(() => {
  const recipe = viewingRecipe.value
  if (!recipe) return 'unknown' as const
  return getRecipeDetailSourceKind(recipe)
})

/** Mobile/tablet simple meta: book sources show servings on the prep/cook line. */
const detailMetaServingsOnTimeLine = computed(() => hasRecipeBookSource(viewingRecipe.value))

const detailMetaPrep = computed(
  (): DetailTimeMeta =>
    formatDetailPrepMeta(viewingRecipe.value) ?? { value: DETAIL_META_EMPTY, label: 'VORB.' }
)

const detailMetaCook = computed(
  (): DetailTimeMeta =>
    formatDetailCookMeta(viewingRecipe.value) ?? { value: DETAIL_META_EMPTY, label: 'GARZEIT' }
)

const detailHasAnyOriginalText = computed(() => {
  const recipe = viewingRecipe.value
  if (!recipe) return false
  if (recipe.ingredients?.some((i) => (i.original_text || '').trim())) return true
  for (const section of recipe.parsed_recipe?.ingredientsSections ?? []) {
    for (const item of section.items ?? []) {
      if ((item.originalText || '').trim()) return true
    }
  }
  return false
})

const ingredientSections = computed(() => {
  const recipe = viewingRecipe.value
  if (!recipe) return []

  const originalServings = recipe.servings || 1
  const scale = displayServings.value / originalServings

  type IngredientLine = { text: string; originalText: string | null; category: string | null }
  const sections: { heading: string | null; key: string; items: IngredientLine[] }[] = []
  const pushToSection = (
    heading: string | null,
    key: string,
    text: string,
    originalText: string | null = null,
    category: string | null = null
  ) => {
    let section = sections.length ? sections[sections.length - 1] : null
    if (!section || section.key !== key) {
      sections.push({ heading, key, items: [] })
      section = sections[sections.length - 1]
    }
    section.items.push({ text, originalText, category })
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
      const cat = ing.category?.trim() ? ing.category.trim() : null
      const originalText = (ing.original_text || '').trim() || null
      const amountText = formatAmountRange(ing.amount ?? null, ing.amount_max ?? null)
      const ingredientName = (ing.name || ing.ingredient || '').trim()
      const additional = ing.additional_info ? ` (${ing.additional_info})` : ''
      const text = ([amountText, ing.unit ?? null, ingredientName].filter(Boolean).join(' ').trim() + additional).trim()
      if (text) {
        const key = `section-${ing.section_id ?? 'manual'}-${ing.section_heading ?? 'no-heading'}`
        pushToSection(ing.section_heading ?? null, key, text, originalText, cat)
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
        const originalText = (item.originalText || '').trim() || null
        let text = [amountText, item.unit ?? null, ingredientName]
          .filter(Boolean)
          .join(' ')
          .trim()
        text = (text + additional).trim()

        if (text) pushToSection(section.heading ?? null, sectionKey, text, originalText, cat)
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
    descriptionClampable.value = null
    descriptionExpanded.value = false
    showDetailOriginalLines.value = false
    healthScoreResult.value = viewingRecipe.value.health_score ?? null
    healthScoreError.value = ''
    document.title = `${viewingRecipe.value.title} – Rezeptbibliothek`
    await measureDetailDescriptionClamp()
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
  const recipe = viewingRecipe.value
  if (!recipe) return
  const url = getRecipeOriginalPageUrl(recipe)
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
  return isRecipeWebsiteSource(recipe) && !!getRecipeOriginalPageUrl(recipe)
}

function applyEstimateResultToUi(recipeId: number, res: RecipeTimeEstimateSuccess) {
  if (viewingRecipe.value?.id === recipeId) {
    viewingRecipe.value = res.recipe
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
    timeEstimateError.value = e instanceof Error ? e.message : 'Zeitschätzung fehlgeschlagen'
  } finally {
    timeEstimateLoading.value = false
  }
}

function runEstimateTimesForDetail() {
  const id = viewingRecipe.value?.id
  if (id == null) return
  void runEstimateTimesFlow(id)
}

function toggleDetailDescription() {
  if (!descriptionClampable.value) return
  descriptionExpanded.value = !descriptionExpanded.value
}

async function measureDetailDescriptionClamp() {
  descriptionExpanded.value = false
  descriptionClampable.value = null
  await nextTick()
  const el = detailDescriptionEl.value
  if (!el || !viewingRecipe.value?.description?.trim()) {
    descriptionClampable.value = false
    return
  }
  const needsClamp = el.scrollHeight > el.clientHeight + 1
  descriptionClampable.value = needsClamp
  if (needsClamp) {
    await nextTick()
  }
}

function clearDetailState() {
  viewingRecipe.value = null
  displayServings.value = 1
  descriptionClampable.value = null
  descriptionExpanded.value = false
  showDetailOriginalLines.value = false
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

function navigateToEdit(id: number) {
  const from =
    isDetailRoute.value && viewingRecipe.value?.id === id
      ? route.fullPath
      : `${listPath.value}/${id}`
  router.push({
    name: 'recipe-edit',
    params: { id: String(id) },
    query: { from },
  })
}

function editFromDetail() {
  if (viewingRecipe.value) {
    navigateToEdit(viewingRecipe.value.id)
  }
}

function toggleAddMenu() {
  showAddMenu.value = !showAddMenu.value
}

function closeAddMenu() {
  showAddMenu.value = false
}

function onAddMenuChoice(kind: 'image' | 'url' | 'manual') {
  closeAddMenu()
  if (kind === 'image') router.push({ name: 'add-image', query: { mode: 'upload' } })
  else if (kind === 'url') router.push({ name: 'add-url' })
  else router.push({ name: 'recipe-edit', params: { id: 'new' } })
}

function onDocumentClickForAddMenu(event: MouseEvent) {
  if (!showAddMenu.value) return
  const anchor = addMenuAnchorRef.value
  if (anchor && !anchor.contains(event.target as Node)) {
    closeAddMenu()
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
      router.replace({ name: 'recipe-edit', params: { id: 'new' }, query: route.query })
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
      router.replace({
        name: 'recipe-edit',
        params: { id: String(id) },
        query: { from: `${listPath.value}/${id}` },
      })
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
  window.addEventListener('resize', onDetailDescriptionResize)
})

function onDetailDescriptionResize() {
  if (!viewingRecipe.value?.description?.trim()) return
  void measureDetailDescriptionClamp()
}

watch(
  () => props.favoritesOnly,
  async () => {
    await loadList()
    // Avoid showing stale detail/edit state from the previous listing filter.
    clearDetailState()
    displayServings.value = 1
  }
)

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
  window.removeEventListener('resize', onDetailDescriptionResize)
  releaseCookingWakeLock()
})
</script>

<style scoped>
.recipes-view {
  max-width: none;
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

.btn:not(.recipe-detail-action) {
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

.btn--primary:not(.recipe-detail-action) {
  background: var(--color-btn-primary-bg);
  color: var(--color-btn-primary-fg);
  box-shadow: var(--shadow-sm);
}

.btn--primary:not(.recipe-detail-action):hover {
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
  order: 4;
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
  order: 3;
  min-width: 0;
  padding: 0 var(--content-padding-mobile);
}

/* Tablet portrait: summary left, compact image right; single-column body below */
@media (min-width: 768px) and (max-width: 1099px) {
  .recipe-detail-layout {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(260px, 42%);
    column-gap: clamp(24px, 4vw, 48px);
    row-gap: var(--spacing-md);
    align-items: start;
    max-width: 1280px;
    margin: 0 auto;
  }

  .recipe-detail-main-col {
    display: contents;
  }

  .recipe-detail-hero--mobile {
    display: none;
  }

  .recipe-detail-identity {
    grid-column: 1;
    grid-row: 1;
    order: unset;
    padding: 0;
    align-self: start;
    min-width: 0;
  }

  .recipe-detail-side-panel {
    display: contents;
    order: unset;
    position: static;
    border-left: none;
    padding-left: 0;
  }

  .recipe-detail-side-panel::before {
    display: none;
  }

  .recipe-detail-hero--desktop {
    display: block;
    grid-column: 2;
    grid-row: 1;
    margin-bottom: 0;
    min-width: 0;
    border-radius: var(--recipe-detail-radius);
  }

  .recipe-detail-hero--desktop img {
    display: block;
    width: 100%;
    height: clamp(240px, 32vw, 340px);
    max-height: 340px;
    object-fit: cover;
    object-position: center;
    border-radius: var(--recipe-detail-radius);
  }

  .recipe-detail-hero--desktop .recipe-detail-pending-hero {
    min-height: clamp(240px, 32vw, 340px);
    max-height: 340px;
    border-radius: var(--recipe-detail-radius);
  }

  .recipe-detail-ingredients-panel {
    grid-column: 1 / -1;
    grid-row: 3;
    padding: 0;
    margin-top: var(--spacing-sm);
  }

  .recipe-detail-ingredients-scroll {
    overflow: visible;
    max-height: none;
  }

  .recipe-detail-main {
    grid-column: 1 / -1;
    grid-row: 2;
    order: unset;
    padding: 0;
    margin-top: var(--spacing-md);
  }
}

@media (min-width: 1100px) {
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

.recipe-detail-ingredients-panel__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--spacing-sm);
  margin-bottom: var(--spacing-md);
}

.recipe-detail-ingredients-panel__title-row {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  min-width: 0;
}

.recipe-detail-ingredients-panel__title {
  margin: 0;
  font-size: 0.95rem;
  font-weight: 650;
  color: var(--color-text);
}

.recipe-detail-ingredients-panel .ingredients-icon-btn,
.cooking-mode .ingredients-icon-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2rem;
  height: 2rem;
  padding: 0;
  border: 1px solid transparent;
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--color-text-muted);
  cursor: pointer;
}

.recipe-detail-ingredients-panel .ingredients-icon-btn {
  margin-left: 5px;
}

.recipe-detail-ingredients-panel .ingredients-icon-btn svg,
.cooking-mode .ingredients-icon-btn svg {
  width: 1.05rem;
  height: 1.05rem;
}

.recipe-detail-ingredients-panel .ingredients-icon-btn:hover,
.cooking-mode .ingredients-icon-btn:hover {
  color: var(--color-text);
  background: var(--color-surface-subtle);
  border-color: var(--color-border);
}

.recipe-detail-ingredients-panel .ingredients-icon-btn--active,
.cooking-mode .ingredients-icon-btn--active {
  color: var(--color-primary);
  background: color-mix(in srgb, var(--color-primary) 10%, transparent);
  border-color: color-mix(in srgb, var(--color-primary) 28%, transparent);
}

.recipe-ingredient-lines {
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
  min-width: 0;
}

.recipe-ingredient-original {
  font-size: 0.78rem;
  color: var(--color-text-muted);
  font-style: italic;
  line-height: 1.4;
  word-break: break-word;
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
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 1.75rem;
  height: 1.75rem;
  padding: 0;
  border: none;
  border-radius: var(--radius-xs);
  background: transparent;
  color: var(--color-text-soft);
  font-size: 0.95rem;
  line-height: 1;
  cursor: pointer;
}

.recipe-detail-section-refresh svg,
.recipe-detail-meta__refresh svg {
  width: 1.25rem;
  height: 1.25rem;
  flex-shrink: 0;
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

.recipe-detail-action.recipe-detail-action--edit-desktop {
  display: none;
}

@media (min-width: 1024px) {
  .recipe-detail-action.recipe-detail-action--edit-desktop {
    display: inline-flex;
  }
}

.recipe-detail-review-badge {
  vertical-align: middle;
  margin-left: var(--spacing-sm);
  white-space: nowrap;
  cursor: pointer;
  transition: background var(--transition-fast), border-color var(--transition-fast);
}

.recipe-detail-review-badge:hover {
  background: color-mix(in srgb, var(--color-warning-soft) 70%, var(--color-warning) 8%);
  border-color: color-mix(in srgb, var(--color-warning) 35%, transparent);
}

.recipe-detail-review-badge:focus-visible {
  outline: 2px solid color-mix(in srgb, var(--color-warning) 45%, transparent);
  outline-offset: 2px;
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

/* Mobile/tablet simple text metadata */
.recipe-detail-meta-simple {
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: var(--spacing-sm);
  margin-top: var(--spacing-sm);
  margin-bottom: var(--spacing-md);
}

.recipe-detail-meta-simple__content {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.recipe-detail-meta-simple__refresh {
  flex-shrink: 0;
  margin-left: 0;
}

.recipe-detail-meta-simple__line {
  margin: 0;
  font-size: 0.875rem;
  color: var(--color-text-muted);
  line-height: 1.4;
}

@media (min-width: 1100px) {
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

@media (min-width: 1100px) {
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

@media (max-width: 767px) {
  .recipe-detail-actions {
    width: 100%;
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

.recipe-detail-description-toggle {
  display: block;
  width: 100%;
  margin: 0;
  padding: 0;
  border: none;
  background: none;
  font: inherit;
  text-align: left;
  color: inherit;
  cursor: pointer;
}

.recipe-detail-description-toggle:focus-visible {
  outline: 2px solid color-mix(in srgb, var(--color-accent) 55%, transparent);
  outline-offset: 2px;
  border-radius: 2px;
}

.recipe-detail-description--clamp {
  display: -webkit-box;
  -webkit-line-clamp: 3;
  line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
  white-space: normal;
}

.recipe-detail-description--full,
.recipe-detail-description--expanded {
  display: block;
  overflow: visible;
  white-space: pre-wrap;
}

@media (max-width: 767px) {
  .recipe-detail-description {
    text-align: justify;
    hyphens: auto;
  }
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

.cooking-mode__aside-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--spacing-sm);
  margin-bottom: var(--spacing-md);
}

.cooking-mode__original-toggle {
  flex-shrink: 0;
}

.cooking-mode__ingredients-mobile-wrap {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--spacing-sm);
  margin-top: var(--spacing-lg);
  padding: var(--spacing-md) 0 0;
  border-top: 1px solid var(--color-border);
}

.cooking-mode__ingredients-mobile {
  flex: 1;
  min-width: 0;
  margin-top: 0;
  padding: 0;
  border-top: none;
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
    margin: 0;
    font-size: 0.95rem;
    font-weight: 650;
    color: var(--color-text);
  }

  .cooking-mode__ingredient-list {
    font-size: 0.9375rem;
    line-height: 1.45;
    color: var(--color-text-muted);
  }

  .cooking-mode__ingredients-mobile-wrap {
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

}

@media (max-width: 480px) {
  .recipe-nutrition {
    grid-template-columns: 1fr;
  }
}
</style>
