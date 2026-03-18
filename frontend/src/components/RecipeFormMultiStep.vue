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
        <h3 class="form-step__title">Basic Information</h3>
        <p class="form-step__description">Let's start with the essentials</p>

        <!-- Recipe Image Upload -->
        <div class="form-section form-section--image">
          <h4 class="form-section__title">Recipe Image</h4>
          <div class="image-upload">
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
      </div>

      <!-- Step 2: Ingredients -->
      <div v-if="currentStep === 1" class="form-step">
        <h3 class="form-step__title">Ingredients</h3>
        <p class="form-step__description">Add all the ingredients you'll need</p>

        <div v-for="(group, sectionKey) in ingredientsBySection" :key="group.key" class="ingredient-section">
          <div v-if="group.heading" class="ingredient-section__header">
            <strong>{{ group.heading }}</strong>
          </div>
          <div
            v-for="item in group.items"
            :key="`${group.key}-${item.flatIndex}`"
            class="ingredient-item"
          >
            <div class="ingredient-row">
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
                placeholder="cup"
                class="ingredient-input ingredient-input--unit"
                aria-label="Unit"
              />
              <input
                v-model="item.ing.name"
                type="text"
                placeholder="flour"
                class="ingredient-input ingredient-input--name"
                aria-label="Ingredient name"
              />
              <button
                type="button"
                class="btn-icon btn-icon--remove"
                title="Remove"
                @click="removeIngredient(item.flatIndex)"
              >
                <svg viewBox="0 0 24 24" fill="none">
                  <path d="M18 6L6 18M6 6L18 18" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
              </button>
            </div>
            <div v-if="item.ing.original_text !== undefined && item.ing.original_text !== null" class="ingredient-original">
              <label class="ingredient-original__label">Original:</label>
              <input
                v-model="item.ing.original_text"
                type="text"
                class="ingredient-original__input"
                placeholder="Original ingredient text from OCR"
              />
              <button
                type="button"
                class="btn-icon-small"
                title="Remove original text"
                @click="item.ing.original_text = null"
              >
                <svg viewBox="0 0 24 24" fill="none">
                  <path d="M18 6L6 18M6 6L18 18" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
              </button>
            </div>
            <button
              v-else
              type="button"
              class="ingredient-add-original"
              @click="item.ing.original_text = ''"
            >
              + Add original text
            </button>
          </div>
        </div>

        <button type="button" class="btn btn--secondary btn--block" @click="addIngredient">
          + Add Ingredient
        </button>
      </div>

      <!-- Step 3: Instructions -->
      <div v-if="currentStep === 2" class="form-step">
        <h3 class="form-step__title">Instructions</h3>
        <p class="form-step__description">Step-by-step preparation guide</p>

        <div
          v-for="(step, index) in form.recipe_steps"
          :key="index"
          class="instruction-row"
        >
          <div class="instruction-number">{{ index + 1 }}</div>
          <textarea
            v-model="step.instruction"
            rows="2"
            :placeholder="`Step ${index + 1}`"
            class="form-textarea"
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

      <!-- Step 4: Review -->
      <div v-if="currentStep === 3" class="form-step">
        <h3 class="form-step__title">Review & Save</h3>
        <p class="form-step__description">Everything looks good?</p>

        <div class="review-section">
          <div class="review-card">
            <div class="review-card__header">
              <svg viewBox="0 0 24 24" fill="none">
                <path d="M12 2L2 7L12 12L22 7L12 2Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
              <h4>Basic Info</h4>
            </div>
            <dl class="review-list">
              <div>
                <dt>Title:</dt>
                <dd>{{ form.title || '—' }}</dd>
              </div>
              <div v-if="form.subtitle">
                <dt>Subtitle:</dt>
                <dd>{{ form.subtitle }}</dd>
              </div>
              <div v-if="form.servings">
                <dt>Servings:</dt>
                <dd>{{ form.servings }}</dd>
              </div>
              <div v-if="form.prep_time || form.cook_time">
                <dt>Time:</dt>
                <dd>
                  <span v-if="form.prep_time">{{ form.prep_time }}min prep</span>
                  <span v-if="form.prep_time && form.cook_time"> + </span>
                  <span v-if="form.cook_time">{{ form.cook_time }}min cook</span>
                </dd>
              </div>
            </dl>
          </div>

          <div class="review-card">
            <div class="review-card__header">
              <svg viewBox="0 0 24 24" fill="none">
                <path d="M9 5H7C5.89543 5 5 5.89543 5 7V19C5 20.1046 5.89543 21 7 21H17C18.1046 21 19 20.1046 19 19V7C19 5.89543 18.1046 5 17 5H15" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
              <h4>Ingredients</h4>
            </div>
            <ul class="review-ingredient-list">
              <li v-for="(ing, idx) in form.ingredients.filter(i => i.name.trim())" :key="idx">
                {{ ing.amount }} {{ ing.unit }} {{ ing.name }}
              </li>
            </ul>
          </div>

          <div class="review-card">
            <div class="review-card__header">
              <svg viewBox="0 0 24 24" fill="none">
                <path d="M9 5H7C5.89543 5 5 5.89543 5 7V19C5 20.1046 5.89543 21 7 21H17C18.1046 21 19 20.1046 19 19V7C19 5.89543 18.1046 5 17 5H15" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
              <h4>Steps</h4>
            </div>
            <ol class="review-steps-list">
              <li v-for="(step, idx) in form.recipe_steps.filter(s => s.instruction.trim())" :key="idx">
                {{ step.instruction }}
              </li>
            </ol>
          </div>

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

