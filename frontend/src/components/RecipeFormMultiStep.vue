<template>
  <div class="recipe-form-multi">
    <!-- Progress Steps -->
    <div class="form-progress">
      <div
        v-for="(step, idx) in steps"
        :key="idx"
        class="form-progress__step"
        :class="{
          'form-progress__step--active': idx === currentStep,
          'form-progress__step--completed': idx < currentStep
        }"
        @click="goToStep(idx)"
      >
        <div class="form-progress__number">
          <svg v-if="idx < currentStep" viewBox="0 0 24 24" fill="none">
            <path d="M20 6L9 17L4 12" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
          <span v-else>{{ idx + 1 }}</span>
        </div>
        <div class="form-progress__label">{{ step.label }}</div>
      </div>
    </div>

    <!-- Form Content -->
    <form class="form-content" @submit.prevent="handleSubmit">
      <!-- Step 1: Basic Info -->
      <div v-if="currentStep === 0" class="form-step">
        <!-- Recipe Image Upload -->
        <div class="form-section form-section--image">
          <h4 class="form-section__title">Recipe Image</h4>
          <div class="image-upload">
            <template v-if="showCropForExisting">
              <div class="crop-editor">
                <div ref="cropEditorRef" class="crop-editor__wrap" @click="onCropImageClick">
                  <img ref="cropImageRef" :src="cropImageUrl" alt="Crop" class="crop-editor__img" @load="onCropImageLoad" />
                  <div class="crop-editor__overlay">
                    <svg v-if="cropPoints.length === 4 && cropDisplaySize.w > 0 && cropDisplaySize.h > 0" class="crop-editor__lines" :viewBox="`0 0 ${cropDisplaySize.w} ${cropDisplaySize.h}`" preserveAspectRatio="none">
                      <polyline :points="cropPolylinePoints" fill="none" stroke="var(--color-primary)" stroke-width="2" stroke-dasharray="6 4" />
                    </svg>
                    <span v-for="(pt, i) in cropPoints" :key="i" class="crop-editor__point" :style="{ left: (pt.x - 12) + 'px', top: (pt.y - 12) + 'px' }" @mousedown.stop="onCropPointMouseDown($event, i)">{{ i + 1 }}</span>
                  </div>
                </div>
                <div class="crop-editor__actions">
                  <button type="button" class="btn btn--primary" :disabled="cropPoints.length !== 4 || cropping" @click="applyCropExisting">{{ cropping ? 'Cropping…' : 'Apply crop' }}</button>
                  <button type="button" class="btn btn--secondary" @click="cancelCropExisting">Cancel</button>
                  <button type="button" class="btn btn--secondary" @click="resetCropPoints">Reset points</button>
                </div>
                <p v-if="cropError" class="crop-editor__error">{{ cropError }}</p>
              </div>
            </template>
            <template v-else>
              <div v-if="(currentImageUrl && currentImageUrl !== '__DELETE__') || imagePreview" class="image-upload__preview">
                <img :src="imagePreview || currentImageUrl" alt="Recipe preview" />
                <button
                  type="button"
                  class="image-upload__remove"
                  @click="removeImage"
                  title="Remove image"
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
                <p>No image yet</p>
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
                  {{ (currentImageUrl && currentImageUrl !== '__DELETE__') || imagePreview ? 'Change Image' : 'Upload Image' }}
                </button>
                <button
                  v-if="currentImageUrl && currentImageUrl !== '__DELETE__'"
                  type="button"
                  class="btn btn--secondary"
                  @click="startCropExisting"
                >
                  Crop image (4 points)
                </button>
              </div>
            </template>
          </div>
          <!-- 4-point crop for newly selected image (before submit) -->
          <div v-if="imagePreview && imageFile && !showCropForExisting" class="crop-editor crop-editor--new">
            <p class="crop-editor__hint">Optional: click four corners in order to correct perspective, then save the recipe. Points are sent with the upload.</p>
            <div ref="newCropEditorRef" class="crop-editor__wrap" @click="onNewCropClick">
              <img ref="newCropImageRef" :src="imagePreview" alt="Crop" class="crop-editor__img" @load="onNewCropImageLoad" />
              <div class="crop-editor__overlay">
                <svg v-if="cropPoints.length === 4 && cropDisplaySize.w > 0 && cropDisplaySize.h > 0" class="crop-editor__lines" :viewBox="`0 0 ${cropDisplaySize.w} ${cropDisplaySize.h}`" preserveAspectRatio="none">
                  <polyline :points="cropPolylinePoints" fill="none" stroke="var(--color-primary)" stroke-width="2" stroke-dasharray="6 4" />
                </svg>
                <span v-for="(pt, i) in cropPoints" :key="i" class="crop-editor__point" :style="{ left: (pt.x - 12) + 'px', top: (pt.y - 12) + 'px' }" @mousedown.stop="onCropPointMouseDown($event, i)">{{ i + 1 }}</span>
              </div>
            </div>
            <div class="crop-editor__actions">
              <button type="button" class="btn btn--secondary" @click="resetCropPoints">Reset points</button>
            </div>
          </div>
        </div>

        <div class="form-field form-field--required">
          <label for="recipe-title">Recipe Title</label>
          <input
            id="recipe-title"
            v-model="form.title"
            type="text"
            required
            placeholder="e.g., Grandma's Apple Pie"
            class="form-input"
          />
        </div>

        <div class="form-field">
          <label for="recipe-subtitle">Subtitle</label>
          <input
            id="recipe-subtitle"
            v-model="form.subtitle"
            type="text"
            placeholder="A short tagline (optional)"
            class="form-input"
          />
        </div>

        <div class="form-field">
          <label for="recipe-description">Description</label>
          <textarea
            id="recipe-description"
            v-model="form.description"
            rows="3"
            placeholder="Brief intro or story about this recipe"
            class="form-textarea"
          />
        </div>

        <div class="form-row">
          <div class="form-field">
            <label for="recipe-servings">Servings</label>
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
          <div class="form-field">
            <label for="recipe-prep-time">Prep Time (min)</label>
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
            <label for="recipe-cook-time">Cook Time (min)</label>
            <input
              id="recipe-cook-time"
              v-model.number="form.cook_time"
              type="number"
              min="0"
              placeholder="30"
              class="form-input"
            />
          </div>
        </div>
        <p v-if="timeSourceHint" class="form-hint form-hint--muted">{{ timeSourceHint }}</p>

        <div class="form-row">
          <div class="form-field">
            <label for="would-cook-again">Would you cook this again?</label>
            <select id="would-cook-again" v-model="form.would_cook_again" class="form-input">
              <option :value="null">— Not set —</option>
              <option value="yes">Yes</option>
              <option value="maybe">Maybe</option>
              <option value="no">No</option>
            </select>
          </div>
        </div>

        <!-- Source Selection -->
        <div class="form-section">
          <h4 class="form-section__title">Source</h4>
          <div class="form-radio-group">
            <label class="form-radio">
              <input v-model="sourceType" type="radio" value="none" />
              <span>None / Manual</span>
            </label>
            <label class="form-radio">
              <input v-model="sourceType" type="radio" value="book" />
              <span>From Book</span>
            </label>
          </div>

          <div v-if="sourceType === 'book'" class="source-selection">
            <div class="source-books">
              <div
                v-for="source in bookSources"
                :key="source.id"
                class="source-book"
                :class="{ 'source-book--selected': selectedSourceId === source.id }"
                @click="selectedSourceId = source.id"
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
            <router-link to="/sources" class="link-secondary">+ Add New Book</router-link>
            <div v-if="selectedSourceId" class="form-field">
              <label for="source-page">Page Number</label>
              <input
                id="source-page"
                v-model="form.source_page"
                type="text"
                placeholder="e.g., 42"
                class="form-input form-input--small"
              />
            </div>
          </div>
        </div>

        <!-- AI Extraction Info (moved from Review step) -->
        <div v-if="hasExtractionFeedback" class="review-card review-card--info">
          <div class="review-card__header">
            <svg viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              <path d="M12 16V12" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              <path d="M12 8H12.01" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
            <h4>AI Extraction Info</h4>
          </div>
          <dl class="review-list">
            <div v-if="extractConfidence != null">
              <dt>Confidence:</dt>
              <dd>{{ Math.round(extractConfidence * 100) }}%</dd>
            </div>
            <div v-if="extractMissingFields?.length">
              <dt>Missing:</dt>
              <dd>{{ extractMissingFields.join(', ') }}</dd>
            </div>
          </dl>
        </div>
      </div>

      <!-- Step 2: Ingredients -->
      <div v-if="currentStep === 1" class="form-step form-step--ingredients">
        <p class="ingredients-step__hint">
          Ingredients are shown as plain text for review. Click a line to edit. New rows open in edit mode.
          Category keys: only values in parentheses are saved (e.g. <code>produce</code>, <code>pantry</code>).
        </p>
        <div v-for="group in ingredientsBySection" :key="group.key" class="ingredient-section">
          <div class="ingredient-section__heading-block">
            <span class="ingredient-section__heading-block-label">Section heading</span>
            <input
              type="text"
              class="ingredient-section__heading-input"
              :value="group.heading ?? ''"
              placeholder="Optional heading (e.g. Sauce, Salad)"
              @input="updateSectionHeading(group.key, ($event.target as HTMLInputElement).value)"
            />
          </div>
          <p v-if="group.heading?.trim()" class="ingredient-section__heading-preview">{{ group.heading }}</p>

          <div
            v-for="item in group.items"
            :key="`${group.key}-${item.flatIndex}`"
            class="ingredient-card"
            :class="{ 'ingredient-card--editing': isIngredientEditing(item.flatIndex) }"
          >
            <div v-if="!isIngredientEditing(item.flatIndex)" class="ingredient-card__view">
              <div
                class="ingredient-card__summary"
                role="button"
                tabindex="0"
                :aria-label="'Edit ingredient: ' + ingredientLineMain(item.ing)"
                @click="openIngredientEdit(item.flatIndex)"
                @keydown.enter.prevent="openIngredientEdit(item.flatIndex)"
                @keydown.space.prevent="openIngredientEdit(item.flatIndex)"
              >
                <div class="ingredient-card__summary-main">{{ ingredientLineMain(item.ing) }}</div>
                <div v-if="ingredientLineSub(item.ing)" class="ingredient-card__summary-sub">{{ ingredientLineSub(item.ing) }}</div>
                <div
                  v-if="!hideIngredientOriginalLine && (item.ing.original_text || '').trim()"
                  class="ingredient-card__summary-original"
                >
                  <span class="ingredient-card__summary-original-label">Original:</span>
                  {{ truncateText(item.ing.original_text ?? '', 120) }}
                </div>
              </div>
              <button
                type="button"
                class="btn-icon btn-icon--remove"
                title="Remove ingredient"
                @click.stop="removeIngredient(item.flatIndex)"
              >
                <svg viewBox="0 0 24 24" fill="none">
                  <path d="M18 6L6 18M6 6L18 18" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
              </button>
            </div>

            <template v-else>
            <div class="ingredient-card__primary">
              <input
                v-model="item.ing.amount"
                type="text"
                placeholder="1"
                class="ingredient-input ingredient-input--amount"
                aria-label="Amount"
              />
              <input
                v-model="item.ing.unit"
                type="text"
                placeholder="g"
                class="ingredient-input ingredient-input--unit"
                aria-label="Unit"
              />
              <input
                v-model="item.ing.name"
                type="text"
                placeholder="Ingredient name"
                class="ingredient-input ingredient-input--name"
                aria-label="Ingredient name"
              />
              <button
                type="button"
                class="btn-icon btn-icon--remove"
                title="Remove ingredient"
                @click="removeIngredient(item.flatIndex)"
              >
                <svg viewBox="0 0 24 24" fill="none">
                  <path d="M18 6L6 18M6 6L18 18" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
              </button>
            </div>

            <div class="ingredient-card__secondary">
              <div class="ingredient-card__field">
                <label class="ingredient-card__field-label" :for="`ing-cat-${item.flatIndex}`">Category</label>
                <select
                  :id="`ing-cat-${item.flatIndex}`"
                  :value="item.ing.category ?? ''"
                  class="ingredient-card__select"
                  aria-label="Ingredient category"
                  @change="setIngredientCategorySelect(item.ing, ($event.target as HTMLSelectElement).value)"
                >
                  <option value="">— None —</option>
                  <option
                    v-for="opt in INGREDIENT_CATEGORY_OPTIONS"
                    :key="opt.value"
                    :value="opt.value"
                  >
                    {{ opt.labelDe }} ({{ opt.value }})
                  </option>
                </select>
              </div>
              <div class="ingredient-card__field ingredient-card__field--grow">
                <label class="ingredient-card__field-label" :for="`ing-add-${item.flatIndex}`">Additional info</label>
                <input
                  :id="`ing-add-${item.flatIndex}`"
                  v-model="item.ing.additional_info"
                  type="text"
                  class="ingredient-card__text-input"
                  placeholder="Notes, alternatives…"
                  aria-label="Additional ingredient info"
                />
              </div>
            </div>

            <div v-if="!hideIngredientOriginalLine" class="ingredient-card__original-wrap">
              <template v-if="item.ing.original_text == null">
                <button
                  type="button"
                  class="ingredient-card__link-btn"
                  @click="item.ing.original_text = ''"
                >
                  + Add original line (from OCR)
                </button>
              </template>
              <template v-else-if="item.ing.original_text === ''">
                <div class="ingredient-card__original-editor">
                  <span class="ingredient-card__field-label">Original line</span>
                  <input
                    v-model="item.ing.original_text"
                    type="text"
                    class="ingredient-card__text-input ingredient-card__text-input--original"
                    placeholder="Paste visible line from the source"
                    aria-label="Original ingredient line"
                  />
                  <button
                    type="button"
                    class="btn btn--secondary btn--tiny"
                    @click="item.ing.original_text = null"
                  >
                    Cancel
                  </button>
                </div>
              </template>
              <template v-else>
                <div
                  v-if="!isOriginalLineExpanded(item.flatIndex)"
                  class="ingredient-card__original-collapsed"
                >
                  <button
                    type="button"
                    class="ingredient-card__link-btn"
                    @click="toggleOriginalLineExpanded(item.flatIndex)"
                  >
                    Show / edit original line
                  </button>
                  <span class="ingredient-card__original-preview" :title="item.ing.original_text ?? ''">{{
                    truncateText(item.ing.original_text ?? '', 72)
                  }}</span>
                </div>
                <div v-else class="ingredient-card__original-editor">
                  <span class="ingredient-card__field-label">Original line</span>
                  <div class="ingredient-card__original-row">
                    <input
                      v-model="item.ing.original_text"
                      type="text"
                      class="ingredient-card__text-input ingredient-card__text-input--original"
                      placeholder="Original ingredient text from OCR"
                      aria-label="Original ingredient line"
                    />
                    <button
                      type="button"
                      class="btn-icon-small"
                      title="Remove original text"
                      @click="item.ing.original_text = null; collapseOriginalLine(item.flatIndex)"
                    >
                      <svg viewBox="0 0 24 24" fill="none">
                        <path d="M18 6L6 18M6 6L18 18" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                      </svg>
                    </button>
                  </div>
                  <button
                    type="button"
                    class="btn btn--secondary btn--tiny"
                    @click="collapseOriginalLine(item.flatIndex)"
                  >
                    Done
                  </button>
                </div>
              </template>
            </div>

            <div class="ingredient-card__edit-footer">
              <button type="button" class="btn btn--secondary btn--small" @click="closeIngredientEdit(item.flatIndex)">
                Done
              </button>
            </div>
            </template>
          </div>
        </div>

        <button type="button" class="btn btn--secondary btn--block" @click="addIngredient">
          + Add Ingredient
        </button>
      </div>

      <!-- Step 3: Instructions -->
      <div v-if="currentStep === 2" class="form-step form-step--instructions">
        <p class="instructions-step__hint">
          Steps are shown as plain text for review. Click to edit. New steps open in edit mode.
        </p>
        <div
          v-for="(step, index) in form.recipe_steps"
          :key="index"
          class="instruction-block"
          :class="{ 'instruction-block--editing': isStepEditing(index) }"
        >
          <div v-if="!isStepEditing(index)" class="instruction-block__view">
            <div class="instruction-number">{{ index + 1 }}</div>
            <div
              class="instruction-block__summary"
              role="button"
              tabindex="0"
              :aria-label="'Edit step ' + (index + 1)"
              @click="openStepEdit(index)"
              @keydown.enter.prevent="openStepEdit(index)"
              @keydown.space.prevent="openStepEdit(index)"
            >
              {{
                (step.instruction || '').trim()
                  ? step.instruction
                  : 'Empty step — click to edit'
              }}
            </div>
            <button
              type="button"
              class="btn-icon btn-icon--remove"
              title="Remove step"
              @click.stop="removeStep(index)"
            >
              <svg viewBox="0 0 24 24" fill="none">
                <path d="M18 6L6 18M6 6L18 18" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
            </button>
          </div>
          <div v-else class="instruction-block__edit">
            <div class="instruction-row">
              <div class="instruction-number">{{ index + 1 }}</div>
              <textarea
                v-model="step.instruction"
                rows="3"
                :placeholder="`Step ${index + 1}`"
                class="form-textarea instruction-block__textarea"
                aria-label="Step instruction"
              />
              <button
                type="button"
                class="btn-icon btn-icon--remove"
                title="Remove step"
                @click="removeStep(index)"
              >
                <svg viewBox="0 0 24 24" fill="none">
                  <path d="M18 6L6 18M6 6L18 18" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
              </button>
            </div>
            <div class="instruction-block__edit-actions">
              <button type="button" class="btn btn--secondary btn--small" @click="closeStepEdit(index)">
                Done
              </button>
            </div>
          </div>
        </div>

        <button type="button" class="btn btn--secondary btn--block" @click="addStep">
          + Add Step
        </button>

        <div class="form-section">
          <h4 class="form-section__title">Tips & Notes</h4>
          <textarea
            v-model="form.tips_notes"
            rows="3"
            placeholder="Optional tips, notes, or alternatives (one per line)"
            class="form-textarea"
            aria-label="Tips and notes"
          />
        </div>
      </div>

      <!-- Navigation -->
      <div class="form-actions">
        <button
          v-if="currentStep > 0"
          type="button"
          class="btn btn--secondary"
          @click="prevStep"
        >
          Back
        </button>
        <div style="flex: 1"></div>
        <button
          v-if="editingId"
          type="button"
          class="btn btn--ghost"
          @click="emit('cancel')"
        >
          Cancel
        </button>
        <button
          type="submit"
          class="btn btn--primary"
        >
          {{ editingId ? 'Save Changes' : 'Create Recipe' }}
        </button>
        <button
          v-if="currentStep === 1"
          type="button"
          class="btn btn--secondary"
          @click="handleSubmit({ estimateNutrition: true })"
        >
          Estimate nutrition
        </button>
        <button
          v-if="currentStep < steps.length - 1"
          type="button"
          class="btn btn--secondary"
          @click="nextStep"
        >
          Next Step
        </button>
        <button
          v-if="editingId && editingStatus === 'draft'"
          type="button"
          class="btn btn--success"
          @click="emit('confirm')"
        >
          Confirm Recipe
        </button>
      </div>
    </form>
  </div>
