<template>
  <div class="recipe-form-multi">
    <div v-if="editingStatus === 'draft'" class="editor-review-notice" role="region" aria-label="Rezept prüfen">
      <div class="editor-review-notice__row">
        <p class="editor-review-notice__text">
          Automatisch erkannt · Bitte Zutaten und Zubereitung prüfen.
        </p>
        <button
          type="button"
          class="btn btn--secondary recipe-detail-action recipe-detail-action--secondary editor-review-notice__action"
          @click="emit('confirm')"
        >
          Als geprüft markieren
        </button>
      </div>
    </div>

    <nav class="editor-sections" role="tablist" aria-label="Rezeptbereiche">
      <button
        v-for="(step, idx) in steps"
        :key="step.id"
        type="button"
        role="tab"
        class="editor-sections__tab"
        :class="{ 'editor-sections__tab--active': idx === currentStep }"
        :aria-selected="idx === currentStep"
        @click="goToStep(idx)"
      >
        <span class="editor-sections__label">{{ step.label }}</span>
        <span
          v-if="sectionNavAttention(idx) === 'prüfen'"
          class="editor-sections__hint editor-sections__hint--review"
        >Prüfen</span>
        <span
          v-else-if="sectionNavAttention(idx) === 'fehlt'"
          class="editor-sections__hint editor-sections__hint--missing"
        >Fehlt</span>
      </button>
    </nav>

    <!-- Form Content -->
    <form class="form-content" @submit.prevent="onSubmitForm">
      <!-- Step 1: Basic Info -->
      <div v-if="currentStep === 0" class="form-step">
        <!-- Recipe Image Upload -->
        <div class="form-section form-section--image document-section">
          <h4 class="form-section__title">Rezeptbild</h4>
          <div class="image-upload">
            <div v-if="(currentImageUrl && currentImageUrl !== '__DELETE__') || imagePreview" class="image-upload__preview">
              <button
                v-if="imageProcessingPending && currentImageUrl && currentImageUrl !== '__DELETE__' && !imagePreview"
                type="button"
                class="image-upload__preview-pending"
                @click="openCropModal('existing')"
              >
                <span class="image-upload__pending-icon" aria-hidden="true">
                  <svg viewBox="0 0 24 24" fill="none">
                    <rect x="3" y="3" width="18" height="18" rx="2" stroke="currentColor" stroke-width="2" />
                    <circle cx="8.5" cy="8.5" r="1.5" stroke="currentColor" stroke-width="2" />
                    <path d="M21 15L16 10L5 21" stroke="currentColor" stroke-width="2" />
                  </svg>
                </span>
                <span class="image-upload__pending-text">Bild noch nicht verarbeitet — tippen zum Zuschneiden und Optimieren</span>
              </button>
              <template v-else>
                <img :src="(imagePreview || currentImageUrl) ?? undefined" alt="Rezeptvorschau" class="image-upload__preview-img" />
                <div class="image-upload__preview-icons">
                  <button
                    v-if="imageFile"
                    type="button"
                    class="icon-btn"
                    title="Bild drehen"
                    @click="rotateNewImage"
                  >
                    ↻
                  </button>
                  <button type="button" class="icon-btn" title="Zuschneiden" @click="openCropModal(imageFile ? 'new' : 'existing')">
                    ▢
                  </button>
                </div>
                <span v-if="hasCropSet" class="image-upload__crop-badge">Zuschnitt gesetzt</span>
              </template>
              <button
                type="button"
                class="image-upload__remove"
                @click="removeImage"
                title="Bild entfernen"
              >
                <svg viewBox="0 0 24 24" fill="none">
                  <path d="M18 6L6 18M6 6L18 18" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
              </button>
            </div>
            <div v-else class="image-upload__placeholder">
              <svg viewBox="0 0 24 24" fill="none">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                <circle cx="8.5" cy="8.5" r="1.5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                <path d="M21 15L16 10L5 21" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
              <p>Noch kein Bild</p>
            </div>
            <input
              ref="imageInputRef"
              type="file"
              accept="image/*"
              class="image-upload__input"
              @change="onImageSelected"
            />
            <div class="image-upload__actions">
              <button
                type="button"
                class="btn btn--secondary"
                @click="imageInputRef?.click()"
              >
                <svg viewBox="0 0 24 24" fill="none">
                  <path d="M21 15V19C21 19.5304 20.7893 20.0391 20.4142 20.4142C20.0391 20.7893 19.5304 21 19 21H5C4.46957 21 3.96086 20.7893 3.58579 20.4142C3.21071 20.0391 3 19.5304 3 19V15" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                  <path d="M17 8L12 3L7 8" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                  <path d="M12 3V15" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
                {{ (currentImageUrl && currentImageUrl !== '__DELETE__') || imagePreview ? 'Bild ändern' : 'Bild hochladen' }}
              </button>
            </div>
          </div>
          <label v-if="imageFile && imagePreview" class="image-upload__defer">
            <input v-model="deferImageProcessing" type="checkbox" />
            <span>Original jetzt hochladen; Zuschnitt und Optimierung später (empfohlen für Handyfotos)</span>
          </label>
          <p v-if="cropError" class="image-upload__crop-error">{{ cropError }}</p>
        </div>

        <CropPerspectiveModal
          :open="cropModalOpen"
          :src="cropModalSrc"
          title="Rezeptbild zuschneiden"
          alt="Rezeptbild Zuschnitt"
          :initial-natural-points="cropModalInitialPoints"
          @confirm="onCropModalConfirm"
          @cancel="closeCropModal"
        />

        <div class="form-field form-field--required">
          <label for="recipe-title">Rezepttitel</label>
          <input
            id="recipe-title"
            v-model="form.title"
            type="text"
            required
            placeholder="z. B. Omas Apfelkuchen"
            class="form-input"
          />
        </div>

        <div class="form-field">
          <label for="recipe-subtitle">Untertitel</label>
          <input
            id="recipe-subtitle"
            v-model="form.subtitle"
            type="text"
            placeholder="Kurzer Untertitel (optional)"
            class="form-input"
          />
        </div>

        <div class="form-field">
          <label for="recipe-description">Beschreibung</label>
          <textarea
            id="recipe-description"
            v-model="form.description"
            rows="3"
            placeholder="Kurze Einleitung oder Geschichte zum Rezept"
            class="form-textarea"
          />
        </div>

        <div class="form-row">
          <div class="form-field">
            <label for="recipe-servings">Portionen</label>
            <input
              id="recipe-servings"
              v-model.number="form.servings"
              type="number"
              min="1"
              step="1"
              placeholder="4"
              class="form-input"
            />
          </div>
        </div>
        <div
          class="form-row form-row--prep-cook-estimate"
          :class="{ 'form-row--prep-cook-estimate--with-refresh': editingId != null && hasPrepOrCookTimes }"
        >
          <div class="form-field">
            <label for="recipe-prep-time">Vorbereitung (Min.)</label>
            <input
              id="recipe-prep-time"
              v-model.number="form.prep_time"
              type="number"
              min="0"
              placeholder="15"
              class="form-input"
            />
          </div>
          <div class="form-field">
            <label for="recipe-cook-time">Garzeit (Min.)</label>
            <input
              id="recipe-cook-time"
              v-model.number="form.cook_time"
              type="number"
              min="0"
              placeholder="30"
              class="form-input"
            />
          </div>
          <div v-if="editingId != null && hasPrepOrCookTimes" class="form-field form-field--estimate-refresh">
            <span class="form-field__label-spacer" aria-hidden="true"></span>
            <button
              type="button"
              class="editor-estimate-refresh"
              :disabled="timeEstimateLoading"
              title="Zeiten neu schätzen"
              aria-label="Zeiten neu schätzen"
              @click="emit('estimateTimes')"
            >
              ↻
            </button>
          </div>
        </div>
        <p v-if="estimateHints.times" class="editor-estimate-hint" role="status">
          {{ estimateHints.times }}
          <button
            type="button"
            class="btn btn--ghost btn--tiny editor-estimate-retry"
            :disabled="timeEstimateLoading"
            @click="emit('estimateTimes')"
          >
            Erneut versuchen
          </button>
        </p>

        <div class="form-row">
          <div class="form-field">
            <label for="would-cook-again">Würdest du es wieder kochen?</label>
            <select id="would-cook-again" v-model="form.would_cook_again" class="form-input">
              <option :value="null">— Nicht gesetzt —</option>
              <option value="yes">Ja</option>
              <option value="maybe">Vielleicht</option>
              <option value="no">Nein</option>
            </select>
          </div>
        </div>

        <div class="form-section document-section">
          <h4 class="form-section__title">Tags</h4>
          <TagInput v-model="form.tags" :options="allAllowedTags" :format-label="formatTagLabel" />
          <div v-if="editingId != null" class="form-field">
            <button
              type="button"
              class="btn btn--secondary"
              :disabled="tagGenerateLoading"
              @click="emit('generateTags')"
            >
              {{ tagGenerateLoading ? 'Tags werden vorgeschlagen…' : 'Tags vorschlagen' }}
            </button>
          </div>
        </div>

        <div
          v-if="editingId != null && (hasHealthScore || estimateHints.health)"
          class="form-section document-section editor-health-section"
        >
          <div class="form-section__head">
            <h4 class="form-section__title">Gesundheitscheck</h4>
            <button
              v-if="hasHealthScore"
              type="button"
              class="editor-estimate-refresh"
              :disabled="healthEstimateLoading"
              title="Gesundheitscheck neu berechnen"
              aria-label="Gesundheitscheck neu berechnen"
              @click="emit('estimateHealth')"
            >
              ↻
            </button>
          </div>
          <div v-if="hasHealthScore" class="editor-health-summary">
            <span class="editor-health-score">{{ healthScoreValue }}</span>
            <span class="editor-health-score-max">/ 100</span>
            <p v-if="healthScoreSummary" class="editor-health-summary__text meta-text">{{ healthScoreSummary }}</p>
          </div>
          <p v-if="estimateHints.health" class="editor-estimate-hint" role="status">
            {{ estimateHints.health }}
            <button
              type="button"
              class="btn btn--ghost btn--tiny editor-estimate-retry"
              :disabled="healthEstimateLoading"
              @click="emit('estimateHealth')"
            >
              Erneut versuchen
            </button>
          </p>
        </div>

        <!-- Source -->
        <div class="form-section document-section source-section">
          <h4 class="form-section__title">Quelle</h4>

          <!-- Case A: primary website source -->
          <div v-if="sourceUiCase === 'website'" class="source-block">
            <p class="source-block__kind">Website</p>
            <div class="source-link-row">
              <a
                :href="websiteLinkHref"
                target="_blank"
                rel="noopener noreferrer"
                class="source-link-row__link"
              >{{ websiteDisplayDomain }}</a>
              <button
                type="button"
                class="source-link-row__edit"
                title="Original-URL bearbeiten"
                aria-label="Original-URL bearbeiten"
                @click="showUrlEdit = !showUrlEdit"
              >
                <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path d="M12 20h9M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
              </button>
            </div>
            <button
              v-if="!showBookPicker"
              type="button"
              class="btn btn--ghost btn--small source-block__action"
              @click="openBookPicker"
            >
              Mit Kochbuch verknüpfen
            </button>
          </div>

          <!-- Case B: primary cookbook source -->
          <div v-else-if="sourceUiCase === 'book'" class="source-block">
            <p class="source-block__kind">Kochbuch</p>
            <div v-if="!showBookPicker" class="source-book-card">
              <div class="source-book-card__cover">
                <img v-if="primaryBookCover" :src="primaryBookCover" :alt="primaryBookTitle" />
                <span v-else aria-hidden="true">?</span>
              </div>
              <div class="source-book-card__meta">
                <div class="source-book-card__title">{{ primaryBookTitle }}</div>
                <div v-if="primaryBookSubtitle" class="source-book-card__subtitle">{{ primaryBookSubtitle }}</div>
                <div v-if="primaryBookMetaLine" class="source-book-card__line meta-text">{{ primaryBookMetaLine }}</div>
                <div v-if="form.source_page.trim()" class="source-book-card__line meta-text">
                  Seite {{ form.source_page.trim() }}
                </div>
              </div>
            </div>
            <div v-if="!showBookPicker" class="source-block__inline-actions">
              <button type="button" class="btn btn--ghost btn--tiny" @click="openBookPicker">Ändern</button>
              <button type="button" class="btn btn--ghost btn--tiny" @click="unlinkBookSource">Entfernen</button>
            </div>
            <div v-if="!showBookPicker" class="form-field source-page-field">
              <label for="source-page-inline">Seitenzahl</label>
              <input
                id="source-page-inline"
                v-model="form.source_page"
                type="text"
                placeholder="z. B. 42"
                class="form-input form-input--small"
              />
            </div>
            <div v-if="hasOriginalUrl && !showBookPicker" class="source-original-link">
              <p class="source-block__kind source-block__kind--secondary">Original-Link</p>
              <div class="source-link-row">
                <a
                  :href="originalLinkHref"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="source-link-row__link"
                >{{ originalLinkDomain }}</a>
                <button
                  type="button"
                  class="source-link-row__edit"
                  title="Original-URL bearbeiten"
                  aria-label="Original-URL bearbeiten"
                  @click="showUrlEdit = !showUrlEdit"
                >
                  <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <path d="M12 20h9M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                  </svg>
                </button>
              </div>
            </div>
          </div>

          <!-- Case C: original URL only -->
          <div v-else-if="sourceUiCase === 'original-only'" class="source-block">
            <p class="source-block__kind">Original-Link</p>
            <div class="source-link-row">
              <a
                :href="originalLinkHref"
                target="_blank"
                rel="noopener noreferrer"
                class="source-link-row__link"
              >{{ originalLinkDomain }}</a>
              <button
                type="button"
                class="source-link-row__edit"
                title="Original-URL bearbeiten"
                aria-label="Original-URL bearbeiten"
                @click="showUrlEdit = !showUrlEdit"
              >
                <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path d="M12 20h9M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
              </button>
            </div>
            <button
              v-if="!showBookPicker"
              type="button"
              class="btn btn--ghost btn--small source-block__action"
              @click="openBookPicker"
            >
              Mit Kochbuch verknüpfen
            </button>
          </div>

          <!-- Case D: manual -->
          <div v-else class="source-block">
            <p class="source-block__kind">Manuell</p>
            <div v-if="!showBookPicker && !showUrlEdit" class="source-block__inline-actions">
              <button type="button" class="btn btn--ghost btn--small" @click="openBookPicker">Mit Kochbuch verknüpfen</button>
              <button type="button" class="btn btn--ghost btn--small" @click="showUrlEdit = true">Original-URL hinzufügen</button>
            </div>
          </div>

          <div v-if="showUrlEdit" class="source-url-edit form-field">
            <label for="source-original-url">Original-URL</label>
            <input
              id="source-original-url"
              v-model="originalPageUrl"
              type="url"
              inputmode="url"
              placeholder="https://example.com/rezept"
              class="form-input"
            />
            <button type="button" class="btn btn--ghost btn--tiny" @click="showUrlEdit = false">Fertig</button>
          </div>

          <div v-if="showBookPicker" class="source-book-picker">
            <div class="source-books">
              <div
                v-for="source in cookbookSources"
                :key="source.id"
                class="source-book"
                :class="{ 'source-book--selected': selectedSourceId === source.id }"
                @click="selectBookFromPicker(source.id)"
              >
                <div class="source-book__cover">
                  <img v-if="source.image_path" :src="source.image_path" :alt="source.name" />
                  <span v-else>?</span>
                </div>
                <div class="source-book__info">
                  <div class="source-book__title">{{ source.name }}</div>
                  <div v-if="source.subtitle" class="source-book__subtitle">{{ source.subtitle }}</div>
                </div>
              </div>
            </div>
            <router-link to="/sources" class="link-secondary">+ Neues Kochbuch</router-link>
            <div v-if="pickerBookSelected" class="form-field">
              <label for="source-page">Seitenzahl</label>
              <input
                id="source-page"
                v-model="form.source_page"
                type="text"
                placeholder="z. B. 42"
                class="form-input form-input--small"
              />
            </div>
            <button type="button" class="btn btn--ghost btn--tiny" @click="closeBookPicker">Abbrechen</button>
          </div>
        </div>

      </div>

      <!-- Step 2: Ingredients -->
      <div
        v-if="currentStep === 1"
        class="form-step form-step--ingredients"
        :class="{ 'form-step--ingredients--ocr-open': showFullOcrText && !!fullOriginalText }"
      >
        <div class="ingredients-step__layout">
          <div class="ingredients-step__main">
            <div class="ingredients-list-header">
              <div class="ingredients-list-header__actions">
                <button
                  v-if="hasAnyOriginalText"
                  type="button"
                  class="ingredients-icon-btn"
                  :class="{ 'ingredients-icon-btn--active': showOriginalLines }"
                  :aria-pressed="showOriginalLines"
                  :title="showOriginalLines ? 'Originale ausblenden' : 'Originale anzeigen'"
                  :aria-label="showOriginalLines ? 'Originale ausblenden' : 'Originale anzeigen'"
                  @click="showOriginalLines = !showOriginalLines"
                >
                  <OriginalLanguageIcon />
                </button>
              </div>
            </div>

            <div
              v-if="showFullOcrText && fullOriginalText"
              class="ingredients-ocr-mobile"
              role="region"
              aria-label="Originaltext"
            >
              <pre class="original-text-panel__body">{{ fullOriginalText }}</pre>
            </div>

        <div v-for="group in ingredientsBySection" :key="group.id" class="ingredient-section">
          <div v-if="group.id === UNGROUPED_SECTION_ID" class="ingredient-section__ungrouped-header">
            <span class="ingredient-section__ungrouped-title">Ohne Gruppe</span>
          </div>
          <div v-else class="ingredient-section__heading-row">
            <input
              :id="`group-heading-${group.id}`"
              type="text"
              class="ingredient-section__heading-input"
              :value="group.heading ?? ''"
              placeholder="Gruppenname"
              aria-label="Gruppenname"
              @input="updateSectionHeading(group.id, ($event.target as HTMLInputElement).value)"
            />
            <button
              v-if="canDeleteIngredientGroup(group)"
              type="button"
              class="ingredients-icon-btn ingredients-icon-btn--subtle"
              title="Leere Gruppe entfernen"
              aria-label="Leere Gruppe entfernen"
              @click="deleteIngredientGroup(group.id)"
            >
              <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M18 6L6 18M6 6L18 18" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
              </svg>
            </button>
          </div>

          <div
            class="ingredient-section__list"
            @dragover.prevent="onIngredientSectionDragOver($event, group.id)"
            @dragleave="onIngredientSectionDragLeave"
            @drop.prevent="onIngredientSectionDrop($event, group.id)"
          >
            <template v-for="item in group.items" :key="item.ing.client_id">
              <div
                v-if="showIngredientDropLineBefore(item)"
                class="ingredient-drop-line"
                aria-hidden="true"
              />
              <div
                class="ingredient-card"
                :data-ingredient-client-id="item.ing.client_id"
                :class="{
                  'ingredient-card--editing': isIngredientEditing(item.flatIndex),
                  'ingredient-card--dragging': ingredientDragFromClientId === item.ing.client_id,
                }"
              >
            <div v-if="!isIngredientEditing(item.flatIndex)" class="ingredient-card__view">
              <button
                type="button"
                class="ingredient-card__drag-handle"
                :draggable="desktopIngredientDrag"
                aria-label="Zutat verschieben"
                title="Zutat verschieben"
                @dragstart.stop="onIngredientDragStart($event, group.id, item)"
                @dragend.stop="onIngredientDragEnd"
              >
                <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <circle cx="9" cy="7" r="1.25" />
                  <circle cx="15" cy="7" r="1.25" />
                  <circle cx="9" cy="12" r="1.25" />
                  <circle cx="15" cy="12" r="1.25" />
                  <circle cx="9" cy="17" r="1.25" />
                  <circle cx="15" cy="17" r="1.25" />
                </svg>
              </button>
              <div
                class="ingredient-card__summary"
                role="button"
                tabindex="0"
                :aria-label="'Zutat bearbeiten: ' + ingredientLineMain(item.ing)"
                @click="openIngredientEdit(item.flatIndex)"
                @keydown.enter.prevent="openIngredientEdit(item.flatIndex)"
                @keydown.space.prevent="openIngredientEdit(item.flatIndex)"
              >
                <div class="ingredient-card__summary-main">{{ ingredientLineMain(item.ing) }}</div>
                <div v-if="ingredientLineSub(item.ing)" class="ingredient-card__summary-sub">{{ ingredientLineSub(item.ing) }}</div>
                <div
                  v-if="showOriginalLines && (item.ing.original_text || '').trim()"
                  class="ingredient-card__summary-original"
                >
                  {{ item.ing.original_text }}
                </div>
              </div>
              <div class="ingredient-card__aside">
                <div class="ingredient-card__reorder ingredient-card__reorder--touch" role="group" aria-label="Reihenfolge">
                  <button
                    type="button"
                    class="ingredient-card__move-btn"
                    aria-label="Nach oben"
                    title="Nach oben"
                    :disabled="!canMoveIngredientInSection(item.flatIndex, -1)"
                    @click.stop="moveIngredientInSection(item.flatIndex, -1)"
                  >
                    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                      <path d="M12 8l-6 6h12l-6-6z" fill="currentColor" />
                    </svg>
                  </button>
                  <button
                    type="button"
                    class="ingredient-card__move-btn"
                    aria-label="Nach unten"
                    title="Nach unten"
                    :disabled="!canMoveIngredientInSection(item.flatIndex, 1)"
                    @click.stop="moveIngredientInSection(item.flatIndex, 1)"
                  >
                    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                      <path d="M12 16l6-6H6l6 6z" fill="currentColor" />
                    </svg>
                  </button>
                </div>
                <select
                  :id="`ing-grp-view-${item.flatIndex}`"
                  class="ingredient-card__group-select"
                  :value="ingredientGroupSelectValue(item.ing)"
                  aria-label="In Gruppe verschieben"
                  title="In Gruppe verschieben"
                  @change="moveIngredientToGroup(item.flatIndex, ($event.target as HTMLSelectElement).value)"
                  @click.stop
                >
                  <option value="">Gruppe…</option>
                  <option v-for="g in ingredientGroupOptions" :key="g.id" :value="g.id">{{ g.label }}</option>
                </select>
                <button
                  type="button"
                  class="ingredients-icon-btn ingredients-icon-btn--subtle"
                  title="Entfernen"
                  aria-label="Zutat entfernen"
                  @click.stop="removeIngredient(item.flatIndex)"
                >
                  <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <path d="M18 6L6 18M6 6L18 18" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
                  </svg>
                </button>
              </div>
            </div>

            <div v-else class="ingredient-card__edit">
              <div class="ingredient-card__edit-row ingredient-card__edit-row--main">
                <button
                  type="button"
                  class="ingredient-card__drag-handle ingredient-card__drag-handle--edit"
                  :draggable="desktopIngredientDrag"
                  aria-label="Zutat verschieben"
                  title="Zutat verschieben"
                  @dragstart.stop="onIngredientDragStart($event, group.id, item)"
                  @dragend.stop="onIngredientDragEnd"
                >
                  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                    <circle cx="9" cy="7" r="1.25" />
                    <circle cx="15" cy="7" r="1.25" />
                    <circle cx="9" cy="12" r="1.25" />
                    <circle cx="15" cy="12" r="1.25" />
                    <circle cx="9" cy="17" r="1.25" />
                    <circle cx="15" cy="17" r="1.25" />
                  </svg>
                </button>
                <input
                  v-model="item.ing.amount"
                  type="text"
                  placeholder="Menge"
                  class="ingredient-input ingredient-input--amount"
                  aria-label="Menge"
                />
                <input
                  v-model="item.ing.unit"
                  type="text"
                  placeholder="Einheit"
                  class="ingredient-input ingredient-input--unit"
                  aria-label="Einheit"
                />
                <input
                  v-model="item.ing.name"
                  type="text"
                  placeholder="Zutat"
                  class="ingredient-input ingredient-input--name"
                  aria-label="Zutat"
                />
                <button
                  type="button"
                  class="ingredients-icon-btn ingredients-icon-btn--done"
                  aria-label="Fertig"
                  title="Fertig"
                  @click="closeIngredientEdit(item.flatIndex)"
                >
                  <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <path d="M6 12l4 4 8-8" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
                  </svg>
                </button>
                <button
                  type="button"
                  class="ingredients-icon-btn ingredients-icon-btn--subtle"
                  title="Zutat entfernen"
                  aria-label="Zutat entfernen"
                  @click="removeIngredient(item.flatIndex)"
                >
                  <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <path d="M18 6L6 18M6 6L18 18" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
                  </svg>
                </button>
              </div>
              <div class="ingredient-card__edit-row ingredient-card__edit-row--meta">
                <select
                  :id="`ing-cat-${item.flatIndex}`"
                  :value="item.ing.category ?? ''"
                  class="ingredient-card__select ingredient-card__select--compact"
                  aria-label="Kategorie"
                  @change="setIngredientCategorySelect(item.ing, ($event.target as HTMLSelectElement).value)"
                >
                  <option value="">Kategorie</option>
                  <option
                    v-for="opt in INGREDIENT_CATEGORY_OPTIONS"
                    :key="opt.value"
                    :value="opt.value"
                  >
                    {{ opt.labelDe }}
                  </option>
                </select>
                <input
                  :id="`ing-add-${item.flatIndex}`"
                  v-model="item.ing.additional_info"
                  type="text"
                  class="ingredient-card__text-input"
                  placeholder="Zusatzinfo"
                  aria-label="Zusatzinfo"
                />
              </div>
              <div v-if="showOriginalLines" class="ingredient-card__edit-row ingredient-card__edit-row--original">
                <template v-if="item.ing.original_text == null">
                  <button
                    type="button"
                    class="ingredient-card__link-btn"
                    @click="item.ing.original_text = ''"
                  >
                    + Originalzeile
                  </button>
                </template>
                <template v-else>
                  <input
                    v-model="item.ing.original_text"
                    type="text"
                    class="ingredient-card__text-input ingredient-card__text-input--original"
                    placeholder="Originalzeile"
                    aria-label="Originalzeile"
                  />
                  <button
                    type="button"
                    class="ingredients-icon-btn ingredients-icon-btn--subtle"
                    title="Originalzeile entfernen"
                    aria-label="Originalzeile entfernen"
                    @click="item.ing.original_text = null"
                  >
                    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                      <path d="M18 6L6 18M6 6L18 18" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
                    </svg>
                  </button>
                </template>
              </div>
            </div>
              </div>
            </template>
            <div
              v-if="showIngredientDropLineAfterLast(group)"
              class="ingredient-drop-line"
              aria-hidden="true"
            />
          </div>
        </div>

        <!-- Nutrition 
        <div
          v-if="editingId != null && (hasNutrition || estimateHints.nutrition)"
          class="form-section editor-nutrition-section"
        >
          <div class="form-section__head">
            <h4 class="form-section__title">Nährwerte</h4>
            <button
              v-if="hasNutrition"
              type="button"
              class="editor-estimate-refresh"
              :disabled="nutritionEstimateLoading"
              title="Nährwerte neu schätzen"
              aria-label="Nährwerte neu schätzen"
              @click="emit('estimateNutrition')"
            >
              ↻
            </button>
          </div>
          <div v-if="hasNutrition" class="editor-nutrition-grid">
            <div v-if="nutritionPerServing.kcal != null" class="editor-nutrition-item">
              <span class="editor-nutrition-label">Kalorien / Portion</span>
              <span class="editor-nutrition-value">{{ nutritionPerServing.kcal }} kcal</span>
            </div>
            <div v-if="nutritionPerServing.protein != null" class="editor-nutrition-item">
              <span class="editor-nutrition-label">Eiweiß / Portion</span>
              <span class="editor-nutrition-value">{{ nutritionPerServing.protein }} g</span>
            </div>
            <div v-if="nutritionPerServing.carbs != null" class="editor-nutrition-item">
              <span class="editor-nutrition-label">Kohlenhydrate / Portion</span>
              <span class="editor-nutrition-value">{{ nutritionPerServing.carbs }} g</span>
            </div>
            <div v-if="nutritionPerServing.fat != null" class="editor-nutrition-item">
              <span class="editor-nutrition-label">Fett / Portion</span>
              <span class="editor-nutrition-value">{{ nutritionPerServing.fat }} g</span>
            </div>
          </div>
          <p v-if="estimateHints.nutrition" class="editor-estimate-hint" role="status">
            {{ estimateHints.nutrition }}
            <button
              type="button"
              class="btn btn--ghost btn--tiny editor-estimate-retry"
              :disabled="nutritionEstimateLoading"
              @click="emit('estimateNutrition')"
            >
              Erneut versuchen
            </button>
          </p>
        </div>
