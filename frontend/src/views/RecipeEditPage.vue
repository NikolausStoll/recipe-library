<template>
  <div class="recipe-edit-page">
    <header class="recipe-edit-page__header">
      <button type="button" class="btn btn--ghost btn--small recipe-edit-page__back" @click="goBackToRecipe">
        {{ isNewRecipe ? 'Zurück' : 'Zurück zum Rezept' }}
      </button>
      <div class="recipe-edit-page__title-block">
        <h1 class="recipe-edit-page__title">{{ pageTitle }}</h1>
        <span
          v-if="editingStatus === 'draft'"
          class="status-chip-review recipe-edit-page__badge"
        >Prüfen</span>
        <span
          v-else-if="editingStatus === 'confirmed' && editingId != null"
          class="status-chip-reviewed recipe-edit-page__badge"
        >Geprüft</span>
      </div>
      <div class="recipe-edit-page__header-actions">
        <button
          v-if="editingStatus === 'draft' && editingId != null"
          type="button"
          class="btn btn--secondary btn--small recipe-edit-page__confirm"
          @click="onConfirmRecipe"
        >
          Als geprüft markieren
        </button>
        <details v-if="editingId != null" class="recipe-edit-page__more">
          <summary class="recipe-edit-page__more-trigger">Mehr</summary>
          <div class="recipe-edit-page__more-menu" role="menu">
            <button
              type="button"
              role="menuitem"
              class="recipe-edit-page__more-item recipe-edit-page__more-item--danger"
              @click="onDelete"
            >
              Löschen
            </button>
          </div>
        </details>
      </div>
    </header>

    <p v-if="error" class="recipe-edit-page__error" role="alert">{{ error }}</p>
    <p v-if="loading" class="recipe-edit-page__loading meta-text">Rezept wird geladen…</p>

    <div v-else class="recipe-edit-page__body">
      <RecipeFormMultiStep
        ref="formRef"
        :initial="formInitial"
        :editing-id="editingId"
        :editing-status="editingStatus"
        :time-estimate-loading="timeEstimateLoading"
        :nutrition-estimate-loading="nutritionEstimateLoading"
        :health-estimate-loading="healthEstimateLoading"
        :estimate-hints="estimateHints"
        :tag-generate-loading="tagGenerateLoading"
        @submit="onFormSubmit"
        @confirm="onConfirmRecipe"
        @estimate-times="onFormEstimateTimes"
        @estimate-nutrition="onFormEstimateNutrition"
        @estimate-health="onFormEstimateHealth"
        @generate-tags="onFormGenerateTags"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import RecipeFormMultiStep from '../components/RecipeFormMultiStep.vue'
import {
  getRecipe,
  createRecipe,
  updateRecipe,
  deleteRecipe,
  estimateRecipeNutrition,
  estimateRecipeTimes,
  postRecipeHealthScore,
  postGenerateRecipeTags,
} from '../api/recipes'
import type { Recipe, RecipeFormPayload } from '../api/recipes'
import {
  buildFormInitialFromRecipe,
  type RecipeFormInitial,
} from '../utils/recipeFormInitial'
import {
  recipeNeedsNutritionEstimate,
  recipeNeedsHealthScoreEstimate,
  recipeNeedsTimeEstimate,
} from '../utils/recipeEstimateNeeds'

const route = useRoute()
const router = useRouter()

const isNewRecipe = computed(() => route.params.id === 'new')
const editingId = ref<number | null>(null)
const formInitial = ref<RecipeFormInitial | null>(null)
const editingStatus = ref<'draft' | 'confirmed' | null>(null)
const loading = ref(!isNewRecipe.value)
const error = ref('')
const formRef = ref<InstanceType<typeof RecipeFormMultiStep> | null>(null)
const timeEstimateLoading = ref(false)
const nutritionEstimateLoading = ref(false)
const healthEstimateLoading = ref(false)
const tagGenerateLoading = ref(false)
const confirmAfterNextSave = ref(false)
const estimateHints = ref<{ nutrition: string; health: string; times: string }>({
  nutrition: '',
  health: '',
  times: '',
})

const pageTitle = computed(() => (isNewRecipe.value ? 'Neues Rezept' : 'Rezept bearbeiten'))

function parseRecipeId(): number | null {
  if (isNewRecipe.value) return null
  const id = Number(route.params.id)
  if (!Number.isFinite(id) || id <= 0) return null
  return id
}

function goBackToRecipe() {
  if (isNewRecipe.value && editingId.value == null) {
    router.push('/recipes')
    return
  }
  const from = route.query.from
  if (typeof from === 'string' && from.startsWith('/')) {
    router.push(from)
    return
  }
  const id = editingId.value
  if (id != null) {
    router.push(`/recipes/${id}`)
    return
  }
  router.push('/recipes')
}