</template>

<script setup lang="ts">
import { reactive, ref, computed, watch, onMounted } from 'vue'
import type {
  RecipeFormPayload,
  IngredientInput,
  RecipeStepInput,
  ParsedRecipeFromOcr,
} from '../api/recipes'
import { listSources } from '../api/sources'
import type { RecipeSource } from '../api/sources'
import { INGREDIENT_CATEGORY_OPTIONS, getIngredientCategoryLabelDe } from '../constants/ingredientCategories'

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
}

const props = defineProps<{
  initial?: (Partial<RecipeFormPayload> & {
    parsed_recipe?: ParsedRecipeFromOcr | null
    source_id?: number | null
    import_method?: string | null
    extract_confidence?: number | null
    extract_missing_fields?: string[] | null
    nutrition_kcal?: number | null
    nutrition_protein?: number | null
    nutrition_carbs?: number | null
    nutrition_fat?: number | null
    prep_time_min?: number | null
    cook_time_min?: number | null
    prep_time_source?: 'original' | 'estimated' | null
    cook_time_source?: 'original' | 'estimated' | null
    prep_time_confidence?: number | null
    cook_time_confidence?: number | null
  }) | null
  editingId?: number | null
  editingStatus?: 'draft' | 'confirmed' | null
}>()

const emit = defineEmits<{
  submit: [
    payload: RecipeFormPayload,
    imageFile: File | string | null,
    cropPoints?: Array<{ x: number; y: number }>,
    options?: { estimateNutrition?: boolean }
  ]
  confirm: []
  cancel: []
}>()