-->
        <div class="ingredients-step__bottom-actions">
          <button type="button" class="btn btn--secondary btn--block" @click="addIngredient">
            + Zutat hinzufügen
          </button>
          <button type="button" class="btn btn--secondary btn--block" @click="addIngredientGroup">
            + Gruppe hinzufügen
          </button>
        </div>
          </div>

          <aside
            v-if="showFullOcrText && fullOriginalText"
            class="ingredients-ocr-aside"
            role="complementary"
            aria-label="Originaltext"
          >
            <div class="ingredients-ocr-aside__header">
              <h5 class="ingredients-ocr-aside__title">Originaltext</h5>
              <button
                type="button"
                class="btn btn--ghost btn--tiny"
                @click="showFullOcrText = false"
              >
                Schließen
              </button>
            </div>
            <pre class="original-text-panel__body ingredients-ocr-aside__body">{{ fullOriginalText }}</pre>
          </aside>
        </div>
      </div>

      <!-- Step 3: Instructions -->
      <div v-if="currentStep === 2" class="form-step form-step--instructions">
        <div class="instructions-step__main">
          <div class="instructions-step__list">
            <div
              v-for="(step, index) in form.recipe_steps"
              :key="index"
              class="instruction-card"
              :class="{ 'instruction-card--editing': isStepEditing(index) }"
            >
              <div v-if="!isStepEditing(index)" class="instruction-card__view">
                <span class="instruction-card__num" aria-hidden="true">{{ index + 1 }}</span>
                <div
                  class="instruction-card__summary"
                  role="button"
                  tabindex="0"
                  :aria-label="'Schritt ' + (index + 1) + ' bearbeiten'"
                  @click="openStepEdit(index)"
                  @keydown.enter.prevent="openStepEdit(index)"
                  @keydown.space.prevent="openStepEdit(index)"
                >
                  <div class="instruction-card__summary-main">
                    {{
                      (step.instruction || '').trim()
                        ? step.instruction
                        : 'Leerer Schritt — tippen zum Bearbeiten'
                    }}
                  </div>
                </div>
                <button
                  type="button"
                  class="ingredients-icon-btn ingredients-icon-btn--subtle"
                  title="Schritt entfernen"
                  aria-label="Schritt entfernen"
                  @click.stop="removeStep(index)"
                >
                  <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <path d="M18 6L6 18M6 6L18 18" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
                  </svg>
                </button>
              </div>
              <div v-else class="instruction-card__edit">
                <div class="instruction-card__edit-row instruction-card__edit-row--main">
                  <span class="instruction-card__num" aria-hidden="true">{{ index + 1 }}</span>
                  <textarea
                    v-model="step.instruction"
                    rows="2"
                    :placeholder="`Schritt ${index + 1}`"
                    class="instruction-card__textarea"
                    aria-label="Zubereitungsschritt"
                  />
                  <button
                    type="button"
                    class="ingredients-icon-btn ingredients-icon-btn--done"
                    aria-label="Fertig"
                    title="Fertig"
                    @click="closeStepEdit(index)"
                  >
                    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                      <path d="M6 12l4 4 8-8" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
                    </svg>
                  </button>
                  <button
                    type="button"
                    class="ingredients-icon-btn ingredients-icon-btn--subtle"
                    title="Schritt entfernen"
                    aria-label="Schritt entfernen"
                    @click="removeStep(index)"
                  >
                    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                      <path d="M18 6L6 18M6 6L18 18" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div class="ingredients-step__bottom-actions">
            <button type="button" class="btn btn--secondary btn--block" @click="addStep">
              + Schritt hinzufügen
            </button>
          </div>
        </div>

        <div class="form-section document-section">
          <h4 class="form-section__title">Tipps & Notizen</h4>
          <textarea
            v-model="form.tips_notes"
            rows="3"
            placeholder="Optionale Tipps, Notizen oder Varianten"
            class="form-textarea"
            aria-label="Tipps und Notizen"
          />
        </div>
      </div>

      <!-- Section navigation -->
      <div class="form-actions">
        <button
          v-if="currentStep > 0"
          type="button"
          class="btn btn--secondary recipe-detail-action recipe-detail-action--secondary form-actions__back"
          @click="prevStep"
        >
          Zurück
        </button>
        <div class="form-actions__spacer" aria-hidden="true" />
        <div class="form-actions__primary">
          <button type="submit" class="btn btn--primary recipe-detail-action recipe-detail-action--primary">
            {{ editingId ? 'Speichern' : 'Rezept anlegen' }}
          </button>
          <button
            v-if="currentStep < steps.length - 1"
            type="button"
            class="btn btn--secondary recipe-detail-action recipe-detail-action--secondary"
            @click="nextStep"
          >
            Weiter
          </button>
        </div>
      </div>
    </form>
  </div>
