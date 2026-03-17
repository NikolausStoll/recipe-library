<template>
  <form class="recipe-form" @submit.prevent="onSubmit">
    <h2 class="recipe-form__heading">{{ editingId ? 'Edit recipe' : 'New recipe' }}</h2>

    <!-- OCR result (when present) -->
    <section v-if="initial?.parsed_recipe" class="recipe-form__section recipe-form__parsed">
      <h3 class="recipe-form__section-title">Erkanntes Rezept</h3>
      <p v-if="initial.parsed_recipe.title" class="recipe-form__parsed-title">{{ initial.parsed_recipe.title }}</p>
      <p v-if="initial.parsed_recipe.introText" class="recipe-form__parsed-intro">{{ initial.parsed_recipe.introText }}</p>
      <template v-if="initial.parsed_recipe.ingredientsSections?.length">
        <p class="recipe-form__parsed-label">Zutaten</p>
        <ul class="recipe-form__parsed-list">
          <li
            v-for="(section, si) in initial.parsed_recipe.ingredientsSections"
            :key="si"
            class="recipe-form__parsed-section"
          >
            <span v-if="section.heading" class="recipe-form__parsed-heading">{{ section.heading }}</span>
            <ul class="recipe-form__parsed-items">
              <li v-for="(item, ii) in section.items" :key="ii">{{ item }}</li>
            </ul>
          </li>
        </ul>
      </template>
      <template v-if="initial.parsed_recipe.steps?.length">
        <p class="recipe-form__parsed-label">Schritte</p>
        <ol class="recipe-form__parsed-steps">
          <li v-for="(step, i) in initial.parsed_recipe.steps" :key="i">{{ step }}</li>
        </ol>
      </template>
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

    <!-- 2. Source -->
    <section class="recipe-form__section recipe-form__section--source">
      <h3 class="recipe-form__section-title">Source</h3>
      <div class="recipe-form__row recipe-form__row--wrap">
        <div class="recipe-form__field">
          <label for="recipe-book-title">Book title</label>
          <input
            id="recipe-book-title"
            v-model="form.book_title"
            type="text"
            placeholder="e.g. The Silver Spoon"
          />
        </div>
        <div class="recipe-form__field">
          <label for="recipe-author">Author</label>
          <input id="recipe-author" v-model="form.author" type="text" placeholder="Author" />
        </div>
        <div class="recipe-form__field recipe-form__field--short">
          <label for="recipe-source-page">Page (in book)</label>
          <input id="recipe-source-page" v-model="form.source_page" type="text" placeholder="e.g. 42" />
        </div>
      </div>
    </section>

    <!-- 3. Ingredients -->
    <section class="recipe-form__section">
      <h3 class="recipe-form__section-title">Ingredients</h3>
      <div
        v-for="(ing, index) in form.ingredients"
        :key="index"
        class="recipe-form__ingredient-row"
      >
        <input
          v-model="ing.amount"
          type="text"
          class="recipe-form__ingredient-amount"
          placeholder="Amount"
          aria-label="Ingredient amount"
        />
        <input
          v-model="ing.unit"
          type="text"
          class="recipe-form__ingredient-unit"
          placeholder="Unit"
          aria-label="Ingredient unit"
        />
        <input
          v-model="ing.name"
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
          @click="removeIngredient(index)"
        >
          ×
        </button>
      </div>
      <button type="button" class="btn btn--secondary recipe-form__add-btn" @click="addIngredient">
        + Add ingredient
      </button>
    </section>

    <!-- 4. Steps -->
    <section class="recipe-form__section">
      <h3 class="recipe-form__section-title">Steps</h3>
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

    <!-- 5. Portions & Notes -->
    <section class="recipe-form__section">
      <h3 class="recipe-form__section-title">Portions & notes</h3>
      <div class="recipe-form__row recipe-form__row--wrap">
        <div class="recipe-form__field recipe-form__field--short">
          <label for="recipe-servings">Portions</label>
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
      <div class="recipe-form__field">
        <label for="recipe-notes">Notes</label>
        <textarea
          id="recipe-notes"
          v-model="form.description"
          rows="3"
          placeholder="Optional notes or description"
        />
      </div>
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
import { reactive, watch } from 'vue'
import type { RecipeFormPayload, IngredientInput, RecipeStepInput, ParsedRecipeFromOcr } from '../api/recipes'

const props = defineProps<{
  initial?: (Partial<RecipeFormPayload> & { parsed_recipe?: ParsedRecipeFromOcr | null }) | null
  editingId?: number | null
  editingStatus?: 'draft' | 'confirmed' | null
}>()

const emit = defineEmits<{
  submit: [payload: RecipeFormPayload]
  confirm: []
  cancel: []
}>()

const form = reactive({
  title: '',
  description: '',
  servings: null as number | null,
  source_name: '',
  book_title: '',
  author: '',
  source_page: '',
  ingredients: [] as { amount: string; unit: string; name: string }[],
  recipe_steps: [] as { instruction: string }[],
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

function assignFromInitial() {
  if (props.initial) {
    form.title = props.initial.title ?? ''
    form.description = props.initial.description ?? ''
    form.servings = props.initial.servings ?? null
    form.source_name = props.initial.source_name ?? ''
    form.book_title = props.initial.book_title ?? ''
    form.author = props.initial.author ?? ''
    form.source_page = props.initial.source_page ?? ''
    form.ingredients = (props.initial.ingredients ?? []).map((ing) => ({
      amount: ing.amount ?? '',
      unit: ing.unit ?? '',
      name: ing.name ?? '',
    }))
    if (form.ingredients.length === 0) form.ingredients = [{ amount: '', unit: '', name: '' }]
    form.recipe_steps = (props.initial.recipe_steps ?? []).map((s) => ({
      instruction: s.instruction ?? '',
    }))
    if (form.recipe_steps.length === 0) form.recipe_steps = [{ instruction: '' }]
  } else {
    form.title = ''
    form.description = ''
    form.servings = null
    form.source_name = ''
    form.book_title = ''
    form.author = ''
    form.source_page = ''
    form.ingredients = [{ amount: '', unit: '', name: '' }]
    form.recipe_steps = [{ instruction: '' }]
  }
}

watch(
  () => [props.initial, props.editingId],
  () => assignFromInitial(),
  { immediate: true }
)

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

  const payload: RecipeFormPayload = {
    title: form.title.trim(),
    description: form.description.trim() || null,
    servings: form.servings && form.servings > 0 ? form.servings : null,
    source_name: form.source_name.trim() || null,
    book_title: form.book_title.trim() || null,
    author: form.author.trim() || null,
    source_page: form.source_page.trim() || null,
    ingredients,
    recipe_steps,
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