const currentStep = ref(0)
const sourceType = ref<'none' | 'book'>('none')
const selectedSourceId = ref<number | null>(null)
const bookSources = ref<RecipeSource[]>([])

// Image upload
const imageInputRef = ref<HTMLInputElement | null>(null)
const imageFile = ref<File | null>(null)
const imagePreview = ref<string | null>(null)
const currentImageUrl = ref<string | null>(null)

// 4-point crop (shared for new image and existing image)
const showCropForExisting = ref(false)
const cropImageUrl = ref('')
const cropImageRef = ref<HTMLImageElement | null>(null)
const cropEditorRef = ref<HTMLDivElement | null>(null)
const newCropImageRef = ref<HTMLImageElement | null>(null)
const newCropEditorRef = ref<HTMLDivElement | null>(null)
const cropPoints = ref<Array<{ x: number; y: number }>>([])
const cropDisplaySize = ref({ w: 0, h: 0 })
const cropping = ref(false)
const cropError = ref('')

const cropPolylinePoints = computed(() => {
  if (cropPoints.value.length !== 4) return ''
  const pts = cropPoints.value
  return `${pts[0].x},${pts[0].y} ${pts[1].x},${pts[1].y} ${pts[2].x},${pts[2].y} ${pts[3].x},${pts[3].y} ${pts[0].x},${pts[0].y}`
})