</template>

<script setup lang="ts">
import { reactive, ref, computed, watch, onMounted, onBeforeUnmount } from 'vue'
import OriginalLanguageIcon from './icons/OriginalLanguageIcon.vue'
import type {
  RecipeFormPayload,
  IngredientInput,
  RecipeStepInput,
  ParsedRecipeFromOcr,
} from '../api/recipes'
import { getRecipeTagOptions } from '../api/recipes'
import { listSources } from '../api/sources'
import type { RecipeSource } from '../api/sources'
import { INGREDIENT_CATEGORY_OPTIONS, getIngredientCategoryLabelDe } from '../constants/ingredientCategories'
import { getRecipeFormPreviewUrl } from '../utils/recipeDisplayImage'
import { formatUrlDomain } from '../utils/formatUrlDomain'
import { isWebsiteSourceType } from '../utils/recipeSourceLabel'
import CropPerspectiveModal from './CropPerspectiveModal.vue'
import TagInput from './ui/TagInput.vue'
import type { CropNaturalPoint } from './CropPerspectiveModal.vue'
import { rotateImageFile90 } from '../utils/imageRotate'
import {
  perServingNutrition,
  recipeHasNutrition,
  recipeHasPrepOrCookTimes,
} from '../utils/recipeEstimateNeeds'
import type { RecipeHealthScoreResponse } from '../api/recipes'

interface IngredientRow {
  amount: string
  unit: string
  name: string
  category?: string | null
  section_id?: number | null
  section_heading?: string | null
  original_text?: string | null
  /** Form uses empty string when unset */
  additional_info?: string | null
  /** Stable editor-only id for section grouping UI (not sent to API). */
  section_client_id?: string | null
  /** Stable editor-only id for list keys (not sent to API). */
  client_id?: string
}

interface EmptyEditorGroup {
  id: string
  heading: string
}

const props = defineProps<{
  initial?: (Partial<RecipeFormPayload> & {
    parsed_recipe?: ParsedRecipeFromOcr | null
    source_id?: number | null
    source_type?: string | null
    source_url?: string | null
    original_url?: string | null
    source_domain?: string | null
    source_name?: string | null
    source_subtitle?: string | null
    source_author?: string | null
    source_year?: number | null
    source_image_path?: string | null
    import_method?: string | null
    extract_confidence?: number | null
    extract_missing_fields?: string[] | null
    nutrition_kcal?: number | null
    nutrition_protein?: number | null
    nutrition_carbs?: number | null
    nutrition_fat?: number | null
    health_score?: RecipeHealthScoreResponse | null
    prep_time_min?: number | null
    cook_time_min?: number | null
    prep_time_source?: 'original' | 'estimated' | null
    cook_time_source?: 'original' | 'estimated' | null
    prep_time_confidence?: number | null
    cook_time_confidence?: number | null
    tags?: string[]
    image_processing_pending?: boolean
  }) | null
  editingId?: number | null
  editingStatus?: 'draft' | 'confirmed' | null
  timeEstimateLoading?: boolean
  nutritionEstimateLoading?: boolean
  healthEstimateLoading?: boolean
  estimateHints?: { nutrition: string; health: string; times: string }
  tagGenerateLoading?: boolean
}>()

const emit = defineEmits<{
  submit: [
    payload: RecipeFormPayload,
    imageFile: File | string | null,
    cropPoints?: Array<{ x: number; y: number }>,
    options?: { processImageLater?: boolean }
  ]
  confirm: []
  cancel: []
  estimateTimes: []
  estimateNutrition: []
  estimateHealth: []
  generateTags: []
}>()

const currentStep = ref(0)
const selectedSourceId = ref<number | null>(null)
/** Per-recipe page URL; persisted as recipes.original_url. */
const originalPageUrl = ref('')
const importMethod = ref<'manual' | 'url' | 'image'>('manual')
const bookSources = ref<RecipeSource[]>([])
const showBookPicker = ref(false)
const showUrlEdit = ref(false)
const showOriginalLines = ref(false)
const showFullOcrText = ref(false)

const cookbookSources = computed(() => bookSources.value.filter((s) => s.type === 'book'))

function sourceTypeForId(id: number | null): 'book' | 'url' | null {
  if (id == null) return null
  const fromList = bookSources.value.find((s) => s.id === id)
  if (fromList) {
    if (fromList.type === 'book') return 'book'
    if (isWebsiteSourceType(fromList.type)) return 'url'
  }
  if (props.initial?.source_id === id) {
    const t = (props.initial.source_type ?? '').toLowerCase()
    if (t === 'book') return 'book'
    if (isWebsiteSourceType(t)) return 'url'
  }
  return null
}

const primarySourceType = computed(() => sourceTypeForId(selectedSourceId.value))
const isPrimaryWebsite = computed(() => primarySourceType.value === 'url')
const isPrimaryBook = computed(() => primarySourceType.value === 'book')
const hasOriginalUrl = computed(() => !!originalPageUrl.value.trim())
const originalLinkHref = computed(() => originalPageUrl.value.trim())
const originalLinkDomain = computed(() =>
  originalPageUrl.value.trim() ? formatUrlDomain(originalPageUrl.value.trim()) : ''
)
const websiteDisplayDomain = computed(() => {
  if (originalPageUrl.value.trim()) return formatUrlDomain(originalPageUrl.value.trim())
  return props.initial?.source_domain?.trim() || formatUrlDomain(props.initial?.source_url ?? '') || 'Website'
})
const websiteLinkHref = computed(
  () => originalPageUrl.value.trim() || props.initial?.source_url?.trim() || '#'
)

const sourceUiCase = computed<'website' | 'book' | 'original-only' | 'manual'>(() => {
  if (isPrimaryWebsite.value) return 'website'
  if (isPrimaryBook.value) return 'book'
  if (hasOriginalUrl.value) return 'original-only'
  return 'manual'
})

const pickerBookSelected = computed(
  () => selectedSourceId.value != null && sourceTypeForId(selectedSourceId.value) === 'book'
)

const primaryBookTitle = computed(() => {
  if (!isPrimaryBook.value || selectedSourceId.value == null) return ''
  const fromList = bookSources.value.find((s) => s.id === selectedSourceId.value)
  if (fromList?.name?.trim()) return fromList.name.trim()
  return props.initial?.source_name?.trim() || 'Kochbuch'
})

const primaryBookSubtitle = computed(() => {
  if (!isPrimaryBook.value || selectedSourceId.value == null) return ''
  const fromList = bookSources.value.find((s) => s.id === selectedSourceId.value)
  return fromList?.subtitle?.trim() || props.initial?.source_subtitle?.trim() || ''
})

const primaryBookCover = computed(() => {
  if (!isPrimaryBook.value || selectedSourceId.value == null) return ''
  const fromList = bookSources.value.find((s) => s.id === selectedSourceId.value)
  return fromList?.image_path || props.initial?.source_image_path || ''
})

const primaryBookMetaLine = computed(() => {
  if (!isPrimaryBook.value || selectedSourceId.value == null) return ''
  const fromList = bookSources.value.find((s) => s.id === selectedSourceId.value)
  const author = fromList?.author?.trim() || props.initial?.source_author?.trim() || ''
  const year = fromList?.year ?? props.initial?.source_year ?? null
  if (author && year != null) return `${author} · ${year}`
  if (author) return author
  if (year != null) return String(year)
  return ''
})

function openBookPicker() {
  showBookPicker.value = true
}

function closeBookPicker() {
  showBookPicker.value = false
}

function selectBookFromPicker(id: number) {
  selectedSourceId.value = id
  showBookPicker.value = false
}

// Image upload
const imageInputRef = ref<HTMLInputElement | null>(null)
const imageFile = ref<File | null>(null)
const imagePreview = ref<string | null>(null)
const currentImageUrl = ref<string | null>(null)

// Crop modal (in-memory until save / apply)
type CropPoint = CropNaturalPoint
const cropModalOpen = ref(false)
const cropModalSrc = ref('')
const cropModalMode = ref<'new' | 'existing'>('new')
const newImageCropNaturalPoints = ref<CropPoint[] | null>(null)
const existingCropNaturalPoints = ref<CropPoint[] | null>(null)
const cropping = ref(false)
const cropError = ref('')
const deferImageProcessing = ref(false)

