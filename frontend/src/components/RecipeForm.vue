<template>
  <form class="recipe-form" @submit.prevent="onSubmit">
    <h2 class="recipe-form__heading">{{ editingId ? 'Edit recipe' : 'New recipe' }}</h2>

    <!-- Extraction feedback (when present) -->
    <section
      v-if="hasExtractionFeedback"
      class="recipe-form__section recipe-form__extraction"
    >
      <h3 class="recipe-form__section-title">Extraction</h3>
      <p v-if="extractConfidence != null" class="recipe-form__extraction-confidence">
        <strong>Confidence:</strong> {{ Math.round(extractConfidence * 100) }}%
      </p>
      <p v-if="extractMissingFields?.length" class="recipe-form__extraction-missing">
        <strong>Missing fields:</strong> {{ extractMissingFields.join(', ') }}
      </p>
    </section>

    <!-- 1. Title -->
    <section class="recipe-form__section">
      <h3 class="recipe-form__section-title">Title</h3>
      <div class="recipe-form__field">
        <label for="recipe-title">Recipe title <span class="required">*</span></label>
        <input
          id="recipe-title"
          v-model="form.title"
          type="text"
          required
          placeholder="e.g. Spaghetti Carbonara"
        />
      </div>
    </section>

    <!-- 2. Subtitle -->
    <section class="recipe-form__section">
      <h3 class="recipe-form__section-title">Subtitle</h3>
      <div class="recipe-form__field">
        <label for="recipe-subtitle">Subtitle</label>
        <input
          id="recipe-subtitle"
          v-model="form.subtitle"
          type="text"
          placeholder="Optional subtitle"
        />
      </div>
    </section>

    <!-- 3. Description -->
    <section class="recipe-form__section">
      <h3 class="recipe-form__section-title">Description</h3>
      <div class="recipe-form__field">
        <label for="recipe-description">Description</label>
        <textarea
          id="recipe-description"
          v-model="form.description"
          rows="2"
          placeholder="Short description or intro"
        />
      </div>
    </section>

    <!-- 4. Servings -->
    <section class="recipe-form__section">
      <h3 class="recipe-form__section-title">Servings</h3>
      <div class="recipe-form__row recipe-form__row--wrap">
        <div class="recipe-form__field recipe-form__field--short">
          <label for="recipe-servings">Servings</label>
          <input
            id="recipe-servings"
            v-model.number="form.servings"
            type="number"
            min="1"
            step="1"
            placeholder="4"
          />
        </div>
      </div>
    </section>

    <!-- 5. Source -->
    <section class="recipe-form__section recipe-form__section--source">
      <h3 class="recipe-form__section-title">Source</h3>
      <div class="recipe-form__field">
        <label class="recipe-form__label-radio">
          <input v-model="sourceType" type="radio" value="none" />
          None / Manual
        </label>
        <label class="recipe-form__label-radio">
          <input v-model="sourceType" type="radio" value="book" />
          Book
        </label>
      </div>
      <template v-if="sourceType === 'book'">
        <div class="recipe-form__source-books">
          <button
            v-for="s in bookSources"
            :key="s.id"
            type="button"
            class="recipe-form__source-book"
            :class="{ 'recipe-form__source-book--selected': selectedSourceId === s.id }"
            @click="selectedSourceId = s.id"
          >
            <img v-if="s.image_path" :src="s.image_path" alt="" class="recipe-form__source-book-img" />
            <span v-else class="recipe-form__source-book-no-img">?</span>
            <span class="recipe-form__source-book-title">{{ s.name }}</span>
            <span v-if="s.subtitle" class="recipe-form__source-book-subtitle">{{ s.subtitle }}</span>
          </button>
        </div>
        <div class="recipe-form__source-actions">
          <router-link to="/sources" class="btn btn--secondary">Create New Book</router-link>
        </div>
        <div v-if="selectedSourceId" class="recipe-form__row recipe-form__row--wrap">
          <div class="recipe-form__field recipe-form__field--short">
            <label for="recipe-source-page">Page (in book)</label>
            <input id="recipe-source-page" v-model="form.source_page" type="text" placeholder="e.g. 42" />
          </div>
        </div>
      </template>
    </section>

    <!-- 6. Recipe steps -->
    <section class="recipe-form__section">
      <h3 class="recipe-form__section-title">Recipe steps</h3>
      <div
        v-for="(step, index) in form.recipe_steps"
        :key="index"
        class="recipe-form__step-row"
      >
        <span class="recipe-form__step-num">{{ index + 1 }}.</span>
        <textarea
          v-model="step.instruction"
          class="recipe-form__step-input"
          rows="2"
          :placeholder="`Step ${index + 1}`"
          aria-label="Step instruction"
        />
        <button
          type="button"
          class="recipe-form__remove"
          title="Remove step"
          aria-label="Remove step"
          @click="removeStep(index)"
        >
          ×
        </button>
      </div>
      <button type="button" class="btn btn--secondary recipe-form__add-btn" @click="addStep">
        + Add step
      </button>
    </section>

    <!-- 7. Ingredients (by section) -->
    <section class="recipe-form__section">
      <h3 class="recipe-form__section-title">Ingredients</h3>
      <template v-for="(group, sectionKey) in ingredientsBySection" :key="group.key">
        <p v-if="group.heading" class="recipe-form__ingredient-section-heading">{{ group.heading }}</p>
        <div
          v-for="(item, index) in group.items"
          :key="`${group.key}-${item.flatIndex}`"
          class="recipe-form__ingredient-block"
        >
          <div class="recipe-form__ingredient-row">
            <input
              v-model="item.ing.amount"
              type="text"
              class="recipe-form__ingredient-amount"
              placeholder="Amount"
              aria-label="Ingredient amount"
            />
            <input
              v-model="item.ing.unit"
              type="text"
              class="recipe-form__ingredient-unit"
              placeholder="Unit"
              aria-label="Ingredient unit"
            />
            <input
              v-model="item.ing.name"
              type="text"
              class="recipe-form__ingredient-name"
              placeholder="Ingredient name"
              aria-label="Ingredient name"
            />
            <button
              type="button"
              class="recipe-form__remove"
              title="Remove row"
              aria-label="Remove ingredient"
              @click="removeIngredient(item.flatIndex)"
            >
              ×
            </button>
          </div>
          <p v-if="item.ing.original_text" class="recipe-form__ingredient-original">{{ item.ing.original_text }}</p>
        </div>
      </template>
      <button type="button" class="btn btn--secondary recipe-form__add-btn" @click="addIngredient">
        + Add ingredient
      </button>
    </section>

    <!-- 8. Tips, Notes and Alternatives -->
    <section class="recipe-form__section">
      <h3 class="recipe-form__section-title">Tips, Notes and Alternatives</h3>
      <div class="recipe-form__field">
        <textarea
          id="recipe-tips-notes"
          v-model="form.tips_notes"
          rows="3"
          placeholder="Optional tips, notes or alternatives (one per line)"
          aria-label="Tips, Notes and Alternatives"
        />
      </div>
    </section>

    <!-- 9. Nutrition (read-only) -->
    <section v-if="hasNutrition" class="recipe-form__section recipe-form__nutrition">
      <h3 class="recipe-form__section-title">Nutrition information</h3>
      <p class="recipe-form__nutrition-text">{{ nutritionText }}</p>
    </section>

    <div class="recipe-form__actions">
      <button type="submit" class="btn btn--primary">
        {{ editingId ? 'Save' : 'Add recipe' }}
      </button>
      <button
        v-if="editingId && editingStatus === 'draft'"
        type="button"
        class="btn btn--confirm"
        @click="onConfirm"
      >
        Confirm recipe
      </button>
      <button v-if="editingId" type="button" class="btn btn--secondary" @click="onCancel">
        Cancel
      </button>
    </div>
  </form>