async function loadRecipe(id: number, options?: { silent?: boolean }) {
  const showLoading = options?.silent !== true
  if (showLoading) loading.value = true
  error.value = ''
  try {
    const recipe = await getRecipe(id)
    editingId.value = id
    editingStatus.value =
      recipe.status === 'draft' || recipe.status === 'confirmed' ? recipe.status : 'draft'
    formInitial.value = buildFormInitialFromRecipe(recipe)
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Rezept konnte nicht geladen werden'
    if (showLoading) {
      formInitial.value = null
      editingId.value = null
      editingStatus.value = null
    }
  } finally {
    if (showLoading) loading.value = false
  }
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

async function runEstimateTimesFlow(recipeId: number, options?: { auto?: boolean }) {
  if (timeEstimateLoading.value) return
  timeEstimateLoading.value = true
  if (!options?.auto) error.value = ''
  try {
    let res = await estimateRecipeTimes(recipeId, {})
    mergeTimesIntoFormInitial(res.recipe)

    const lastEstimate = res.estimate
    while (res.pendingOriginalReplace?.prep || res.pendingOriginalReplace?.cook) {
      if (options?.auto) break
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
      mergeTimesIntoFormInitial(res.recipe)
    }
    estimateHints.value.times = ''
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Zeitschätzung fehlgeschlagen'
    if (options?.auto) {
      estimateHints.value.times = msg
    } else {
      error.value = msg
    }
  } finally {
    timeEstimateLoading.value = false
  }
}

async function runNutritionEstimate(recipeId: number, options?: { auto?: boolean }) {
  if (nutritionEstimateLoading.value) return
  nutritionEstimateLoading.value = true
  if (!options?.auto) error.value = ''
  try {
    await estimateRecipeNutrition(recipeId)
    await loadRecipe(recipeId, { silent: true })
    estimateHints.value.nutrition = ''
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Nährwerte konnten nicht geschätzt werden'
    if (options?.auto) {
      estimateHints.value.nutrition = msg
    } else {
      error.value = msg
    }
  } finally {
    nutritionEstimateLoading.value = false
  }
}

async function runHealthEstimate(recipeId: number, options?: { auto?: boolean }) {
  if (healthEstimateLoading.value) return
  healthEstimateLoading.value = true
  if (!options?.auto) error.value = ''
  try {
    await postRecipeHealthScore(recipeId)
    await loadRecipe(recipeId, { silent: true })
    estimateHints.value.health = ''
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Gesundheitscheck fehlgeschlagen'
    if (options?.auto) {
      estimateHints.value.health = msg
    } else {
      error.value = msg
    }
  } finally {
    healthEstimateLoading.value = false
  }
}

async function runPostReviewAutoEstimates(recipeId: number) {
  estimateHints.value = { nutrition: '', health: '', times: '' }
  const base = formInitial.value
  if (recipeNeedsNutritionEstimate(base)) {
    await runNutritionEstimate(recipeId, { auto: true })
  }
  if (recipeNeedsHealthScoreEstimate(base?.health_score)) {
    await runHealthEstimate(recipeId, { auto: true })
  }
  if (recipeNeedsTimeEstimate(base)) {
    await runEstimateTimesFlow(recipeId, { auto: true })
  }
}

async function markRecipeConfirmed(recipeId: number) {
  await updateRecipe(recipeId, { status: 'confirmed' })
  editingStatus.value = 'confirmed'
}

async function finalizeConfirmAfterSave(recipeId: number) {
  try {
    await markRecipeConfirmed(recipeId)
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Rezept konnte nicht bestätigt werden'
    return
  }
  await runPostReviewAutoEstimates(recipeId)
}

async function onFormEstimateTimes() {
  const id = editingId.value
  if (id == null) return
  estimateHints.value.times = ''
  await runEstimateTimesFlow(id)
}

async function onFormEstimateNutrition() {
  const id = editingId.value
  if (id == null) return
  estimateHints.value.nutrition = ''
  await runNutritionEstimate(id)
}

async function onFormEstimateHealth() {
  const id = editingId.value
  if (id == null) return
  estimateHints.value.health = ''
  await runHealthEstimate(id)
}

async function onFormGenerateTags() {
  const id = editingId.value
  if (id == null || tagGenerateLoading.value) return
  tagGenerateLoading.value = true
  error.value = ''
  try {
    const res = await postGenerateRecipeTags(id)
    mergeTimesIntoFormInitial(res.recipe)
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Tags konnten nicht vorgeschlagen werden'
  } finally {
    tagGenerateLoading.value = false
  }
}

async function onFormSubmit(
  payload: RecipeFormPayload,
  imageFile: File | string | null,
  cropPoints?: Array<{ x: number; y: number }>,
  options?: { processImageLater?: boolean }
) {
  error.value = ''
  const shouldConfirmAfter = confirmAfterNextSave.value
  try {
    let recipeId: number
    if (editingId.value != null) {
      await updateRecipe(editingId.value, payload)
      recipeId = editingId.value
    } else {
      const newRecipe = await createRecipe(payload)
      recipeId = newRecipe.id
      editingId.value = recipeId
      await router.replace({
        name: 'recipe-edit',
        params: { id: String(recipeId) },
        query: route.query,
      })
    }

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

    await loadRecipe(recipeId, { silent: true })

    if (shouldConfirmAfter) {
      confirmAfterNextSave.value = false
      await finalizeConfirmAfterSave(recipeId)
    }
  } catch (e) {
    confirmAfterNextSave.value = false
    error.value = e instanceof Error ? e.message : 'Rezept konnte nicht gespeichert werden'
  }
}

async function onConfirmRecipe() {
  if (editingId.value == null) return
  error.value = ''
  confirmAfterNextSave.value = true
  formRef.value?.triggerSave()
}

async function onDelete() {
  if (editingId.value == null) return
  if (!confirm('Dieses Rezept löschen? Diese Aktion kann nicht rückgängig gemacht werden.')) return
  error.value = ''
  try {
    await deleteRecipe(editingId.value)
    router.push('/recipes')
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Rezept konnte nicht gelöscht werden'
  }
}

function initFromRoute() {
  if (isNewRecipe.value) {
    loading.value = false
    editingId.value = null
    formInitial.value = null
    editingStatus.value = null
    error.value = ''
    return
  }
  const id = parseRecipeId()
  if (id == null) {
    router.replace('/recipes')
    return
  }
  void loadRecipe(id)
}

watch(() => route.params.id, initFromRoute, { immediate: true })
</script>

<style scoped>
.recipe-edit-page {
  width: 100%;
  max-width: 920px;
  margin: 0 auto;
  padding-bottom: calc(var(--spacing-xl) + env(safe-area-inset-bottom, 0px));
}

.recipe-edit-page__header {
  display: grid;
  grid-template-columns: auto 1fr auto;
  align-items: center;
  gap: var(--spacing-sm) var(--spacing-md);
  margin-bottom: var(--spacing-md);
  padding-bottom: var(--spacing-md);
  border-bottom: 1px solid var(--color-border);
}

.recipe-edit-page__back {
  grid-column: 1;
  justify-self: start;
}

.recipe-edit-page__title-block {
  grid-column: 1 / -1;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--spacing-sm);
  min-width: 0;
}