const imageProcessingPending = computed(
  () => !!(props.initial as { image_processing_pending?: boolean } | null)?.image_processing_pending
)

const cropModalInitialPoints = computed(() => {
  return cropModalMode.value === 'new' ? newImageCropNaturalPoints.value : existingCropNaturalPoints.value
})

const hasCropSet = computed(() => {
  const pts = imageFile.value ? newImageCropNaturalPoints.value : existingCropNaturalPoints.value
  return pts?.length === 4
})

function revokeCropModalSrc() {
  if (!cropModalSrc.value.startsWith('blob:')) return
  if (cropModalSrc.value !== imagePreview.value) URL.revokeObjectURL(cropModalSrc.value)
}

function openCropModal(mode: 'new' | 'existing') {
  cropError.value = ''
  cropModalMode.value = mode
  revokeCropModalSrc()
  if (mode === 'new') {
    if (!imageFile.value) return
    cropModalSrc.value = URL.createObjectURL(imageFile.value)
  } else {
    if (!currentImageUrl.value || currentImageUrl.value === '__DELETE__') return
    cropModalSrc.value = currentImageUrl.value
  }
  cropModalOpen.value = true
}

function closeCropModal() {
  cropModalOpen.value = false
  revokeCropModalSrc()
  cropModalSrc.value = ''
}

function onCropModalConfirm(points: CropPoint[] | null) {
  if (cropModalMode.value === 'new') {
    newImageCropNaturalPoints.value = points
    closeCropModal()
    return
  }
  existingCropNaturalPoints.value = points
  closeCropModal()
  void applyCropExisting(points)
}