function updateCropDisplaySize(wrap: HTMLDivElement | null) {
  if (!wrap) return
  const rect = wrap.getBoundingClientRect()
  cropDisplaySize.value = { w: rect.width, h: rect.height }
}

function onCropImageLoad() {
  cropPoints.value = []
  updateCropDisplaySize(cropEditorRef.value)
}

function onNewCropImageLoad() {
  cropPoints.value = []
  updateCropDisplaySize(newCropEditorRef.value)
}

function onCropImageClick(e: MouseEvent) {
  if (cropPoints.value.length >= 4 || !cropEditorRef.value) return
  if ((e.target as HTMLElement).closest?.('.crop-editor__point')) return
  const target = e.currentTarget as HTMLDivElement
  const rect = target.getBoundingClientRect()
  const x = Math.max(0, Math.min(rect.width, e.clientX - rect.left))
  const y = Math.max(0, Math.min(rect.height, e.clientY - rect.top))
  cropPoints.value = [...cropPoints.value, { x, y }]
  cropError.value = ''
}

function onNewCropClick(e: MouseEvent) {
  if (cropPoints.value.length >= 4 || !newCropEditorRef.value) return
  if ((e.target as HTMLElement).closest?.('.crop-editor__point')) return
  const target = e.currentTarget as HTMLDivElement
  const rect = target.getBoundingClientRect()
  const x = Math.max(0, Math.min(rect.width, e.clientX - rect.left))
  const y = Math.max(0, Math.min(rect.height, e.clientY - rect.top))
  cropPoints.value = [...cropPoints.value, { x, y }]
}