@media (min-width: 640px) {
  .recipe-edit-page__title-block {
    grid-column: 2;
  }
}

.recipe-edit-page__title {
  margin: 0;
  font-size: 1.25rem;
  font-weight: 700;
  line-height: 1.25;
}

.recipe-edit-page__header-actions {
  grid-column: 1 / -1;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: flex-end;
  gap: var(--spacing-sm);
}

@media (min-width: 640px) {
  .recipe-edit-page__header-actions {
    grid-column: 3;
    grid-row: 1;
  }
}

.recipe-edit-page__confirm {
  white-space: nowrap;
}

.recipe-edit-page__more {
  position: relative;
}

.recipe-edit-page__more-trigger {
  list-style: none;
  cursor: pointer;
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--color-text-muted);
  padding: var(--spacing-xs) var(--spacing-sm);
  border-radius: var(--radius-sm);
  border: 1px solid var(--color-border);
  background: var(--color-bg-elevated, var(--color-bg));
}

.recipe-edit-page__more-trigger::-webkit-details-marker {
  display: none;
}

.recipe-edit-page__more-trigger:hover {
  color: var(--color-text);
  border-color: var(--color-text-muted);
}

.recipe-edit-page__more[open] .recipe-edit-page__more-trigger {
  border-color: var(--color-primary);
}

.recipe-edit-page__more-menu {
  position: absolute;
  right: 0;
  top: calc(100% + 4px);
  z-index: var(--z-dropdown, 20);
  min-width: 10rem;
  padding: var(--spacing-xs);
  border-radius: var(--radius-md);
  border: 1px solid var(--color-border);
  background: var(--color-surface);
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.12);
}

.recipe-edit-page__more-item {
  display: block;
  width: 100%;
  text-align: left;
  padding: var(--spacing-sm) var(--spacing-md);
  border: none;
  border-radius: var(--radius-sm);
  background: transparent;
  font: inherit;
  font-size: 0.875rem;
  cursor: pointer;
  color: var(--color-text);
}

.recipe-edit-page__more-item:hover {
  background: var(--color-bg-muted);
}

.recipe-edit-page__more-item--danger {
  color: var(--color-error);
}

.recipe-edit-page__more-item--danger:hover {
  background: rgba(220, 38, 38, 0.08);
}

.recipe-edit-page__error {
  margin: 0 0 var(--spacing-md);
  color: var(--color-error);
  font-size: 0.9rem;
}

.recipe-edit-page__loading {
  margin: 0;
}

.recipe-edit-page__body {
  min-width: 0;
}

.recipe-edit-page__body :deep(.recipe-form-multi),
.recipe-edit-page__body :deep(.form-content) {
  max-width: none;
  overflow: visible;
}

.recipe-edit-page__body :deep(.form-content) {
  padding-bottom: var(--spacing-md);
}

.recipe-edit-page__body :deep(.form-actions) {
  position: sticky;
  bottom: 0;
  z-index: 5;
  margin-top: var(--spacing-lg);
  padding: var(--spacing-md) 0 calc(var(--spacing-md) + env(safe-area-inset-bottom, 0px));
  background: linear-gradient(
    to top,
    var(--color-bg) 88%,
    color-mix(in srgb, var(--color-bg) 92%, transparent)
  );
  border-top: 1px solid var(--color-border);
}
</style>