async function applyCropExisting(points: CropPoint[] | null) {
  const recipeId = props.editingId
  if (!recipeId || !currentImageUrl.value || currentImageUrl.value === '__DELETE__') return
  const pending = imageProcessingPending.value
  const n = points?.length ?? 0
  if (!pending && n !== 4) return
  if (pending && n !== 0 && n !== 4) {
    cropError.value = 'Vier Eckpunkte setzen oder Punkte zurücksetzen für Vollbild ohne Perspektivkorrektur.'
    return
  }
  const body: { points?: CropPoint[] } = {}
  if (n === 4 && points) body.points = points
  cropping.value = true
  cropError.value = ''
  try {
    const res = await fetch(`/api/recipes/${recipeId}/crop-perspective`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error((data as { error?: string }).error || res.statusText)
    const payload = data as { url?: string }
    if (payload.url) currentImageUrl.value = payload.url
    existingCropNaturalPoints.value = null
  } catch (e) {
    cropError.value = e instanceof Error ? e.message : 'Zuschneiden fehlgeschlagen'
  } finally {
    cropping.value = false
  }
}

/** Get crop points in image coordinates for the newly selected image (for upload). */
function getNewImageCropPoints(): CropPoint[] | undefined {
  return newImageCropNaturalPoints.value?.length === 4 ? newImageCropNaturalPoints.value : undefined
}

const steps = [
  { id: 'basics', label: 'Grundlagen' },
  { id: 'ingredients', label: 'Zutaten' },
  { id: 'instructions', label: 'Zubereitung' },
]

/** Subtle nav hint for draft/unreviewed recipes only; null when nothing to show. */
function sectionNavAttention(idx: number): 'prüfen' | 'fehlt' | null {
  if (props.editingStatus === 'confirmed') return null
  if (idx === 0) return form.title.trim() ? null : 'fehlt'
  if (idx === 1) return form.ingredients.some((i) => (i.name || '').trim()) ? null : 'prüfen'
  if (idx === 2) return form.recipe_steps.some((s) => s.instruction.trim()) ? null : 'prüfen'
  return null
}

const form = reactive({
  title: '',
  subtitle: '',
  description: '',
  tips_notes: '',
  servings: null as number | null,
  prep_time: null as number | null,
  cook_time: null as number | null,
  would_cook_again: null as 'yes' | 'maybe' | 'no' | null,
  source_page: '',
  tags: [] as string[],
  ingredients: [] as IngredientRow[],
  recipe_steps: [] as { instruction: string }[],
})

const allAllowedTags = ref<string[]>([])
function formatTagLabel(t: string) {
  return t.replace(/_/g, ' ')
}

const tagGenerateLoading = computed(() => props.tagGenerateLoading === true)

const estimateHints = computed(() => props.estimateHints ?? { nutrition: '', health: '', times: '' })

const hasNutrition = computed(() => recipeHasNutrition(props.initial))
const nutritionPerServing = computed(() =>
  perServingNutrition(
    {
      nutrition_kcal: props.initial?.nutrition_kcal,
      nutrition_protein: props.initial?.nutrition_protein,
      nutrition_carbs: props.initial?.nutrition_carbs,
      nutrition_fat: props.initial?.nutrition_fat,
      parsed_recipe: props.initial?.parsed_recipe,
      servings: form.servings,
    },
    form.servings
  )
)

const hasHealthScore = computed(() => {
  const score = props.initial?.health_score?.estimate?.healthScore
  return score != null && !Number.isNaN(Number(score))
})
const healthScoreValue = computed(() => props.initial?.health_score?.estimate?.healthScore ?? null)
const healthScoreSummary = computed(() => props.initial?.health_score?.estimate?.summary?.trim() ?? '')

const hasPrepOrCookTimes = computed(() =>
  recipeHasPrepOrCookTimes({
    prep_time_min: form.prep_time,
    cook_time_min: form.cook_time,
  })
)

const hasAnyOriginalText = computed(() =>
  form.ingredients.some((i) => (i.original_text || '').trim())
)

const fullOriginalText = computed(() => {
  const pr = props.initial?.parsed_recipe
  if (!pr) return ''
  const parts: string[] = []
  if (pr.title?.trim()) parts.push(pr.title.trim())
  if (pr.introText?.trim()) parts.push(pr.introText.trim())
  for (const section of pr.ingredientsSections ?? []) {
    if (section.heading?.trim()) parts.push(`\n${section.heading.trim()}`)
    for (const item of section.items ?? []) {
      const line = (item as { originalText?: string }).originalText?.trim()
      if (line) parts.push(line)
    }
  }
  return parts.join('\n').trim()
})

/** Flat indices whose original-line editor is expanded (default: collapsed when text exists). */
const expandedOriginalLineIndices = ref<Set<number>>(new Set())

/** Ingredients shown as full form (otherwise one-line summary for review). */
const editingIngredientIndices = ref<Set<number>>(new Set())

/** Steps shown as textarea (otherwise one-line summary). */
const editingStepIndices = ref<Set<number>>(new Set())

function isIngredientEditing(flatIndex: number): boolean {
  return editingIngredientIndices.value.has(flatIndex)
}

function openIngredientEdit(flatIndex: number) {
  const next = new Set(editingIngredientIndices.value)
  next.add(flatIndex)
  editingIngredientIndices.value = next
}

function closeIngredientEdit(flatIndex: number) {
  const next = new Set(editingIngredientIndices.value)
  next.delete(flatIndex)
  editingIngredientIndices.value = next
}

function isStepEditing(index: number): boolean {
  return editingStepIndices.value.has(index)
}

function openStepEdit(index: number) {
  const next = new Set(editingStepIndices.value)
  next.add(index)
  editingStepIndices.value = next
}

function closeStepEdit(index: number) {
  const next = new Set(editingStepIndices.value)
  next.delete(index)
  editingStepIndices.value = next
}

function ingredientLineMain(ing: IngredientRow): string {
  const amount = (ing.amount || '').trim()
  const unit = (ing.unit || '').trim()
  const name = (ing.name || '').trim()
  const parts = [amount, unit, name].filter(Boolean)
  const hasMeta = !!(ing.category || (ing.additional_info || '').trim())
  if (parts.length === 0 && !hasMeta) return 'Leere Zutat — tippen zum Bearbeiten'
  return parts.join(' ').trim() || name || '—'
}

function ingredientLineSub(ing: IngredientRow): string {
  const bits: string[] = []
  if (ing.category) bits.push(getIngredientCategoryLabelDe(ing.category))
  const add = (ing.additional_info || '').trim()
  if (add) bits.push(add)
  return bits.join(' · ')
}

function remapIndexSetAfterRemove(setRef: { value: Set<number> }, removedIndex: number) {
  const next = new Set<number>()
  for (const i of setRef.value) {
    if (i < removedIndex) next.add(i)
    else if (i > removedIndex) next.add(i - 1)
  }
  setRef.value = next
}

const UNGROUPED_SECTION_ID = '__ungrouped__'

/** Empty groups (no ingredients yet), keyed by stable client id. */
const emptyEditorGroups = ref<EmptyEditorGroup[]>([])
/** Display order of section client ids (ungrouped first when present). */
const sectionOrderIds = ref<string[]>([])

let editorClientIdSeq = 0
function nextEditorClientId(prefix: string): string {
  editorClientIdSeq += 1
  return `${prefix}-${Date.now().toString(36)}-${editorClientIdSeq}`
}

function createIngredientRow(partial?: Partial<IngredientRow>): IngredientRow {
  return {
    amount: '',
    unit: '',
    name: '',
    category: null,
    additional_info: '',
    section_heading: '',
    section_id: null,
    section_client_id: null,
    client_id: nextEditorClientId('ing'),
    ...partial,
  }
}

function ingredientHasContent(ing: IngredientRow): boolean {
  return !!(
    (ing.name || '').trim() ||
    (ing.original_text || '').trim() ||
    (ing.amount || '').trim() ||
    (ing.unit || '').trim() ||
    (ing.additional_info || '').trim()
  )
}

function isIngredientInSection(ing: IngredientRow): boolean {
  return !!(ing.section_client_id || (ing.section_heading ?? '').trim())
}

function getIngredientSectionClientId(ing: IngredientRow): string | null {
  if (!isIngredientInSection(ing)) return null
  return ing.section_client_id ?? null
}

function ensureIngredientClientIds() {
  for (const ing of form.ingredients) {
    if (!ing.client_id) ing.client_id = nextEditorClientId('ing')
  }
}

function assignSectionClientIdsOnLoad() {
  let curId: string | null = null
  let curSectionDbId: number | null | undefined = undefined
  let curHeading: string | null = null

  for (const ing of form.ingredients) {
    const heading = (ing.section_heading ?? '').trim() || null
    if (!heading) {
      ing.section_client_id = null
      curId = null
      curSectionDbId = undefined
      curHeading = null
      continue
    }

    const dbId = ing.section_id ?? null
    let newGroup = curId === null
    if (!newGroup) {
      if (dbId != null) {
        newGroup = dbId !== curSectionDbId
      } else if (curSectionDbId != null) {
        newGroup = true
      } else {
        newGroup = heading !== curHeading
      }
    }

    if (newGroup) {
      curId = nextEditorClientId('sec')
      curSectionDbId = dbId
      curHeading = heading
    }
    ing.section_client_id = curId
  }
}

function rebuildSectionOrderIds() {
  const order: string[] = []
  const seen = new Set<string>()
  let hasUngrouped = false

  for (const ing of form.ingredients) {
    const sid = getIngredientSectionClientId(ing)
    if (sid === null) {
      hasUngrouped = true
      continue
    }
    if (!seen.has(sid)) {
      seen.add(sid)
      order.push(sid)
    }
  }

  for (const eg of emptyEditorGroups.value) {
    if (!seen.has(eg.id)) {
      seen.add(eg.id)
      order.push(eg.id)
    }
  }

  if (hasUngrouped) order.unshift(UNGROUPED_SECTION_ID)
  sectionOrderIds.value = order
}

function sectionHeadingForClientId(sectionId: string): string {
  const empty = emptyEditorGroups.value.find((g) => g.id === sectionId)
  if (empty) return empty.heading
  const first = form.ingredients.find((i) => i.section_client_id === sectionId)
  return first?.section_heading ?? ''
}

function ingredientGroupSelectValue(ing: IngredientRow): string {
  return ing.section_client_id ?? ''
}

const ingredientsBySection = computed(() => {
  const groups = new Map<
    string,
    { id: string; heading: string; items: { ing: IngredientRow; flatIndex: number }[] }
  >()

  form.ingredients.forEach((ing, flatIndex) => {
    const sid = getIngredientSectionClientId(ing)
    const id = sid ?? UNGROUPED_SECTION_ID
    if (!groups.has(id)) {
      groups.set(id, {
        id,
        heading: id === UNGROUPED_SECTION_ID ? '' : sectionHeadingForClientId(id),
        items: [],
      })
    }
    groups.get(id)!.items.push({ ing, flatIndex })
  })

  for (const eg of emptyEditorGroups.value) {
    if (!groups.has(eg.id)) {
      groups.set(eg.id, { id: eg.id, heading: eg.heading, items: [] })
    }
  }

  const order =
    sectionOrderIds.value.length > 0
      ? sectionOrderIds.value
      : [...groups.keys()].sort((a, b) => {
          if (a === UNGROUPED_SECTION_ID) return -1
          if (b === UNGROUPED_SECTION_ID) return 1
          return 0
        })

  return order
    .filter((id) => groups.has(id))
    .map((id) => {
      const g = groups.get(id)!
      if (id !== UNGROUPED_SECTION_ID) {
        g.heading = sectionHeadingForClientId(id)
      }
      return g
    })
})

const ingredientGroupOptions = computed(() =>
  ingredientsBySection.value
    .filter((g) => g.id !== UNGROUPED_SECTION_ID)
    .map((g) => ({
      id: g.id,
      label: (g.heading || '').trim() || 'Neue Gruppe',
    }))
)

function canDeleteIngredientGroup(group: { id: string; items: { ing: IngredientRow }[] }): boolean {
  if (group.id === UNGROUPED_SECTION_ID) return false
  return !group.items.some(({ ing }) => ingredientHasContent(ing))
}

function sectionHeadingExists(heading: string, exceptId?: string): boolean {
  const h = heading.trim()
  if (!h) return false
  if (emptyEditorGroups.value.some((g) => g.id !== exceptId && g.heading.trim() === h)) return true
  return form.ingredients.some(
    (i) => i.section_client_id !== exceptId && (i.section_heading ?? '').trim() === h
  )
}

function addIngredientGroup() {
  const base = 'Neue Gruppe'
  let heading = base
  let n = 1
  while (sectionHeadingExists(heading)) {
    n += 1
    heading = `${base} ${n}`
  }
  const id = nextEditorClientId('sec')
  emptyEditorGroups.value = [...emptyEditorGroups.value, { id, heading }]
  rebuildSectionOrderIds()
}

function remapIndexSetAfterMove(setRef: { value: Set<number> }, from: number, to: number) {
  const next = new Set<number>()
  for (const i of setRef.value) {
    if (from < to) {
      if (i === from) next.add(to)
      else if (i > from && i <= to) next.add(i - 1)
      else next.add(i)
    } else if (from > to) {
      if (i === from) next.add(to)
      else if (i >= to && i < from) next.add(i + 1)
      else next.add(i)
    } else {
      next.add(i)
    }
  }
  setRef.value = next
}

function getFlatIndicesInSection(sectionId: string | null): number[] {
  const indices: number[] = []
  form.ingredients.forEach((ing, i) => {
    const sid = getIngredientSectionClientId(ing)
    if (sid === sectionId) indices.push(i)
  })
  return indices
}

function findInsertIndexForSection(sectionId: string | null): number {
  if (sectionId === null) {
    let last = -1
    for (let i = 0; i < form.ingredients.length; i++) {
      if (getIngredientSectionClientId(form.ingredients[i]) === null) last = i
    }
    return last + 1
  }

  let lastInSection = -1
  for (let i = 0; i < form.ingredients.length; i++) {
    if (form.ingredients[i].section_client_id === sectionId) lastInSection = i
  }
  if (lastInSection >= 0) return lastInSection + 1

  const order = sectionOrderIds.value
  const idxInOrder = order.indexOf(sectionId)
  let insertAt = 0
  for (let o = 0; o < idxInOrder; o++) {
    const prevId = order[o]
    if (prevId === UNGROUPED_SECTION_ID) continue
    for (let i = form.ingredients.length - 1; i >= 0; i--) {
      if (form.ingredients[i].section_client_id === prevId) {
        insertAt = Math.max(insertAt, i + 1)
      }
    }
  }
  return insertAt
}

function spliceIngredientToIndex(fromIndex: number, toIndex: number) {
  if (fromIndex === toIndex) return
  const [ing] = form.ingredients.splice(fromIndex, 1)
  const insertAt = fromIndex < toIndex ? toIndex - 1 : toIndex
  form.ingredients.splice(insertAt, 0, ing)
  remapIndexSetAfterMove(expandedOriginalLineIndices, fromIndex, insertAt)
  remapIndexSetAfterMove(editingIngredientIndices, fromIndex, insertAt)
}

function moveIngredientToGroup(flatIndex: number, targetSectionId: string) {
  const ing = form.ingredients[flatIndex]
  if (!ing) return

  if (!targetSectionId) {
    ing.section_client_id = null
    ing.section_heading = null
    ing.section_id = null
    const insertAt = findInsertIndexForSection(null)
    spliceIngredientToIndex(flatIndex, insertAt)
    rebuildSectionOrderIds()
    return
  }

  const heading = sectionHeadingForClientId(targetSectionId)
  ing.section_client_id = targetSectionId
  ing.section_heading = heading || null
  ing.section_id = null
  emptyEditorGroups.value = emptyEditorGroups.value.filter((g) => g.id !== targetSectionId)

  const insertAt = findInsertIndexForSection(targetSectionId)
  spliceIngredientToIndex(flatIndex, insertAt)
  rebuildSectionOrderIds()
}

function canMoveIngredientInSection(flatIndex: number, delta: -1 | 1): boolean {
  const ing = form.ingredients[flatIndex]
  if (!ing) return false
  const indices = getFlatIndicesInSection(getIngredientSectionClientId(ing))
  const pos = indices.indexOf(flatIndex)
  if (pos < 0) return false
  const target = pos + delta
  return target >= 0 && target < indices.length
}

function moveIngredientInSection(flatIndex: number, delta: -1 | 1) {
  const ing = form.ingredients[flatIndex]
  if (!ing) return
  const indices = getFlatIndicesInSection(getIngredientSectionClientId(ing))
  const pos = indices.indexOf(flatIndex)
  const targetPos = pos + delta
  if (pos < 0 || targetPos < 0 || targetPos >= indices.length) return
  spliceIngredientToIndex(flatIndex, indices[targetPos]!)
}

const desktopIngredientDrag = ref(false)
const ingredientDragSectionId = ref<string | null>(null)
const ingredientDragFromClientId = ref<string | null>(null)
const ingredientDropOverClientId = ref<string | null>(null)
const ingredientDropPosition = ref<'before' | 'after'>('before')

let desktopIngredientDragMq: MediaQueryList | null = null

function updateDesktopIngredientDrag() {
  desktopIngredientDrag.value = window.matchMedia('(min-width: 1100px)').matches
}

function clearIngredientDragState() {
  ingredientDragSectionId.value = null
  ingredientDragFromClientId.value = null
  ingredientDropOverClientId.value = null
}

function findFlatIndexByClientId(clientId: string | undefined): number {
  if (!clientId) return -1
  return form.ingredients.findIndex((i) => i.client_id === clientId)
}

function onIngredientDragStart(
  e: DragEvent,
  sectionId: string,
  item: { ing: IngredientRow; flatIndex: number }
) {
  if (!desktopIngredientDrag.value || !item.ing.client_id || !e.dataTransfer) return
  ingredientDragSectionId.value = sectionId
  ingredientDragFromClientId.value = item.ing.client_id
  e.dataTransfer.effectAllowed = 'move'
  e.dataTransfer.setData('text/plain', item.ing.client_id)
}

function onIngredientDragEnd() {
  clearIngredientDragState()
}

type IngredientDropTarget = { clientId: string; position: 'before' | 'after' }

function resolveIngredientDropTarget(
  listEl: HTMLElement,
  sectionId: string,
  clientY: number
): IngredientDropTarget | null {
  if (!ingredientDragFromClientId.value || ingredientDragSectionId.value !== sectionId) {
    return null
  }
  const fromId = ingredientDragFromClientId.value
  const cards = Array.from(listEl.querySelectorAll<HTMLElement>('[data-ingredient-client-id]'))

  for (const card of cards) {
    const id = card.dataset.ingredientClientId
    if (!id || id === fromId) continue
    const rect = card.getBoundingClientRect()
    if (clientY < rect.top + rect.height / 2) {
      return { clientId: id, position: 'before' }
    }
  }

  for (let i = cards.length - 1; i >= 0; i--) {
    const id = cards[i]?.dataset.ingredientClientId
    if (id && id !== fromId) {
      return { clientId: id, position: 'after' }
    }
  }
  return null
}

function applyIngredientDropTarget(target: IngredientDropTarget) {
  const fromId = ingredientDragFromClientId.value
  if (!fromId) return
  const fromIndex = findFlatIndexByClientId(fromId)
  const anchorIndex = findFlatIndexByClientId(target.clientId)
  if (fromIndex < 0 || anchorIndex < 0) return

  const toIndex = target.position === 'after' ? anchorIndex + 1 : anchorIndex
  spliceIngredientToIndex(fromIndex, toIndex)
}

function showIngredientDropLineBefore(item: { ing: IngredientRow }): boolean {
  return (
    !!item.ing.client_id &&
    ingredientDropOverClientId.value === item.ing.client_id &&
    ingredientDropPosition.value === 'before'
  )
}

function showIngredientDropLineAfterLast(group: { items: { ing: IngredientRow }[] }): boolean {
  const last = group.items[group.items.length - 1]
  if (!last?.ing.client_id) return false
  return (
    ingredientDropOverClientId.value === last.ing.client_id &&
    ingredientDropPosition.value === 'after'
  )
}

function onIngredientSectionDragOver(e: DragEvent, sectionId: string) {
  if (!ingredientDragFromClientId.value || ingredientDragSectionId.value !== sectionId) return
  if (e.dataTransfer) e.dataTransfer.dropEffect = 'move'
  const listEl = e.currentTarget as HTMLElement | null
  if (!listEl) return
  const target = resolveIngredientDropTarget(listEl, sectionId, e.clientY)
  if (target) {
    ingredientDropOverClientId.value = target.clientId
    ingredientDropPosition.value = target.position
  } else {
    ingredientDropOverClientId.value = null
  }
}

function onIngredientSectionDragLeave(e: DragEvent) {
  const related = e.relatedTarget as Node | null
  const current = e.currentTarget as HTMLElement | null
  if (related && current?.contains(related)) return
  ingredientDropOverClientId.value = null
}

function onIngredientSectionDrop(e: DragEvent, sectionId: string) {
  const listEl = e.currentTarget as HTMLElement | null
  if (!listEl) {
    clearIngredientDragState()
    return
  }
  const target = resolveIngredientDropTarget(listEl, sectionId, e.clientY)
  if (target) {
    applyIngredientDropTarget(target)
  }
  clearIngredientDragState()
}

function deleteIngredientGroup(sectionId: string) {
  if (sectionId === UNGROUPED_SECTION_ID) return
  emptyEditorGroups.value = emptyEditorGroups.value.filter((g) => g.id !== sectionId)

  const indicesToRemove: number[] = []
  form.ingredients.forEach((ing, i) => {
    if (ing.section_client_id !== sectionId) return
    if (ingredientHasContent(ing)) {
      ing.section_heading = null
      ing.section_client_id = null
      ing.section_id = null
    } else {
      indicesToRemove.push(i)
    }
  })

  for (let r = indicesToRemove.length - 1; r >= 0; r--) {
    const idx = indicesToRemove[r]!
    form.ingredients.splice(idx, 1)
    remapIndexSetAfterRemove(expandedOriginalLineIndices, idx)
    remapIndexSetAfterRemove(editingIngredientIndices, idx)
  }

  sectionOrderIds.value = sectionOrderIds.value.filter((id) => id !== sectionId)

  if (form.ingredients.length === 0) {
    form.ingredients.push(createIngredientRow())
  }
  rebuildSectionOrderIds()
}

function unlinkBookSource() {
  selectedSourceId.value = null
  form.source_page = ''
  showBookPicker.value = false
}

function updateSectionHeading(sectionId: string, value: string) {
  if (sectionId === UNGROUPED_SECTION_ID) return
  const empty = emptyEditorGroups.value.find((g) => g.id === sectionId)
  if (empty) {
    empty.heading = value
  }
  form.ingredients.forEach((ing) => {
    if (ing.section_client_id === sectionId) {
      ing.section_heading = value
      ing.section_id = null
    }
  })
}

function setIngredientCategorySelect(ing: IngredientRow, value: string) {
  const v = value.trim()
  ing.category = v ? v : null
}

function truncateText(text: string, maxLen: number): string {
  const t = text.trim()
  if (t.length <= maxLen) return t
  return `${t.slice(0, maxLen)}…`
}

function addIngredient() {
  const last = form.ingredients[form.ingredients.length - 1]
  form.ingredients.push(
    createIngredientRow({
      category: last?.category ?? null,
      additional_info: '',
      section_heading: last?.section_heading ?? '',
      section_id: last?.section_id ?? null,
      section_client_id: last?.section_client_id ?? null,
    })
  )
  const newIdx = form.ingredients.length - 1
  openIngredientEdit(newIdx)
}

function removeIngredient(index: number) {
  form.ingredients.splice(index, 1)
  remapIndexSetAfterRemove(expandedOriginalLineIndices, index)
  remapIndexSetAfterRemove(editingIngredientIndices, index)
}

function addStep() {
  form.recipe_steps.push({ instruction: '' })
  openStepEdit(form.recipe_steps.length - 1)
}

function removeStep(index: number) {
  form.recipe_steps.splice(index, 1)
  remapIndexSetAfterRemove(editingStepIndices, index)
}

function nextStep() {
  if (currentStep.value < steps.length - 1) {
    currentStep.value++
  }
}

function prevStep() {
  if (currentStep.value > 0) {
    currentStep.value--
  }
}

function goToStep(idx: number) {
  currentStep.value = idx
}

function assignFromInitial() {
  expandedOriginalLineIndices.value = new Set()
  editingIngredientIndices.value = new Set()
  editingStepIndices.value = new Set()
  emptyEditorGroups.value = []
  sectionOrderIds.value = []
  editorClientIdSeq = 0
  showBookPicker.value = false
  showUrlEdit.value = false
  showOriginalLines.value = props.editingStatus === 'draft'
  showFullOcrText.value = false
  importMethod.value = 'manual'
  if (props.initial) {
    form.title = props.initial.title ?? ''
    form.subtitle = props.initial.subtitle ?? ''
    form.description = props.initial.description ?? ''
    const initialTips = (props.initial as { tips?: string[] })?.tips
    form.tips_notes = Array.isArray(initialTips) ? initialTips.join('\n') : ''
    form.servings = props.initial.servings ?? null
    form.prep_time = props.initial.prep_time_min ?? null
    form.cook_time = props.initial.cook_time_min ?? null
    form.would_cook_again = (props.initial as any).would_cook_again ?? null
    form.tags = Array.isArray(props.initial.tags) ? [...props.initial.tags] : []
    form.source_page = props.initial.source_page ?? ''
    // Uploaded image path, or best remote URL from URL import
    currentImageUrl.value = getRecipeFormPreviewUrl({
      image_path: (props.initial as { image_path?: string | null }).image_path ?? null,
      image_urls_json: (props.initial as { image_urls_json?: string | null }).image_urls_json ?? null,
    })
    imagePreview.value = null
    imageFile.value = null
    deferImageProcessing.value = false
    form.ingredients = (props.initial.ingredients ?? []).map((ing) =>
      createIngredientRow({
        amount: ing.amount != null ? String(ing.amount) : '',
        unit: ing.unit ?? '',
        name: ing.name ?? '',
        category: (ing as IngredientRow).category ?? null,
        section_id: (ing as IngredientRow & { section_id?: number }).section_id ?? null,
        section_heading: (ing as IngredientRow).section_heading ?? null,
        original_text: ing.original_text ?? (ing as any).originalText ?? null,
        additional_info:
          (ing.additional_info ?? (ing as { additionalInfo?: string | null }).additionalInfo ?? '') ?? '',
      })
    )
    if (form.ingredients.length === 0) {
      form.ingredients = [createIngredientRow()]
    }
    ensureIngredientClientIds()
    assignSectionClientIdsOnLoad()
    rebuildSectionOrderIds()
    form.recipe_steps = (props.initial.recipe_steps ?? []).map((s) => ({
      instruction: s.instruction ?? '',
    }))
    if (form.recipe_steps.length === 0) form.recipe_steps = [{ instruction: '' }]
    const method = props.initial.import_method ?? 'manual'
    importMethod.value =
      method === 'url' || method === 'image' || method === 'manual' ? method : 'manual'

    originalPageUrl.value = props.initial.original_url?.trim() ?? ''

    const srcId = props.initial.source_id ?? null
    const srcType = (props.initial.source_type ?? '').toLowerCase()
    if (srcId != null && (srcType === 'book' || isWebsiteSourceType(srcType))) {
      selectedSourceId.value = srcId
    } else {
      selectedSourceId.value = null
    }
  } else {
    form.title = ''
    form.subtitle = ''
    form.description = ''
    form.tips_notes = ''
    form.servings = null
    form.prep_time = null
    form.cook_time = null
    form.would_cook_again = null
    form.tags = []
    form.source_page = ''
    form.ingredients = [createIngredientRow()]
    ensureIngredientClientIds()
    rebuildSectionOrderIds()
    form.recipe_steps = [{ instruction: '' }]
    selectedSourceId.value = null
    originalPageUrl.value = ''
    currentImageUrl.value = null
    imagePreview.value = null
    imageFile.value = null
  }
}

function onImageSelected(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file || !file.type.startsWith('image/')) return

  imageFile.value = file
  imagePreview.value = URL.createObjectURL(file)
  newImageCropNaturalPoints.value = null
  input.value = ''
}