interface IngredientRow {
  amount: string
  unit: string
  name: string
  section_heading?: string | null
  original_text?: string | null
}

const props = defineProps<{
  initial?: (Partial<RecipeFormPayload> & {
    parsed_recipe?: ParsedRecipeFromOcr | null
    source_id?: number | null
    extract_confidence?: number | null
    extract_missing_fields?: string[] | null
    nutrition_kcal?: number | null
    nutrition_protein?: number | null
    nutrition_carbs?: number | null
    nutrition_fat?: number | null
  }) | null
  editingId?: number | null
  editingStatus?: 'draft' | 'confirmed' | null
}>()

const emit = defineEmits<{
  submit: [payload: RecipeFormPayload, imageFile: File | null]
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

const steps = [
  { label: 'Basics', icon: 'info' },
  { label: 'Ingredients', icon: 'list' },
  { label: 'Instructions', icon: 'steps' },
  { label: 'Review', icon: 'check' },
]

const form = reactive({
  title: '',
  subtitle: '',
  description: '',
  tips_notes: '',
  servings: null as number | null,
  prep_time: null as number | null,
  cook_time: null as number | null,
  source_page: '',
  ingredients: [] as IngredientRow[],
  recipe_steps: [] as { instruction: string }[],
})

const hasExtractionFeedback = computed(() => {
  const i = props.initial
  return (i?.extract_confidence != null && !Number.isNaN(i.extract_confidence)) || (i?.extract_missing_fields?.length ?? 0) > 0
})
const extractConfidence = computed(() => props.initial?.extract_confidence ?? null)
const extractMissingFields = computed(() => props.initial?.extract_missing_fields ?? null)

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

function addIngredient() {
  form.ingredients.push({ amount: '', unit: '', name: '' })
}

function removeIngredient(index: number) {
  form.ingredients.splice(index, 1)
}

function addStep() {
  form.recipe_steps.push({ instruction: '' })
}

function removeStep(index: number) {
  form.recipe_steps.splice(index, 1)
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
  if (props.initial) {
    form.title = props.initial.title ?? ''
    form.subtitle = props.initial.subtitle ?? ''
    form.description = props.initial.description ?? ''
    const initialTips = (props.initial as { tips?: string[] })?.tips
    form.tips_notes = Array.isArray(initialTips) ? initialTips.join('\n') : ''
    form.servings = props.initial.servings ?? null
    form.source_page = props.initial.source_page ?? ''
    // Set current image URL if exists
    currentImageUrl.value = (props.initial as any).image_path ?? null
    imagePreview.value = null
    imageFile.value = null
    form.ingredients = (props.initial.ingredients ?? []).map((ing) => ({
      amount: ing.amount != null ? String(ing.amount) : '',
      unit: ing.unit ?? '',
      name: ing.name ?? '',
      section_heading: (ing as IngredientRow).section_heading ?? null,
      original_text: ing.original_text ?? (ing as any).originalText ?? null,
    }))
    if (form.ingredients.length === 0) form.ingredients = [{ amount: '', unit: '', name: '' }]
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
    form.source_page = ''
    form.ingredients = [{ amount: '', unit: '', name: '' }]
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

function handleSubmit() {
  const ingredients: IngredientInput[] = form.ingredients
    .filter((ing) => ing.name.trim() !== '')
    .map((ing, i) => ({
      amount: ing.amount.trim() || null,
      unit: ing.unit.trim() || null,
      name: ing.name.trim(),
      position: i,
      original_text: ing.original_text ?? null,
    }))
  const recipe_steps: RecipeStepInput[] = form.recipe_steps
    .filter((s) => s.instruction.trim() !== '')
    .map((s, i) => ({ step_number: i + 1, instruction: s.instruction.trim() }))

  const tipsTrimmed = form.tips_notes.trim()
  const tips = tipsTrimmed
    ? tipsTrimmed.split(/\n/).map((s) => s.trim()).filter(Boolean)
    : undefined
  const payload: RecipeFormPayload = {
    title: form.title.trim(),
    subtitle: form.subtitle.trim() || null,
    description: form.description.trim() || null,
    servings: form.servings && form.servings > 0 ? form.servings : null,
    source_id: sourceType.value === 'book' && selectedSourceId.value != null ? selectedSourceId.value : null,
    source_page: sourceType.value === 'book' ? (form.source_page.trim() || null) : null,
    ingredients,
    recipe_steps,
    ...(tips != null ? { tips } : {}),
  }

  // Pass image file or delete marker
  const imageToUpload = imageFile.value || (currentImageUrl.value === '__DELETE__' ? 'DELETE' as any : null)
  emit('submit', payload, imageToUpload)
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

/* Ingredients */
.ingredient-section {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
}

.ingredient-section__header {
  font-size: 0.95rem;
  font-weight: 600;
  color: var(--color-text);
  margin-top: var(--spacing-sm);
}

.ingredient-item {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xs);
}

.ingredient-row {
  display: grid;
  grid-template-columns: 80px 100px 1fr 40px;
  gap: var(--spacing-sm);
  align-items: center;
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

.ingredient-original {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  padding-left: calc(80px + 100px + var(--spacing-sm) * 2);
  margin-top: calc(var(--spacing-xs) * -1);
}

.ingredient-original__label {
  font-size: 0.8rem;
  color: var(--color-text-muted);
  white-space: nowrap;
  font-style: italic;
}

.ingredient-original__input {
  flex: 1;
  padding: var(--spacing-xs) var(--spacing-sm);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  font: inherit;
  font-size: 0.85rem;
  background: var(--color-bg-muted);
  color: var(--color-text-muted);
  font-style: italic;
  transition: all var(--transition-fast);
}

.ingredient-original__input:focus {
  outline: none;
  border-color: var(--color-border-focus);
  background: var(--color-input-bg);
  color: var(--color-text);
}

.ingredient-add-original {
  padding: var(--spacing-xs) var(--spacing-sm);
  margin-left: calc(80px + 100px + var(--spacing-sm) * 2);
  border: 1px dashed var(--color-border);
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--color-text-muted);
  font-size: 0.8rem;
  cursor: pointer;
  transition: all var(--transition-fast);
  align-self: flex-start;
}

.ingredient-add-original:hover {
  border-color: var(--color-primary);
  color: var(--color-primary);
  background: rgba(255, 107, 53, 0.05);
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

  .ingredient-row {
    grid-template-columns: 60px 80px 1fr 40px;
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
</style>