function onCropPointMouseDown(e: MouseEvent, index: number) {
  const wrap = showCropForExisting.value ? cropEditorRef.value : newCropEditorRef.value
  if (!wrap) return
  const move = (ev: MouseEvent) => {
    const r = wrap!.getBoundingClientRect()
    const x = Math.max(0, Math.min(r.width, ev.clientX - r.left))
    const y = Math.max(0, Math.min(r.height, ev.clientY - r.top))
    const next = [...cropPoints.value]
    next[index] = { x, y }
    cropPoints.value = next
  }
  const up = () => {
    document.removeEventListener('mousemove', move)
    document.removeEventListener('mouseup', up)
  }
  document.addEventListener('mousemove', move)
  document.addEventListener('mouseup', up)
}

function resetCropPoints() {
  cropPoints.value = []
  cropError.value = ''
}

function startCropExisting() {
  if (!currentImageUrl.value || currentImageUrl.value === '__DELETE__') return
  cropImageUrl.value = currentImageUrl.value
  cropPoints.value = []
  cropError.value = ''
  showCropForExisting.value = true
}

function cancelCropExisting() {
  showCropForExisting.value = false
  cropPoints.value = []
  cropError.value = ''
}

async function applyCropExisting() {
  const img = cropImageRef.value
  const recipeId = props.editingId
  if (!recipeId || !currentImageUrl.value || currentImageUrl.value === '__DELETE__' || cropPoints.value.length !== 4 || !img) return
  const rect = img.getBoundingClientRect()
  const nw = img.naturalWidth
  const nh = img.naturalHeight
  if (rect.width <= 0 || rect.height <= 0 || nw <= 0 || nh <= 0) {
    cropError.value = 'Could not determine image size.'
    return
  }
  const points = cropPoints.value.map((p) => ({
    x: Math.round((p.x / rect.width) * nw),
    y: Math.round((p.y / rect.height) * nh),
  }))
  cropping.value = true
  cropError.value = ''
  try {
    const res = await fetch(`/api/recipes/${recipeId}/crop-perspective`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ points }),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error((data as { error?: string }).error || res.statusText)
    const payload = data as { url?: string }
    if (payload.url) currentImageUrl.value = payload.url
    showCropForExisting.value = false
    cropPoints.value = []
  } catch (e) {
    cropError.value = e instanceof Error ? e.message : 'Cropping failed'
  } finally {
    cropping.value = false
  }
}

/** Get crop points in image coordinates for the newly selected image (for upload). Returns undefined if not 4 points. */
function getNewImageCropPoints(): Array<{ x: number; y: number }> | undefined {
  const img = newCropImageRef.value
  if (!img || cropPoints.value.length !== 4) return undefined
  const rect = img.getBoundingClientRect()
  const nw = img.naturalWidth
  const nh = img.naturalHeight
  if (rect.width <= 0 || rect.height <= 0 || nw <= 0 || nh <= 0) return undefined
  return cropPoints.value.map((p) => ({
    x: Math.round((p.x / rect.width) * nw),
    y: Math.round((p.y / rect.height) * nh),
  }))
}

const steps = [
  { label: 'Basics', icon: 'info' },
  { label: 'Ingredients', icon: 'list' },
  { label: 'Instructions', icon: 'steps' },
]

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
  ingredients: [] as IngredientRow[],
  recipe_steps: [] as { instruction: string }[],
})