async function rotateNewImage() {
  const file = imageFile.value
  if (!file) return
  const rotated = await rotateImageFile90(file)
  if (imagePreview.value) URL.revokeObjectURL(imagePreview.value)
  imageFile.value = rotated
  imagePreview.value = URL.createObjectURL(rotated)
  newImageCropNaturalPoints.value = null
}

function removeImage() {
  if (imagePreview.value) {
    URL.revokeObjectURL(imagePreview.value)
  }
  imagePreview.value = null
  imageFile.value = null
  newImageCropNaturalPoints.value = null
  // Set a marker that we want to delete the image
  if (currentImageUrl.value) {
    currentImageUrl.value = '__DELETE__'
  }
}

watch(
  () => props.editingId,
  (editingId, prevEditingId) => {
    assignFromInitial()
    if (prevEditingId === undefined || editingId !== prevEditingId) {
      currentStep.value = 0
    }
  },
  { immediate: true }
)

watch(
  () => props.editingStatus,
  (status) => {
    if (status === 'draft' || status === 'confirmed') {
      showOriginalLines.value = status === 'draft'
    }
  }
)

watch(
  () => props.initial,
  () => {
    if (props.editingId == null) return
    const step = currentStep.value
    const expanded = expandedOriginalLineIndices.value
    const editingIng = editingIngredientIndices.value
    const editingSt = editingStepIndices.value
    assignFromInitial()
    currentStep.value = step
    expandedOriginalLineIndices.value = expanded
    editingIngredientIndices.value = editingIng
    editingStepIndices.value = editingSt
  }
)

onMounted(async () => {
  updateDesktopIngredientDrag()
  desktopIngredientDragMq = window.matchMedia('(min-width: 1100px)')
  desktopIngredientDragMq.addEventListener('change', updateDesktopIngredientDrag)
  try {
    const all = await listSources()
    bookSources.value = all.filter((s) => s.type === 'book')
  } catch {
    bookSources.value = []
  }
  try {
    const opt = await getRecipeTagOptions()
    allAllowedTags.value = opt.all_allowed
  } catch {
    allAllowedTags.value = []
  }
})

onBeforeUnmount(() => {
  desktopIngredientDragMq?.removeEventListener('change', updateDesktopIngredientDrag)
  closeCropModal()
  if (imagePreview.value?.startsWith('blob:')) URL.revokeObjectURL(imagePreview.value)
})

function timeFieldPayload(
  formVal: number | null | undefined,
  initMin: number | null | undefined,
  initSrc: 'original' | 'estimated' | null | undefined,
  initConf: number | null | undefined
): {
  min: number | null
  source: 'original' | 'estimated' | null
  confidence: number | null
} {
  const v =
    formVal != null && !Number.isNaN(Number(formVal)) && Number(formVal) > 0
      ? Math.round(Number(formVal))
      : null
  if (v == null) {
    return { min: null, source: null, confidence: null }
  }
  const i =
    initMin != null && !Number.isNaN(Number(initMin)) && Number(initMin) > 0
      ? Math.round(Number(initMin))
      : null
  if (i !== null && v === i) {
    return {
      min: v,
      source: initSrc === 'estimated' || initSrc === 'original' ? initSrc : null,
      confidence: initConf != null && !Number.isNaN(Number(initConf)) ? Number(initConf) : null,
    }
  }
  return { min: v, source: 'original', confidence: null }
}

function onSubmitForm() {
  handleSubmit()
}

function triggerSave() {
  handleSubmit()
}

defineExpose({ triggerSave })

function handleSubmit(options?: { processImageLater?: boolean }) {
  const ingredients: IngredientInput[] = form.ingredients
    .filter((ing) => ing.name.trim() !== '')
    .map((ing, i) => ({
      amount: ing.amount.trim() || null,
      unit: ing.unit.trim() || null,
      name: ing.name.trim(),
      position: i,
      section_id: null,
      original_text: ing.original_text ?? null,
      category: ing.category?.trim() || null,
      additional_info: ing.additional_info?.trim() || null,
      section_heading: (ing.section_heading ?? '').trim() || null,
    }))
  const recipe_steps: RecipeStepInput[] = form.recipe_steps
    .filter((s) => s.instruction.trim() !== '')
    .map((s, i) => ({ step_number: i + 1, instruction: s.instruction.trim() }))

  const tipsTrimmed = form.tips_notes.trim()
  const tips = tipsTrimmed
    ? tipsTrimmed.split(/\n/).map((s) => s.trim()).filter(Boolean)
    : undefined
  const init = props.initial
  const prepMeta = timeFieldPayload(
    form.prep_time,
    init?.prep_time_min,
    init?.prep_time_source,
    init?.prep_time_confidence
  )
  const cookMeta = timeFieldPayload(
    form.cook_time,
    init?.cook_time_min,
    init?.cook_time_source,
    init?.cook_time_confidence
  )

  const payload: RecipeFormPayload = {
    title: form.title.trim(),
    subtitle: form.subtitle.trim() || null,
    description: form.description.trim() || null,
    servings: form.servings && form.servings > 0 ? form.servings : null,
    would_cook_again: form.would_cook_again ?? null,
    source_id: selectedSourceId.value,
    source_page: isPrimaryBook.value ? (form.source_page.trim() || null) : null,
    original_url: originalPageUrl.value.trim() || null,
    prep_time_min: prepMeta.min,
    cook_time_min: cookMeta.min,
    prep_time_source: prepMeta.source,
    cook_time_source: cookMeta.source,
    prep_time_confidence: prepMeta.confidence,
    cook_time_confidence: cookMeta.confidence,
    ingredients,
    recipe_steps,
    ...(tips != null ? { tips } : {}),
    tags: [...form.tags],
  }

  // Pass image file or delete marker, and optional 4-point crop (for new image upload)
  const imageToUpload = imageFile.value || (currentImageUrl.value === '__DELETE__' ? ('DELETE' as any) : null)
  const cropLater = !!(imageToUpload instanceof File && deferImageProcessing.value)
  const cropPointsForUpload =
    imageToUpload instanceof File && !cropLater ? getNewImageCropPoints() : undefined
  emit('submit', payload, imageToUpload, cropPointsForUpload, {
    ...options,
    processImageLater: cropLater || options?.processImageLater,
  })
}
</script>

<style scoped>
.recipe-form-multi {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
}

.editor-review-notice {
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
  margin-bottom: var(--spacing-xs);
  padding: 0.5rem 0.6rem;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  background: color-mix(in srgb, var(--color-surface-subtle) 55%, transparent);
}

.editor-review-notice__row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--spacing-sm);
  min-width: 0;
}

.editor-review-notice__text {
  flex: 1 1 auto;
  min-width: 0;
  margin: 0;
  font-size: 0.8125rem;
  line-height: 1.4;
  color: var(--color-text-muted);
}

.editor-review-notice__action {
  flex: 0 0 auto;
  margin-left: auto;
}

@media (max-width: 767px) {
  .editor-review-notice__row {
    flex-direction: column;
    align-items: stretch;
  }

  .editor-review-notice__action {
    width: 100%;
    margin-left: 0;
    justify-content: center;
  }
}

.source-section {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
}

.source-block {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
}

.source-block__kind {
  margin: 0;
  font-size: 0.75rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--color-text-muted);
}

.source-block__kind--secondary {
  margin-top: var(--spacing-xs);
}

.source-block__action {
  align-self: flex-start;
}

.source-block__inline-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem 0.75rem;
}

.source-link-row {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  min-width: 0;
}

.source-link-row__link {
  color: var(--color-primary);
  font-size: 0.95rem;
  font-weight: 500;
  text-decoration: none;
  min-width: 0;
}

.source-link-row__link:hover {
  text-decoration: underline;
}

.source-link-row__edit {
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 1.75rem;
  height: 1.75rem;
  padding: 0;
  border: none;
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--color-text-muted);
  cursor: pointer;
}

.source-link-row__edit svg {
  width: 0.95rem;
  height: 0.95rem;
}

.source-link-row__edit:hover {
  color: var(--color-text);
  background: var(--color-surface-subtle);
}

.source-page-field {
  max-width: 8rem;
  margin-top: 0.15rem;
}

.source-original-link {
  margin-top: var(--spacing-xs);
  padding-top: var(--spacing-sm);
  border-top: 1px solid var(--color-border);
}

.source-book-card {
  display: flex;
  gap: var(--spacing-sm);
  align-items: flex-start;
  padding: var(--spacing-sm);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-surface-subtle);
}

.source-book-card__cover {
  width: 48px;
  height: 64px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--color-bg-muted);
  border-radius: var(--radius-sm);
  overflow: hidden;
  color: var(--color-text-muted);
  font-size: 0.85rem;
}

.source-book-card__cover img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.source-book-card__meta {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
}

.source-book-card__title {
  font-weight: 600;
  font-size: 0.95rem;
  line-height: 1.3;
}

.source-book-card__subtitle,
.source-book-card__line {
  font-size: 0.82rem;
  line-height: 1.35;
}

.source-url-edit {
  margin-top: var(--spacing-xs);
  padding-top: var(--spacing-sm);
  border-top: 1px solid var(--color-border);
}

.source-book-picker {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
  margin-top: var(--spacing-sm);
  padding-top: var(--spacing-sm);
  border-top: 1px solid var(--color-border);
}

.ingredients-list-header {
  display: flex;
  justify-content: flex-end;
  align-items: center;
  margin-bottom: var(--spacing-xs);
}

.ingredients-list-header__actions {
  display: flex;
  align-items: center;
  gap: 0.35rem;
}

.ingredients-icon-btn {
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

.ingredients-icon-btn svg {
  width: 1.05rem;
  height: 1.05rem;
}

.ingredients-icon-btn:hover {
  color: var(--color-text);
  background: var(--color-surface-subtle);
  border-color: var(--color-border);
}

.ingredients-icon-btn--active {
  color: var(--color-primary);
  background: color-mix(in srgb, var(--color-primary) 10%, transparent);
  border-color: color-mix(in srgb, var(--color-primary) 28%, transparent);
}

.ingredients-icon-btn--done {
  color: var(--color-success);
}

.ingredients-icon-btn--done:hover {
  color: var(--color-success);
  background: var(--color-success-soft);
}

.ingredients-icon-btn--subtle {
  width: 1.75rem;
  height: 1.75rem;
}

.ingredients-ocr-link {
  padding: 0.2rem 0.45rem;
  border: none;
  border-radius: var(--radius-sm);
  background: transparent;
  font: inherit;
  font-size: 0.78rem;
  color: var(--color-text-muted);
  cursor: pointer;
  text-decoration: underline;
  text-underline-offset: 2px;
}

.ingredients-ocr-link:hover {
  color: var(--color-primary);
}

.ingredients-step__layout {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
  min-width: 0;
}

.ingredients-step__main {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
  min-width: 0;
}

.ingredients-list-header + .ingredient-section .ingredient-section__heading-row,
.ingredients-list-header + .ingredient-section .ingredient-section__ungrouped-header {
  padding-top: 0;
}

.ingredients-ocr-mobile {
  margin-top: var(--spacing-sm);
  margin-bottom: var(--spacing-sm);
  padding: var(--spacing-xs) 0;
  border-top: 1px solid var(--color-border);
}

.ingredients-ocr-aside {
  display: none;
}

.ingredients-ocr-aside__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--spacing-sm);
  margin-bottom: var(--spacing-xs);
}

.ingredients-ocr-aside__title {
  margin: 0;
  font-size: 0.8rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--color-text-muted);
}

.ingredients-ocr-aside__body {
  flex: 1;
  min-height: 0;
  max-height: none;
}

.original-text-panel {
  margin-bottom: var(--spacing-md);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  padding: 0.5rem 0.75rem;
  background: var(--color-surface-subtle);
}

.original-text-panel__body {
  margin: 0;
  font-size: 0.82rem;
  white-space: pre-wrap;
  color: var(--color-text-muted);
  max-height: 200px;
  overflow: auto;
  font-family: inherit;
  line-height: 1.45;
}