</template>

<script setup lang="ts">
import { reactive, ref, computed, watch, onMounted } from 'vue'
import type {
  RecipeFormPayload,
  IngredientInput,
  RecipeStepInput,
  ParsedRecipeFromOcr,
  ParsedIngredientItem,
  ParsedRecipeStep,
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
  submit: [payload: RecipeFormPayload]
  confirm: []
  cancel: []
}>()

const sourceType = ref<'none' | 'book'>('none')
const selectedSourceId = ref<number | null>(null)
const bookSources = ref<RecipeSource[]>([])

const form = reactive({
  title: '',
  subtitle: '',
  description: '',
  tips_notes: '',
  servings: null as number | null,
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

const hasNutrition = computed(() => {
  const i = props.initial
  const kcal = i?.nutrition_kcal ?? i?.parsed_recipe?.nutritionTotal?.kcal
  const protein = i?.nutrition_protein ?? i?.parsed_recipe?.nutritionTotal?.protein
  const carbs = i?.nutrition_carbs ?? i?.parsed_recipe?.nutritionTotal?.carbs
  const fat = i?.nutrition_fat ?? i?.parsed_recipe?.nutritionTotal?.fat
  return kcal != null || protein != null || carbs != null || fat != null
})
const nutritionText = computed(() => {
  const i = props.initial
  const kcal = i?.nutrition_kcal ?? i?.parsed_recipe?.nutritionTotal?.kcal
  const protein = i?.nutrition_protein ?? i?.parsed_recipe?.nutritionTotal?.protein
  const carbs = i?.nutrition_carbs ?? i?.parsed_recipe?.nutritionTotal?.carbs
  const fat = i?.nutrition_fat ?? i?.parsed_recipe?.nutritionTotal?.fat
  const parts = []
  if (kcal != null) parts.push(`${kcal} kcal`)
  if (protein != null) parts.push(`${protein} g protein`)
  if (carbs != null) parts.push(`${carbs} g carbs`)
  if (fat != null) parts.push(`${fat} g fat`)
  return parts.length ? parts.join(' · ') : ''
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

function formatParsedItem(item: ParsedIngredientItem): string {
  if (item.originalText?.trim()) return item.originalText.trim()
  const parts = [item.amount != null ? String(item.amount) : '', item.unit ?? '', item.ingredient ?? '', item.additionalInfo ?? ''].filter(Boolean)
  return parts.join(' ').trim() || '—'
}

function formatParsedStep(step: ParsedRecipeStep): string {
  return step?.text?.trim() ?? '—'
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
    form.ingredients = (props.initial.ingredients ?? []).map((ing) => ({
      amount: ing.amount != null ? String(ing.amount) : '',
      unit: ing.unit ?? '',
      name: ing.name ?? '',
      section_heading: (ing as IngredientRow).section_heading ?? null,
      original_text: ing.original_text ?? ing.originalText ?? null,
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
  }
}

watch(
  () => [props.initial, props.editingId],
  () => assignFromInitial(),
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

function onSubmit() {
  const ingredients: IngredientInput[] = form.ingredients
    .filter((ing) => ing.name.trim() !== '')
    .map((ing, i) => ({
      amount: ing.amount.trim() || null,
      unit: ing.unit.trim() || null,
      name: ing.name.trim(),
      position: i,
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
  emit('submit', payload)
}

function onConfirm() {
  emit('confirm')
}

function onCancel() {
  emit('cancel')
}
</script>

<style scoped>
.recipe-form {
  background: var(--color-bg-elevated);
  border-radius: 8px;
  padding: 1.5rem;
  margin-bottom: 1.5rem;
  box-shadow: var(--shadow-card);
}

.recipe-form__heading {
  margin: 0 0 1.25rem 0;
  font-size: 1.25rem;
  color: var(--color-text);
}

.recipe-form__section {
  margin-bottom: 1.5rem;
  padding-bottom: 1.5rem;
  border-bottom: 1px solid var(--color-border-subtle);
}

.recipe-form__section:last-of-type {
  border-bottom: none;
  padding-bottom: 0;
}

.recipe-form__section-title {
  margin: 0 0 0.75rem 0;
  font-size: 1rem;
  font-weight: 600;
  color: var(--color-text);
}

.recipe-form__extraction {
  background: var(--color-bg-muted);
  padding: 1rem;
  border-radius: 8px;
  border: 1px solid var(--color-border);
}

.recipe-form__extraction-confidence,
.recipe-form__extraction-missing {
  margin: 0.25rem 0;
  font-size: 0.9rem;
  color: var(--color-text);
}

.recipe-form__ingredient-section-heading {
  margin: 0.75rem 0 0.35rem 0;
  font-size: 0.95rem;
  font-weight: 600;
  color: var(--color-text);
}

.recipe-form__ingredient-section-heading:first-child {
  margin-top: 0;
}

.recipe-form__ingredient-block {
  margin-bottom: 0.5rem;
}

.recipe-form__ingredient-original {
  margin: 0.15rem 0 0 0;
  padding-left: 0.25rem;
  font-size: 0.8rem;
  color: var(--color-text-muted);
  font-style: italic;
}

.recipe-form__nutrition {
  background: var(--color-bg-muted);
  padding: 1rem;
  border-radius: 8px;
  border: 1px solid var(--color-border);
}

.recipe-form__nutrition-text {
  margin: 0;
  font-size: 0.9rem;
  color: var(--color-text);
}

.recipe-form__parsed {
  background: var(--color-bg-muted);
  padding: 1rem;
  border-radius: 8px;
  border: 1px solid var(--color-border);
}

.recipe-form__parsed-title {
  margin: 0 0 0.5rem 0;
  font-size: 1rem;
  font-weight: 600;
  color: var(--color-text);
}

.recipe-form__parsed-intro {
  margin: 0 0 0.5rem 0;
  font-size: 0.9rem;
  color: var(--color-text);
  white-space: pre-wrap;
  word-break: break-word;
}

.recipe-form__parsed-label {
  margin: 0.5rem 0 0.25rem 0;
  font-size: 0.9rem;
  font-weight: 600;
  color: var(--color-text);
}

.recipe-form__parsed-list {
  margin: 0;
  padding-left: 1.25rem;
  list-style: none;
}

.recipe-form__parsed-section {
  margin: 0.25rem 0;
}

.recipe-form__parsed-heading {
  font-weight: 600;
  font-size: 0.9rem;
  color: var(--color-text);
}

.recipe-form__parsed-items {
  margin: 0.15rem 0 0 1rem;
  padding: 0;
  list-style: disc;
  font-size: 0.9rem;
  color: var(--color-text);
}

.recipe-form__parsed-steps {
  margin: 0.25rem 0 0 1.25rem;
  padding: 0;
  font-size: 0.9rem;
  color: var(--color-text);
}

.recipe-form__row {
  display: flex;
  gap: 1rem;
}

.recipe-form__row--wrap {
  flex-wrap: wrap;
}

.recipe-form__field {
  margin-bottom: 1rem;
  flex: 1;
  min-width: 0;
}

.recipe-form__field--short {
  max-width: 8rem;
}

.recipe-form__label-radio {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  margin-right: 1rem;
  font-weight: 500;
  color: var(--color-text);
  cursor: pointer;
}

.recipe-form__source-books {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
  margin: 0.75rem 0;
}

.recipe-form__source-book {
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 5.5rem;
  padding: 0.5rem;
  border: 2px solid var(--color-border);
  border-radius: 8px;
  background: var(--color-bg-muted);
  color: var(--color-text);
  font: inherit;
  text-align: center;
  cursor: pointer;
}

.recipe-form__source-book:hover {
  border-color: var(--color-primary, #2563eb);
}

.recipe-form__source-book--selected {
  border-color: var(--color-primary, #2563eb);
  background: var(--color-bg-elevated);
}

.recipe-form__source-book-img {
  width: 3.5rem;
  height: 4.5rem;
  object-fit: cover;
  border-radius: 4px;
  margin-bottom: 0.35rem;
}

.recipe-form__source-book-no-img {
  width: 3.5rem;
  height: 4.5rem;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--color-border);
  border-radius: 4px;
  margin-bottom: 0.35rem;
  font-size: 1.25rem;
  color: var(--color-text-muted);
}

.recipe-form__source-book-title {
  font-size: 0.75rem;
  font-weight: 600;
  line-height: 1.2;
  word-break: break-word;
}

.recipe-form__source-book-subtitle {
  font-size: 0.65rem;
  color: var(--color-text-muted);
  line-height: 1.2;
  margin-top: 0.15rem;
}

.recipe-form__source-actions {
  margin-bottom: 0.75rem;
}

.recipe-form__field label {
  display: block;
  margin-bottom: 0.35rem;
  font-weight: 500;
  color: var(--color-text);
}

.recipe-form__field .required {
  color: var(--color-required);
}

.recipe-form__field input,
.recipe-form__field textarea {
  width: 100%;
  max-width: 28rem;
  padding: 0.5rem 0.6rem;
  border: 1px solid var(--color-input-border);
  border-radius: 4px;
  font: inherit;
  background: var(--color-input-bg);
  color: var(--color-text);
}

.recipe-form__field--short input {
  max-width: none;
}

.recipe-form__field textarea {
  resize: vertical;
}

.recipe-form__ingredient-row,
.recipe-form__step-row {
  display: flex;
  align-items: flex-start;
  gap: 0.5rem;
  margin-bottom: 0.5rem;
}

.recipe-form__ingredient-amount {
  width: 5rem;
  min-width: 5rem;
  padding: 0.5rem 0.5rem;
  border: 1px solid var(--color-input-border);
  border-radius: 4px;
  font: inherit;
  background: var(--color-input-bg);
  color: var(--color-text);
}

.recipe-form__ingredient-unit {
  width: 4.5rem;
  min-width: 4.5rem;
  padding: 0.5rem 0.5rem;
  border: 1px solid var(--color-input-border);
  border-radius: 4px;
  font: inherit;
  background: var(--color-input-bg);
  color: var(--color-text);
}

.recipe-form__ingredient-name {
  flex: 1;
  min-width: 0;
  padding: 0.5rem 0.6rem;
  border: 1px solid var(--color-input-border);
  border-radius: 4px;
  font: inherit;
  background: var(--color-input-bg);
  color: var(--color-text);
}

.recipe-form__step-num {
  flex-shrink: 0;
  padding: 0.5rem 0.25rem 0 0;
  font-weight: 600;
  color: var(--color-text-muted);
}

.recipe-form__step-input {
  flex: 1;
  min-width: 0;
  padding: 0.5rem 0.6rem;
  border: 1px solid var(--color-input-border);
  border-radius: 4px;
  font: inherit;
  background: var(--color-input-bg);
  color: var(--color-text);
  resize: vertical;
}

.recipe-form__remove {
  flex-shrink: 0;
  width: 2rem;
  height: 2rem;
  padding: 0;
  border: 1px solid var(--color-border);
  border-radius: 4px;
  background: var(--color-bg-muted);
  color: var(--color-text-muted);
  font-size: 1.25rem;
  line-height: 1;
  cursor: pointer;
}

.recipe-form__remove:hover {
  color: var(--color-delete-fg);
  border-color: var(--color-delete-border);
}

.recipe-form__add-btn {
  margin-top: 0.25rem;
}

.recipe-form__actions {
  display: flex;
  gap: 0.75rem;
  margin-top: 1.25rem;
  padding-top: 1.25rem;
  border-top: 1px solid var(--color-border-subtle);
}

.btn {
  padding: 0.5rem 1rem;
  border-radius: 4px;
  font: inherit;
  cursor: pointer;
  border: 1px solid transparent;
}

.btn--primary {
  background: var(--color-btn-primary-bg);
  color: var(--color-header-fg);
  border-color: var(--color-btn-primary-bg);
}

.btn--primary:hover {
  background: var(--color-btn-primary-hover);
}

.btn--secondary {
  background: var(--color-btn-secondary-bg);
  color: var(--color-btn-secondary-fg);
  border-color: var(--color-btn-secondary-border);
}

.btn--secondary:hover {
  background: var(--color-btn-secondary-hover);
}

.btn--confirm {
  background: var(--color-btn-confirm-bg);
  color: #fff;
  border-color: var(--color-btn-confirm-bg);
}

.btn--confirm:hover {
  background: var(--color-btn-confirm-hover);
}
</style>