const timeSourceHint = computed(() => {
  const i = props.initial
  if (!i) return ''
  const bits: string[] = []
  if (i.prep_time_min != null && i.prep_time_min > 0 && i.prep_time_source === 'original') {
    bits.push('Prep time from import or extraction (marked original)')
  } else if (i.prep_time_min != null && i.prep_time_min > 0 && i.prep_time_source === 'estimated') {
    bits.push('Prep time from AI estimate')
  }
  if (i.cook_time_min != null && i.cook_time_min > 0 && i.cook_time_source === 'original') {
    bits.push('Cook time from import or extraction (marked original)')
  } else if (i.cook_time_min != null && i.cook_time_min > 0 && i.cook_time_source === 'estimated') {
    bits.push('Cook time from AI estimate')
  }
  return bits.length ? bits.join(' · ') : ''
})

const hasExtractionFeedback = computed(() => {
  const i = props.initial
  return (i?.extract_confidence != null && !Number.isNaN(i.extract_confidence)) || (i?.extract_missing_fields?.length ?? 0) > 0
})
const extractConfidence = computed(() => props.initial?.extract_confidence ?? null)
const extractMissingFields = computed(() => props.initial?.extract_missing_fields ?? null)

/** URL-imported recipes: hide OCR "original line" fields in the form. */
const hideIngredientOriginalLine = computed(() => (props.initial?.import_method ?? 'manual') === 'url')

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
  if (parts.length === 0 && !hasMeta) return 'Empty ingredient — click to edit'
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

const ingredientsBySection = computed(() => {
  const groups = new Map<string, { heading: string; items: { ing: IngredientRow; flatIndex: number }[] }>()
  const defaultKey = '\0'
  form.ingredients.forEach((ing, flatIndex) => {
    const h = ing.section_heading?.trim() ?? ''
    const key = h || defaultKey
    if (!groups.has(key)) groups.set(key, { heading: h, items: [] })
    groups.get(key)!.items.push({ ing, flatIndex })
  })
  return Array.from(groups.entries()).map(([k, v]) => ({ key: k, heading: v.heading, items: v.items }))
})