.ingredients-ocr-mobile .original-text-panel__body {
  max-height: min(40vh, 280px);
}

@media (min-width: 1024px) and (orientation: landscape), (min-width: 1200px) {
  .form-step--ingredients--ocr-open .ingredients-step__layout {
    display: grid;
    grid-template-columns: minmax(0, 1fr) min(18rem, 36%);
    align-items: start;
    gap: var(--spacing-md);
  }

  .form-step--ingredients--ocr-open .ingredients-ocr-aside {
    display: flex;
    flex-direction: column;
    position: sticky;
    top: 0;
    max-height: min(70vh, 520px);
    padding: var(--spacing-sm) var(--spacing-md);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    background: var(--color-surface-subtle);
  }

  .form-step--ingredients--ocr-open .ingredients-ocr-aside .original-text-panel__body {
    max-height: min(60vh, 460px);
  }

  .form-step--ingredients--ocr-open .ingredients-ocr-mobile {
    display: none;
  }
}

.ingredient-section__delete {
  margin-left: auto;
}

.ingredients-step__bottom-actions {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
  margin-top: var(--spacing-sm);
}

.ingredient-card__aside {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 0.35rem;
  flex-shrink: 0;
}

.ingredient-card__drag-handle {
  display: none;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  width: 2rem;
  height: 2rem;
  margin: 0;
  padding: 0;
  border: 0;
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--color-text-muted);
  cursor: grab;
  touch-action: none;
}

.ingredient-card__drag-handle svg {
  width: 1.125rem;
  height: 1.125rem;
}

.ingredient-card__drag-handle:hover {
  color: var(--color-text);
  background: var(--color-bg-muted);
}

.ingredient-card__drag-handle:active {
  cursor: grabbing;
}

.ingredient-card__drag-handle--edit {
  align-self: flex-start;
  margin-top: 0.15rem;
}

.ingredient-card__reorder--touch {
  display: flex;
  gap: 0.2rem;
  justify-content: flex-end;
}

.ingredient-card__move-btn {
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

.ingredient-card__move-btn svg {
  width: 1.125rem;
  height: 1.125rem;
}

.ingredient-card__move-btn:hover:not(:disabled) {
  color: var(--color-text);
  background: var(--color-bg-muted);
  border-color: var(--color-border);
}

.ingredient-card__move-btn:disabled {
  opacity: 0.35;
  cursor: not-allowed;
}

.ingredient-section__list {
  display: flex;
  flex-direction: column;
  gap: 0;
  min-height: 0.25rem;
}

.ingredient-drop-line {
  flex-shrink: 0;
  height: 1px;
  margin: 2px 0;
  border-radius: 1px;
  background: var(--color-primary);
  box-shadow: none;
  pointer-events: none;
}

.ingredient-card--dragging {
  opacity: 0.45;
}

@media (min-width: 1100px) {
  .ingredient-card__drag-handle {
    display: inline-flex;
  }

  .ingredient-card__reorder--touch {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border: 0;
  }

  .ingredient-card__reorder--touch:focus-within {
    position: static;
    width: auto;
    height: auto;
    margin: 0;
    overflow: visible;
    clip: auto;
    white-space: normal;
    display: flex;
  }

  .ingredient-card__edit-row--main {
    grid-template-columns: 2rem 72px 88px minmax(0, 1fr) auto auto;
  }

  .ingredient-card__aside {
    flex-direction: row;
    align-items: center;
    gap: 0.25rem;
  }
}

.ingredient-card__group-select {
  max-width: 6.5rem;
  font-size: 0.68rem;
  padding: 0.15rem 0.25rem;
  border-radius: var(--radius-sm);
  border: 1px solid var(--color-border);
  background: var(--color-bg);
  color: var(--color-text-muted);
}

.editor-sections {
  display: flex;
  flex-wrap: nowrap;
  align-items: flex-end;
  gap: var(--spacing-md);
  max-width: 100%;
  margin-top: var(--spacing-sm);
  margin-bottom: var(--spacing-md);
  padding: 0;
  overflow-x: auto;
  overflow-y: hidden;
  -webkit-overflow-scrolling: touch;
  scrollbar-width: none;
  border: none;
  border-bottom: 1px solid var(--color-border);
  background: transparent;
}

.editor-sections::-webkit-scrollbar {
  display: none;
}

.editor-sections__tab {
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0 0 8px;
  margin-bottom: -1px;
  border: none;
  border-bottom: 2px solid transparent;
  background: none;
  font: inherit;
  font-size: 0.875rem;
  font-weight: 500;
  line-height: 1.25;
  color: var(--color-text-muted);
  cursor: pointer;
  white-space: nowrap;
}

.editor-sections__tab:hover {
  color: var(--color-text);
}

.editor-sections__tab--active {
  color: var(--color-accent);
  border-bottom-color: var(--color-accent);
  font-weight: 560;
}

.editor-sections__label {
  font-weight: inherit;
}

.editor-sections__hint {
  font-size: 0.625rem;
  font-weight: 650;
  letter-spacing: 0.03em;
  line-height: 1.2;
  padding: 0.12rem 0.32rem;
  border-radius: var(--radius-sm);
}

.editor-sections__hint--review {
  color: var(--color-warning);
  background: var(--color-warning-soft);
  border: 1px solid color-mix(in srgb, var(--color-warning) 22%, transparent);
}

.editor-sections__hint--missing {
  color: var(--color-text-muted);
  background: var(--color-surface-subtle);
  border: 1px solid var(--color-border);
}

/* Progress Steps (legacy) */
.form-progress {
  display: flex;
  justify-content: space-between;
  gap: var(--spacing-md);
  padding-bottom: var(--spacing-lg);
  border-bottom: 1px solid var(--color-border);
}

.form-progress__step {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--spacing-sm);
  flex: 1;
  position: relative;
  cursor: pointer;
  transition: all var(--transition-fast);
}

.form-progress__step:hover .form-progress__number {
  transform: scale(1.1);
}

.form-progress__step:not(:last-child)::after {
  content: '';
  position: absolute;
  top: 20px;
  left: 50%;
  right: -50%;
  height: 2px;
  background: var(--color-border);
  z-index: -1;
}

.form-progress__step--completed:not(:last-child)::after {
  background: var(--color-primary);
}

.form-progress__number {
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-full);
  background: var(--color-bg-muted);
  color: var(--color-text-muted);
  font-weight: 600;
  transition: all var(--transition-base);
}

.form-progress__step--active .form-progress__number {
  background: var(--color-primary);
  color: white;
  box-shadow: 0 0 0 4px rgba(255, 107, 53, 0.2);
}

.form-progress__step--completed .form-progress__number {
  background: var(--color-primary);
  color: white;
}

.form-progress__number svg {
  width: 20px;
  height: 20px;
  stroke-width: 3;
}

.form-progress__label {
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--color-text-muted);
}

.form-progress__step--active .form-progress__label {
  color: var(--color-primary);
  font-weight: 600;
}

/* Form Content */
.form-content {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xl);
}

.form-step {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-lg);
  animation: fadeIn 0.3s ease;
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.form-step__title {
  font-size: 1.5rem;
  font-weight: 700;
  color: var(--color-text);
  margin: 0;
}

.form-step__description {
  font-size: 1rem;
  color: var(--color-text-muted);
  margin: -0.5rem 0 0 0;
}

/* Form Fields */
.form-field {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xs);
}

.form-field--required label::after {
  content: ' *';
  color: var(--color-required);
}

.form-field label {
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--color-text);
}

.form-input,
.form-textarea {
  padding: var(--spacing-sm) var(--spacing-md);
  border: 1px solid var(--color-input-border);
  border-radius: var(--radius-md);
  font: inherit;
  font-size: 0.95rem;
  background: var(--color-input-bg);
  color: var(--color-text);
  transition: all var(--transition-fast);
}

.form-input:focus,
.form-textarea:focus {
  outline: none;
  border-color: var(--color-input-focus);
  box-shadow: 0 0 0 3px rgba(255, 107, 53, 0.1);
}

.form-textarea {
  resize: vertical;
  min-height: 80px;
}

.form-input--small {
  max-width: 200px;
}

.form-row {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: var(--spacing-md);
}

/* Sections — major breaks use shared .document-section gradient (components.css) */
.form-section.document-section {
  padding-top: 0;
  border-top: none;
}

.form-section--image.document-section {
  margin-bottom: var(--spacing-lg);
}

.form-section__title {
  font-size: 1.125rem;
  font-weight: 600;
  color: var(--color-text);
  margin: 0 0 var(--spacing-md) 0;
}

/* Image Upload */
.image-upload {
  display: flex;
  flex-direction: row;
  align-items: flex-start;
  gap: var(--spacing-md);
  flex-wrap: wrap;
}

.image-upload__input {
  position: absolute;
  width: 0;
  height: 0;
  opacity: 0;
  pointer-events: none;
}

.image-upload__preview {
  position: relative;
  width: 200px;
  height: 150px;
  border-radius: var(--radius-lg);
  overflow: hidden;
  border: 2px solid var(--color-border);
  flex-shrink: 0;
}

.image-upload__preview-pending {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--spacing-sm);
  width: 100%;
  min-height: 160px;
  padding: var(--spacing-lg);
  margin: 0;
  border: 1px dashed var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-bg-elevated);
  color: var(--color-text-muted);
  font-size: 0.9rem;
  text-align: center;
  cursor: pointer;
  transition: border-color var(--transition-fast), color var(--transition-fast);
}

.image-upload__preview-pending:hover {
  border-color: var(--color-primary);
  color: var(--color-text);
}

.image-upload__pending-icon svg {
  width: 40px;
  height: 40px;
  opacity: 0.9;
}

.image-upload__preview img,
.image-upload__preview-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.image-upload__preview-icons {
  position: absolute;
  top: var(--spacing-sm);
  left: var(--spacing-sm);
  display: flex;
  gap: 0.3rem;
  z-index: 2;
}

.image-upload__preview-icons .icon-btn {
  width: 1.8rem;
  height: 1.8rem;
  border: 0;
  border-radius: 999px;
  background: rgba(0, 0, 0, 0.62);
  color: #fff;
  font-size: 1rem;
  cursor: pointer;
}

.image-upload__crop-badge {
  position: absolute;
  left: var(--spacing-sm);
  bottom: var(--spacing-sm);
  background: rgba(0, 0, 0, 0.62);
  color: #fff;
  font-size: 0.7rem;
  font-weight: 600;
  padding: 0.2rem 0.45rem;
  border-radius: 999px;
}

.image-upload__crop-error {
  margin: var(--spacing-sm) 0 0 0;
  font-size: 0.875rem;
  color: var(--color-error, #c00);
}

.image-upload__remove {
  position: absolute;
  top: var(--spacing-sm);
  right: var(--spacing-sm);
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  border-radius: var(--radius-md);
  background: rgba(0, 0, 0, 0.7);
  color: white;
  cursor: pointer;
  transition: all var(--transition-fast);
}

.image-upload__remove:hover {
  background: var(--color-error);
}

.image-upload__remove svg {
  width: 18px;
  height: 18px;
  stroke-width: 2;
}

.image-upload__placeholder {
  width: 200px;
  height: 150px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--spacing-sm);
  border: 2px dashed var(--color-border);
  border-radius: var(--radius-lg);
  background: var(--color-bg-muted);
  color: var(--color-text-muted);
  flex-shrink: 0;
}

.image-upload__placeholder svg {
  width: 32px;
  height: 32px;
  opacity: 0.5;
}

.image-upload__placeholder p {
  margin: 0;
  font-size: 0.75rem;
}

.image-upload__defer {
  display: flex;
  align-items: flex-start;
  gap: var(--spacing-sm);
  margin-top: var(--spacing-md);
  font-size: 0.875rem;
  color: var(--color-text-muted);
  cursor: pointer;
}

.image-upload__defer input {
  margin-top: 0.2em;
}

.image-upload__actions {
  display: flex;
  gap: var(--spacing-sm);
  flex-wrap: wrap;
  align-items: center;
}

/* Radio Group */
.form-radio-group {
  display: flex;
  gap: var(--spacing-md);
  flex-wrap: wrap;
}

.form-radio {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  padding: var(--spacing-sm) var(--spacing-md);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: all var(--transition-fast);
}

.form-radio:hover {
  border-color: var(--color-primary);
  background: rgba(255, 107, 53, 0.05);
}

.form-radio input {
  cursor: pointer;
}

.source-url-field {
  margin-top: var(--spacing-md);
}

.source-url-field__hint {
  margin: var(--spacing-xs) 0 0;
  font-size: 0.85rem;
  color: var(--color-text-muted);
}

/* Source Selection */
.source-selection {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
  margin-top: var(--spacing-md);
}

.source-books {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: var(--spacing-md);
}

.source-book {
  display: flex;
  gap: var(--spacing-sm);
  padding: var(--spacing-sm);
  border: 2px solid var(--color-border);
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: all var(--transition-fast);
}

.source-book:hover {
  border-color: var(--color-primary);
  background: rgba(255, 107, 53, 0.05);
}

.source-book--selected {
  border-color: var(--color-primary);
  background: rgba(255, 107, 53, 0.08);
}

.source-book__cover {
  width: 60px;
  height: 80px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--color-bg-muted);
  border-radius: var(--radius-sm);
  overflow: hidden;
}

.source-book__cover img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.source-book__info {
  flex: 1;
  min-width: 0;
}

.source-book__title {
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--color-text);
  line-height: 1.3;
}

.source-book__subtitle {
  font-size: 0.75rem;
  color: var(--color-text-muted);
  line-height: 1.3;
}

.link-secondary {
  font-size: 0.875rem;
  color: var(--color-primary);
  text-decoration: none;
  font-weight: 500;
}

.link-secondary:hover {
  text-decoration: underline;
}

/* Ingredients (card layout) */
.form-step--ingredients {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
}

.ingredient-section {
  display: flex;
  flex-direction: column;
  gap: 0;
  padding-bottom: var(--spacing-md);
  margin-bottom: var(--spacing-sm);
  border-bottom: 1px solid var(--color-border);
}

.ingredient-section:last-of-type {
  border-bottom: none;
  margin-bottom: 0;
  padding-bottom: 0;
}

.ingredient-section__heading-row {
  display: flex;
  align-items: center;
  gap: var(--spacing-xs);
  padding: var(--spacing-xs) 0 var(--spacing-sm);
}

.ingredient-section__heading-input {
  flex: 1;
  min-width: 0;
  box-sizing: border-box;
  padding: 0.2rem 0;
  border: none;
  border-bottom: 1px solid var(--color-border);
  border-radius: 0;
  font: inherit;
  font-size: 0.82rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  background: transparent;
  color: var(--color-text-muted);
}

.ingredient-section__heading-input:focus {
  outline: none;
  border-bottom-color: var(--color-primary);
  color: var(--color-text);
}

.ingredient-section__ungrouped-header {
  padding: var(--spacing-xs) 0 var(--spacing-sm);
}

.ingredient-section__ungrouped-title {
  margin: 0;
  font-size: 0.75rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--color-text-muted);
}

.visually-hidden {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

.ingredient-card {
  display: flex;
  flex-direction: column;
  gap: 0;
  padding: 0.35rem 0;
  border: none;
  border-radius: 0;
  background: transparent;
  box-shadow: none;
}

.ingredient-card--editing {
  padding: 0.4rem 0 0.5rem;
  margin: 0 -0.15rem;
  padding-left: 0.35rem;
  border-left: 2px solid var(--color-primary);
  background: color-mix(in srgb, var(--color-primary) 6%, transparent);
}

.ingredient-card__view {
  display: flex;
  align-items: flex-start;
  gap: 0.3rem;
  min-width: 0;
}

.ingredient-card__summary {
  flex: 1;
  min-width: 0;
  text-align: left;
  padding: 0.15rem 0.25rem;
  border: none;
  border-radius: var(--radius-sm);
  background: transparent;
  cursor: pointer;
}

.ingredient-card__summary:hover {
  background: var(--color-surface-subtle);
}

.ingredient-card__summary:focus {
  outline: 2px solid var(--color-primary);
  outline-offset: 1px;
}

.ingredient-card__summary-main {
  font-size: 0.92rem;
  font-weight: 500;
  color: var(--color-text);
  line-height: 1.4;
  word-break: break-word;
}

.ingredient-card__summary-sub {
  margin-top: 0.15rem;
  font-size: 0.78rem;
  color: var(--color-text-muted);
  line-height: 1.35;
}

.ingredient-card__summary-original {
  margin-top: 0.2rem;
  font-size: 0.78rem;
  color: var(--color-text-muted);
  font-style: italic;
  line-height: 1.4;
  word-break: break-word;
}

.ingredient-card__edit {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  min-width: 0;
}

.ingredient-card__edit-row {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  min-width: 0;
}

.ingredient-card__edit-row--main {
  display: grid;
  grid-template-columns: auto 3.25rem 3.5rem minmax(0, 1fr) auto auto;
  gap: 0.35rem;
  align-items: center;
}

.ingredient-card__edit-row--meta {
  display: grid;
  grid-template-columns: minmax(0, 9.5rem) minmax(0, 1fr);
  gap: 0.35rem;
}

.ingredient-card__edit-row--original {
  gap: 0.35rem;
}

.ingredient-card__edit-row--original .ingredient-card__text-input {
  flex: 1;
  min-width: 0;
}

.ingredient-card__select--compact {
  font-size: 0.8rem;
}

.ingredient-card__select,
.ingredient-card__text-input {
  width: 100%;
  box-sizing: border-box;
  padding: var(--spacing-xs) var(--spacing-sm);
  border: 1px solid var(--color-input-border);
  border-radius: var(--radius-sm);
  font: inherit;
  font-size: 0.875rem;
  background: var(--color-input-bg);
  color: var(--color-text);
}

.ingredient-card__text-input--original {
  background: var(--color-bg-muted);
  color: var(--color-text-muted);
  font-style: italic;
}

.ingredient-card__text-input--original:focus {
  font-style: normal;
  color: var(--color-text);
  background: var(--color-input-bg);
}

.ingredient-card__link-btn {
  padding: 0;
  border: none;
  background: none;
  font: inherit;
  font-size: 0.8rem;
  font-weight: 600;
  color: var(--color-primary);
  cursor: pointer;
  text-decoration: underline;
  text-underline-offset: 2px;
}

.ingredient-card__link-btn:hover {
  color: var(--color-primary-hover, var(--color-primary));
}

.btn--tiny {
  padding: 0.25rem 0.6rem;
  font-size: 0.8rem;
  align-self: flex-start;
}

.btn--small {
  padding: 0.35rem 0.75rem;
  font-size: 0.85rem;
}

/* Instructions: compact review list (aligned with ingredients editor) */
.form-step--instructions {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
  min-width: 0;
}

.instructions-step__main {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xs);
  min-width: 0;
}

.instructions-step__list {
  display: flex;
  flex-direction: column;
  gap: 0;
  min-width: 0;
}

.instruction-card {
  display: flex;
  flex-direction: column;
  gap: 0;
  padding: 0.35rem 0;
  border: none;
  border-bottom: 1px solid var(--color-border);
  background: transparent;
}

.instruction-card:last-child {
  border-bottom: none;
}

.instruction-card--editing {
  padding: 0.4rem 0 0.5rem;
  margin: 0 -0.15rem;
  padding-left: 0.35rem;
  border-left: 2px solid var(--color-primary);
  border-bottom-color: transparent;
  background: color-mix(in srgb, var(--color-primary) 6%, transparent);
}

.instruction-card__view {
  display: flex;
  align-items: flex-start;
  gap: 0.35rem;
  min-width: 0;
}

.instruction-card__num {
  flex-shrink: 0;
  width: 1.35rem;
  padding-top: 0.275rem;
  font-size: 0.78rem;
  font-weight: 600;
  line-height: 1.35;
  text-align: right;
  color: var(--color-text-muted);
}

.instruction-card__summary {
  flex: 1;
  min-width: 0;
  text-align: left;
  padding: 0.15rem 0.25rem;
  border: none;
  border-radius: var(--radius-sm);
  background: transparent;
  cursor: pointer;
}

.instruction-card__summary:hover {
  background: var(--color-surface-subtle);
}

.instruction-card__summary:focus {
  outline: 2px solid var(--color-primary);
  outline-offset: 1px;
}

.instruction-card__summary-main {
  font-size: 0.92rem;
  color: var(--color-text);
  line-height: 1.45;
  word-break: break-word;
  white-space: pre-wrap;
}

.instruction-card__edit {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  min-width: 0;
}

.instruction-card__edit-row--main {
  display: grid;
  grid-template-columns: 1.35rem minmax(0, 1fr) auto auto;
  gap: 0.35rem;
  align-items: flex-start;
}

.instruction-card__textarea {
  box-sizing: border-box;
  width: 100%;
  min-height: 2.75rem;
  padding: 0.35rem 0.45rem;
  border: 1px solid var(--color-input-border);
  border-radius: var(--radius-sm);
  font: inherit;
  font-size: 0.9rem;
  line-height: 1.4;
  resize: vertical;
  background: var(--color-input-bg);
  color: var(--color-text);
}

.instruction-card__textarea:focus {
  outline: none;
  border-color: var(--color-input-focus);
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--color-primary) 18%, transparent);
}

.ingredient-input {
  padding: var(--spacing-sm);
  border: 1px solid var(--color-input-border);
  border-radius: var(--radius-md);
  font: inherit;
  font-size: 0.95rem;
  background: var(--color-input-bg);
  color: var(--color-text);
  transition: all var(--transition-fast);
}

.ingredient-input:focus {
  outline: none;
  border-color: var(--color-input-focus);
  box-shadow: 0 0 0 3px rgba(255, 107, 53, 0.1);
}

.btn-icon-small {
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--color-text-muted);
  cursor: pointer;
  transition: all var(--transition-fast);
  flex-shrink: 0;
}

.btn-icon-small svg {
  width: 14px;
  height: 14px;
  stroke-width: 2;
}

.btn-icon-small:hover {
  background: var(--color-delete-hover-bg);
  color: var(--color-delete-fg);
}

/* Buttons — base .btn / .btn--primary / .btn--secondary live in styles/components.css */
.btn--success {
  background: var(--color-btn-confirm-bg);
  color: white;
}

.btn--success:hover {
  background: var(--color-btn-confirm-hover);
}

.btn--ghost {
  background: transparent;
  color: var(--color-text-muted);
}

.btn--ghost:hover {
  color: var(--color-text);
  background: var(--color-bg-muted);
}

.btn--block {
  width: 100%;
}

.form-row--prep-cook-estimate {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--spacing-md);
  align-items: end;
}

.form-row--prep-cook-estimate--with-refresh {
  grid-template-columns: 1fr 1fr auto;
}

.form-field--estimate-refresh {
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
  align-items: flex-end;
  gap: var(--spacing-xs);
  min-width: 2.5rem;
}

.form-field__label-spacer {
  min-height: 1.25rem;
}

.form-section__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--spacing-sm);
  margin-bottom: var(--spacing-xs);
}

.form-section__head .form-section__title {
  margin: 0;
}

.editor-estimate-refresh {
  flex-shrink: 0;
  padding: 4px 8px;
  border: none;
  border-radius: var(--radius-xs);
  background: transparent;
  color: var(--color-text-soft);
  font-size: 0.95rem;
  line-height: 1;
  cursor: pointer;
}

.editor-estimate-refresh:hover:not(:disabled) {
  color: var(--color-accent);
  background: var(--color-surface-subtle);
}

.editor-estimate-refresh:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.editor-estimate-hint {
  margin: 0 0 var(--spacing-sm);
  font-size: 0.8rem;
  color: var(--color-error);
  line-height: 1.4;
}

.editor-estimate-retry {
  margin-left: 0.35rem;
  vertical-align: baseline;
}

.editor-nutrition-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(9rem, 1fr));
  gap: var(--spacing-sm) var(--spacing-md);
}

.editor-nutrition-item {
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
}

.editor-nutrition-label {
  font-size: 0.75rem;
  color: var(--color-text-muted);
}

.editor-nutrition-value {
  font-size: 0.9rem;
  font-weight: 600;
}

.editor-health-summary {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 0.2rem 0.5rem;
}

.editor-health-score {
  font-size: 1.35rem;
  font-weight: 700;
  color: var(--color-success);
}

.editor-health-score-max {
  font-size: 0.85rem;
  color: var(--color-text-muted);
}

.editor-health-summary__text {
  flex: 1 1 100%;
  margin: 0.25rem 0 0;
}

.btn-icon {
  width: 32px;
  height: 32px;
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

.btn-icon svg {
  width: 18px;
  height: 18px;
  stroke-width: 2;
}

.btn-icon--remove:hover {
  background: var(--color-delete-hover-bg);
  color: var(--color-delete-fg);
}

/* Review */
.review-section {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-lg);
}

.review-ingredient-list,
.review-steps-list {
  margin: 0;
  padding-left: var(--spacing-lg);
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xs);
}

.review-ingredient-list li,
.review-steps-list li {
  color: var(--color-text);
  font-size: 0.95rem;
}

/* Actions */
.form-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--spacing-sm);
  padding-top: var(--spacing-lg);
  border-top: 1px solid var(--color-border);
}

.form-actions__spacer {
  flex: 1;
  min-width: 0.5rem;
}

.form-actions__primary {
  display: flex;
  flex-wrap: wrap;
  gap: var(--spacing-sm);
  margin-left: auto;
}

.form-actions__extra {
  order: 1;
}

@media (max-width: 767px) {
  .form-actions {
    flex-direction: column;
    align-items: stretch;
    gap: var(--spacing-sm);
  }

  .form-actions__spacer {
    display: none;
  }

  .form-actions__primary {
    order: 1;
    width: 100%;
    margin-left: 0;
    flex-direction: column;
    gap: var(--spacing-sm);
  }

  .form-actions__primary .btn {
    width: 100%;
    flex: none;
    justify-content: center;
  }

  .form-actions__back {
    order: 2;
    width: 100%;
    flex: none;
    margin-left: 0;
  }
}

@media (max-width: 768px) {
  .form-progress {
    overflow-x: auto;
  }

  .form-progress__label {
    font-size: 0.75rem;
  }

  .ingredient-card__edit-row--main {
    grid-template-columns: auto 2.75rem 2.75rem minmax(0, 1fr) auto auto;
    gap: 0.25rem;
  }

  .ingredient-card__edit-row--meta {
    grid-template-columns: 1fr;
  }

  .ingredient-card__aside {
    flex-direction: row;
    flex-wrap: wrap;
    align-items: center;
    justify-content: flex-end;
    gap: 0.2rem;
  }

  .ingredient-card__group-select {
    max-width: 5.5rem;
  }

  .instruction-card__edit-row--main {
    grid-template-columns: 1.25rem minmax(0, 1fr) auto auto;
  }

  .form-row {
    grid-template-columns: 1fr;
  }

  .source-books {
    grid-template-columns: 1fr;
  }
}

.form-hint {
  margin: calc(var(--spacing-sm) * -1) 0 var(--spacing-md);
  font-size: 0.85rem;
  line-height: 1.4;
}

.form-hint--muted {
  color: var(--color-text-muted);
}

.form-hint--tags {
  margin-top: 0;
}

.tag-chip-row {
  display: flex;
  flex-wrap: wrap;
  gap: var(--spacing-xs);
  margin-bottom: var(--spacing-sm);
}

.recipe-tag-chip {
  display: inline-block;
  padding: 0.15rem 0.5rem;
  border-radius: 999px;
  font-size: 0.8rem;
  background: var(--color-bg-muted, rgba(0, 0, 0, 0.06));
  border: 1px solid var(--color-border);
}

.tag-multiselect {
  min-height: 8rem;
  font-family: inherit;
}
</style>