function updateSectionHeading(key: string, value: string) {
  const defaultKey = '\0'
  const normalizedKey = key === defaultKey ? '' : (key ?? '')
  const heading = value.trim() || null
  form.ingredients.forEach((ing) => {
    const currentKey = (ing.section_heading?.trim() ?? '')
    if ((currentKey || '') === normalizedKey) {
      ing.section_heading = heading
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

function isOriginalLineExpanded(flatIndex: number): boolean {
  return expandedOriginalLineIndices.value.has(flatIndex)
}

function toggleOriginalLineExpanded(flatIndex: number) {
  const next = new Set(expandedOriginalLineIndices.value)
  if (next.has(flatIndex)) next.delete(flatIndex)
  else next.add(flatIndex)
  expandedOriginalLineIndices.value = next
}

function collapseOriginalLine(flatIndex: number) {
  const next = new Set(expandedOriginalLineIndices.value)
  next.delete(flatIndex)
  expandedOriginalLineIndices.value = next
}

function addIngredient() {
  const last = form.ingredients[form.ingredients.length - 1]
  form.ingredients.push({
    amount: '',
    unit: '',
    name: '',
    category: last?.category ?? null,
    additional_info: '',
    section_heading: last?.section_heading ?? '',
    section_id: last?.section_id ?? null,
  })
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
    form.source_page = props.initial.source_page ?? ''
    // Set current image URL if exists
    currentImageUrl.value = (props.initial as any).image_path ?? null
    imagePreview.value = null
    imageFile.value = null
    form.ingredients = (props.initial.ingredients ?? []).map((ing) => ({
      amount: ing.amount != null ? String(ing.amount) : '',
      unit: ing.unit ?? '',
      name: ing.name ?? '',
      category: (ing as IngredientRow).category ?? null,
      section_id: (ing as IngredientRow & { section_id?: number }).section_id ?? null,
      section_heading: (ing as IngredientRow).section_heading ?? null,
      original_text: ing.original_text ?? (ing as any).originalText ?? null,
      additional_info:
        (ing.additional_info ?? (ing as { additionalInfo?: string | null }).additionalInfo ?? '') ?? '',
    }))
    if (form.ingredients.length === 0) {
      form.ingredients = [{ amount: '', unit: '', name: '', category: null, additional_info: '', section_heading: '', section_id: null }]
    }
    form.recipe_steps = (props.initial.recipe_steps ?? []).map((s) => ({
      instruction: s.instruction ?? '',
    }))
    if (form.recipe_steps.length === 0) form.recipe_steps = [{ instruction: '' }]
    if (props.initial.source_id != null) {
      sourceType.value = 'book'
      selectedSourceId.value = props.initial.source_id
    } else {
      sourceType.value = 'none'
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
    form.source_page = ''
    form.ingredients = [{ amount: '', unit: '', name: '', category: null, additional_info: '', section_heading: '', section_id: null }]
    form.recipe_steps = [{ instruction: '' }]
    sourceType.value = 'none'
    selectedSourceId.value = null
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
  input.value = ''
}

function removeImage() {
  if (imagePreview.value) {
    URL.revokeObjectURL(imagePreview.value)
  }
  imagePreview.value = null
  imageFile.value = null
  // Set a marker that we want to delete the image
  if (currentImageUrl.value) {
    currentImageUrl.value = '__DELETE__'
  }
}

watch(
  () => [props.initial, props.editingId],
  () => {
    assignFromInitial()
    currentStep.value = 0
  },
  { immediate: true }
)

onMounted(async () => {
  try {
    const all = await listSources()
    bookSources.value = all.filter((s) => s.type === 'book')
  } catch {
    bookSources.value = []
  }
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

function handleSubmit(options?: { estimateNutrition?: boolean }) {
  const ingredients: IngredientInput[] = form.ingredients
    .filter((ing) => ing.name.trim() !== '')
    .map((ing, i) => ({
      amount: ing.amount.trim() || null,
      unit: ing.unit.trim() || null,
      name: ing.name.trim(),
      position: i,
      section_id: ing.section_id != null ? ing.section_id : null,
      original_text: ing.original_text ?? null,
      category: ing.category?.trim() || null,
      additional_info: ing.additional_info?.trim() || null,
      section_heading: ing.section_heading?.trim() || null,
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
    source_id: sourceType.value === 'book' && selectedSourceId.value != null ? selectedSourceId.value : null,
    source_page: sourceType.value === 'book' ? (form.source_page.trim() || null) : null,
    prep_time_min: prepMeta.min,
    cook_time_min: cookMeta.min,
    prep_time_source: prepMeta.source,
    cook_time_source: cookMeta.source,
    prep_time_confidence: prepMeta.confidence,
    cook_time_confidence: cookMeta.confidence,
    ingredients,
    recipe_steps,
    ...(tips != null ? { tips } : {}),
  }

  // Pass image file or delete marker, and optional 4-point crop (for new image upload)
  const imageToUpload = imageFile.value || (currentImageUrl.value === '__DELETE__' ? ('DELETE' as any) : null)
  const cropPointsForUpload = imageToUpload instanceof File ? getNewImageCropPoints() : undefined
  emit('submit', payload, imageToUpload, cropPointsForUpload, options)
}
</script>

<style scoped>
.recipe-form-multi {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xl);
}

/* Progress Steps */
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

/* Sections */
.form-section {
  padding-top: var(--spacing-lg);
  border-top: 1px solid var(--color-border);
}

.form-section--image {
  padding-top: 0;
  border-top: none;
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

.image-upload__preview img {
  width: 100%;
  height: 100%;
  object-fit: cover;
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

.image-upload__actions {
  display: flex;
  gap: var(--spacing-sm);
  flex-wrap: wrap;
  align-items: center;
}

/* 4-point crop editor */
.crop-editor {
  margin-top: var(--spacing-md);
}
.crop-editor--new {
  padding: var(--spacing-md);
  background: var(--color-bg-muted);
  border-radius: var(--radius-md);
  border: 1px solid var(--color-border);
}
.crop-editor__hint {
  margin: 0 0 var(--spacing-sm) 0;
  font-size: 0.875rem;
  color: var(--color-text-muted);
}
.crop-editor__wrap {
  position: relative;
  display: inline-block;
  max-width: 100%;
  cursor: crosshair;
}
.crop-editor__img {
  display: block;
  max-width: 100%;
  max-height: 320px;
  vertical-align: top;
}
.crop-editor__overlay {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
}
.crop-editor__lines {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
}
.crop-editor__point {
  position: absolute;
  width: 24px;
  height: 24px;
  margin-left: -12px;
  margin-top: -12px;
  border-radius: 50%;
  background: var(--color-primary);
  color: #fff;
  font-size: 12px;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  pointer-events: auto;
  cursor: grab;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
}
.crop-editor__point:active {
  cursor: grabbing;
}
.crop-editor__actions {
  margin-top: 0.5rem;
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
}
.crop-editor__error {
  margin: 0.5rem 0 0 0;
  font-size: 0.875rem;
  color: var(--color-error, #c00);
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

.ingredients-step__hint {
  margin: 0;
  font-size: 0.8rem;
  color: var(--color-text-muted);
  line-height: 1.45;
}

.ingredients-step__hint code {
  font-size: 0.75em;
  padding: 0.1em 0.25em;
  border-radius: 3px;
  background: var(--color-bg-muted);
}

.ingredient-section {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
}

.ingredient-section__heading-block {
  padding: var(--spacing-sm) var(--spacing-md);
  border-radius: var(--radius-md);
  background: var(--color-bg-muted);
  border: 1px solid var(--color-border);
}

.ingredient-section__heading-block-label {
  display: block;
  font-size: 0.7rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--color-text-muted);
  margin-bottom: var(--spacing-xs);
}

.ingredient-section__heading-input {
  width: 100%;
  box-sizing: border-box;
  padding: var(--spacing-xs) var(--spacing-sm);
  border: 1px solid var(--color-input-border);
  border-radius: var(--radius-sm);
  font: inherit;
  font-size: 0.9rem;
  background: var(--color-input-bg);
  color: var(--color-text);
}

.ingredient-section__heading-preview {
  margin: 0;
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--color-text-muted);
}

.ingredient-card {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
  padding: var(--spacing-md);
  border-radius: var(--radius-lg);
  border: 1px solid var(--color-border);
  background: var(--color-bg-elevated, var(--color-bg));
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04);
}

.ingredient-card--editing {
  border-color: var(--color-primary);
  box-shadow: 0 0 0 1px rgba(255, 107, 53, 0.12);
}

.ingredient-card__view {
  display: flex;
  align-items: flex-start;
  gap: var(--spacing-sm);
  min-width: 0;
}

.ingredient-card__summary {
  flex: 1;
  min-width: 0;
  text-align: left;
  padding: var(--spacing-sm) var(--spacing-md);
  border-radius: var(--radius-md);
  border: 1px solid transparent;
  background: var(--color-bg-muted);
  cursor: pointer;
  transition: background 0.15s ease, border-color 0.15s ease;
}

.ingredient-card__summary:hover {
  background: var(--color-bg);
  border-color: var(--color-border);
}

.ingredient-card__summary:focus {
  outline: 2px solid var(--color-primary);
  outline-offset: 2px;
}

.ingredient-card__summary-main {
  font-size: 0.95rem;
  font-weight: 500;
  color: var(--color-text);
  line-height: 1.45;
  word-break: break-word;
}

.ingredient-card__summary-sub {
  margin-top: 0.25rem;
  font-size: 0.8rem;
  color: var(--color-text-muted);
  line-height: 1.4;
}

.ingredient-card__summary-original {
  margin-top: 0.5rem;
  font-size: 0.8rem;
  color: var(--color-text-muted);
  font-style: italic;
  line-height: 1.4;
}

.ingredient-card__summary-original-label {
  font-weight: 600;
  font-style: normal;
  margin-right: 0.35rem;
}

.ingredient-card__edit-footer {
  padding-top: var(--spacing-xs);
  margin-top: var(--spacing-xs);
  border-top: 1px dashed var(--color-border);
}

.ingredient-card__primary {
  display: grid;
  grid-template-columns: 72px 88px minmax(0, 1fr) 40px;
  gap: var(--spacing-sm);
  align-items: center;
}

.ingredient-card__secondary {
  display: grid;
  grid-template-columns: minmax(0, 13rem) minmax(0, 1fr);
  gap: var(--spacing-md);
  align-items: end;
  padding-top: var(--spacing-xs);
  border-top: 1px dashed var(--color-border);
}

.ingredient-card__field {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  min-width: 0;
}

.ingredient-card__field--grow {
  flex: 1;
}

.ingredient-card__field-label {
  font-size: 0.7rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.03em;
  color: var(--color-text-muted);
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

.ingredient-card__original-wrap {
  padding-top: var(--spacing-xs);
  border-top: 1px dashed var(--color-border);
}

.ingredient-card__original-collapsed {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--spacing-sm);
  font-size: 0.85rem;
}

.ingredient-card__original-preview {
  flex: 1;
  min-width: 0;
  color: var(--color-text-muted);
  font-style: italic;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ingredient-card__original-editor {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xs);
}

.ingredient-card__original-row {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
}

.ingredient-card__original-row .ingredient-card__text-input {
  flex: 1;
  min-width: 0;
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

/* Instructions: view vs edit */
.form-step--instructions {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
}

.instructions-step__hint {
  margin: 0;
  font-size: 0.8rem;
  color: var(--color-text-muted);
  line-height: 1.45;
}

.instruction-block {
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-bg-elevated, var(--color-bg));
}

.instruction-block--editing {
  border-color: var(--color-primary);
  box-shadow: 0 0 0 1px rgba(255, 107, 53, 0.1);
}

.instruction-block__view {
  display: flex;
  align-items: flex-start;
  gap: var(--spacing-sm);
  padding: var(--spacing-sm) var(--spacing-md);
}

.instruction-block__summary {
  flex: 1;
  min-width: 0;
  font-size: 0.95rem;
  line-height: 1.5;
  color: var(--color-text);
  padding: var(--spacing-xs) 0;
  cursor: pointer;
  text-align: left;
  word-break: break-word;
  white-space: pre-wrap;
}

.instruction-block__summary:hover {
  color: var(--color-primary);
}

.instruction-block__summary:focus {
  outline: 2px solid var(--color-primary);
  outline-offset: 2px;
}

.instruction-block__edit {
  padding: var(--spacing-md);
}

.instruction-block__edit-actions {
  margin-top: var(--spacing-sm);
}

.instruction-block__textarea {
  min-height: 5rem;
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

/* Instructions */
.instruction-row {
  display: grid;
  grid-template-columns: 40px 1fr 40px;
  gap: var(--spacing-sm);
  align-items: flex-start;
}

.instruction-number {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-full);
  background: var(--color-primary);
  color: white;
  font-weight: 600;
  font-size: 0.875rem;
  flex-shrink: 0;
  margin-top: var(--spacing-sm);
}

/* Buttons */
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
}

.btn--primary:hover {
  background: var(--color-btn-primary-hover);
  transform: translateY(-1px);
}

.btn--secondary {
  background: var(--color-btn-secondary-bg);
  color: var(--color-btn-secondary-fg);
  border: 1px solid var(--color-btn-secondary-border);
}

.btn--secondary:hover {
  background: var(--color-btn-secondary-hover);
}

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

.review-card {
  padding: var(--spacing-lg);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  background: var(--color-bg-elevated);
}

.review-card--info {
  background: rgba(0, 78, 137, 0.05);
  border-color: rgba(0, 78, 137, 0.2);
}

.review-card__header {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  margin-bottom: var(--spacing-md);
}

.review-card__header svg {
  width: 20px;
  height: 20px;
  color: var(--color-primary);
}

.review-card__header h4 {
  margin: 0;
  font-size: 1rem;
  font-weight: 600;
  color: var(--color-text);
}

.review-list {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
}

.review-list div {
  display: grid;
  grid-template-columns: 120px 1fr;
  gap: var(--spacing-md);
}

.review-list dt {
  font-weight: 600;
  color: var(--color-text-muted);
}

.review-list dd {
  margin: 0;
  color: var(--color-text);
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
  gap: var(--spacing-sm);
  padding-top: var(--spacing-lg);
  border-top: 1px solid var(--color-border);
}

@media (max-width: 768px) {
  .form-progress {
    overflow-x: auto;
  }

  .form-progress__label {
    font-size: 0.75rem;
  }

  .ingredient-card__primary {
    grid-template-columns: 56px 72px minmax(0, 1fr) 36px;
    gap: var(--spacing-xs);
  }

  .ingredient-card__secondary {
    grid-template-columns: 1fr;
  }

  .instruction-row {
    grid-template-columns: 32px 1fr 40px;
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
</style>
