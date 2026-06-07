<template>
  <div class="recipe-edit-page">
    <header class="recipe-edit-page__header">
      <div class="recipe-detail-nav recipe-edit-page__nav">
        <button
          type="button"
          class="recipe-detail-nav__btn recipe-detail-nav__btn--back"
          :aria-label="isNewRecipe ? 'Zurück' : 'Zurück zum Rezept'"
          @click="goBackToRecipe"
        >
          <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M15 18L9 12L15 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
          <span class="recipe-detail-nav__back-label">{{ isNewRecipe ? 'Zurück' : 'Zurück zum Rezept' }}</span>
        </button>
        <div class="recipe-edit-page__title-row">
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
        <div v-if="editingId != null" class="recipe-detail-nav__menu-wrap">
          <button
            type="button"
            class="recipe-detail-nav__btn"
            aria-label="Mehr Aktionen"
            aria-haspopup="true"
            :aria-expanded="editMenuOpen"
            @click.stop="editMenuOpen = !editMenuOpen"
          >
            <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <circle cx="12" cy="6" r="1.5" fill="currentColor"/>
              <circle cx="12" cy="12" r="1.5" fill="currentColor"/>
              <circle cx="12" cy="18" r="1.5" fill="currentColor"/>
            </svg>
          </button>
          <div v-if="editMenuOpen" class="recipe-detail-nav__menu" @click.stop>
            <button
              v-if="showExtractionDetailsAction"
              type="button"
              class="recipe-detail-nav__menu-item"
              @click="openExtractionDetailsFromMenu"
            >
              Extraktionsdetails anzeigen
            </button>
            <button
              type="button"
              class="recipe-detail-nav__menu-item recipe-detail-nav__menu-danger"
              @click="onDeleteFromMenu"
            >
              Rezept löschen
            </button>
          </div>
        </div>
      </div>
    </header>

    <div
      v-if="extractionDetailsOpen"
      class="extraction-details-overlay"
      role="presentation"
      @click.self="closeExtractionDetails"
    >
      <div
        class="extraction-details-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="extraction-details-title"
      >
        <h2 id="extraction-details-title" class="extraction-details-dialog__title">Extraktionsdetails</h2>
        <dl v-if="extractionDetailRows.length" class="extraction-details-dialog__list">
          <div v-for="(row, i) in extractionDetailRows" :key="i" class="extraction-details-dialog__row">
            <dt>{{ row.label }}</dt>
            <dd>{{ row.value }}</dd>
          </div>
        </dl>
        <p v-else class="extraction-details-dialog__empty meta-text">Keine Extraktionsmetadaten vorhanden.</p>
        <div class="extraction-details-dialog__actions">
          <button type="button" class="btn btn--secondary" @click="closeExtractionDetails">Schließen</button>
        </div>
      </div>
    </div>

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
        :estimate-hints="estimateHints"
        :tag-generate-loading="tagGenerateLoading"
        @submit="onFormSubmit"
        @confirm="onConfirmRecipe"
        @estimate-times="onFormEstimateTimes"
        @estimate-nutrition="onFormEstimateNutrition"
        @generate-tags="onFormGenerateTags"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
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
  buildExtractionDetailRows,
  hasRecipeExtractionDetails,
} from '../utils/recipeExtractionDetails'
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
const estimateHints = ref<{ nutrition: string; times: string }>({
  nutrition: '',
  times: '',
})

const pageTitle = computed(() => (isNewRecipe.value ? 'Neues Rezept' : 'Rezept bearbeiten'))
const editMenuOpen = ref(false)
const extractionDetailsOpen = ref(false)

const showExtractionDetailsAction = computed(() =>
  hasRecipeExtractionDetails(formInitial.value)
)

const extractionDetailRows = computed(() => {
  if (!formInitial.value) return []
  return buildExtractionDetailRows(formInitial.value)
})

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

async function runHealthEstimate(recipeId: number) {
  if (healthEstimateLoading.value) return
  healthEstimateLoading.value = true
  try {
    await postRecipeHealthScore(recipeId)
    await loadRecipe(recipeId, { silent: true })
  } catch {
    // Silent on edit page; health score is shown and can be retried on the recipe detail view.
  } finally {
    healthEstimateLoading.value = false
  }
}

async function runPostReviewAutoEstimates(recipeId: number) {
  estimateHints.value = { nutrition: '', times: '' }
  const base = formInitial.value
  if (recipeNeedsNutritionEstimate(base)) {
    await runNutritionEstimate(recipeId, { auto: true })
  }
  if (recipeNeedsHealthScoreEstimate(base?.health_score)) {
    await runHealthEstimate(recipeId)
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

    // Image file is uploaded only on save; pending state stays until crop-perspective finalizes it.
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

function onDeleteFromMenu() {
  editMenuOpen.value = false
  void onDelete()
}

function openExtractionDetailsFromMenu() {
  editMenuOpen.value = false
  extractionDetailsOpen.value = true
}

function closeExtractionDetails() {
  extractionDetailsOpen.value = false
}

function onDocumentKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape' && extractionDetailsOpen.value) {
    closeExtractionDetails()
  }
}

function onDocumentClickForEditMenu(event: MouseEvent) {
  if (!editMenuOpen.value) return
  const target = event.target as HTMLElement
  if (target.closest('.recipe-detail-nav__menu-wrap')) return
  editMenuOpen.value = false
}

onMounted(() => {
  document.addEventListener('click', onDocumentClickForEditMenu)
  document.addEventListener('keydown', onDocumentKeydown)
})

onUnmounted(() => {
  document.removeEventListener('click', onDocumentClickForEditMenu)
  document.removeEventListener('keydown', onDocumentKeydown)
})

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
  --recipe-edit-action-bar-reserve: calc(
    var(--spacing-md) * 2 + var(--spacing-lg) + 7.5rem + var(--spacing-sm) * 2
  );
}

.recipe-edit-page__header {
  margin-bottom: var(--spacing-xs);
}

.recipe-edit-page__nav.recipe-detail-nav {
  flex-wrap: wrap;
  margin-bottom: 0;
  padding-left: 0;
  padding-right: 0;
}

.recipe-edit-page__nav .recipe-detail-nav__btn--back {
  margin-right: 0;
}

.recipe-edit-page__title-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--spacing-xs) var(--spacing-sm);
  flex: 1 1 auto;
  min-width: 0;
  order: 3;
  width: 100%;
}

@media (min-width: 768px) {
  .recipe-edit-page__title-row {
    order: 0;
    width: auto;
  }

  .recipe-edit-page__title {
    font-size: 1.25rem;
  }
}

.recipe-edit-page__title {
  flex: 1 1 auto;
  min-width: 0;
  margin: 0;
  font-size: 1.05rem;
  font-weight: 700;
  line-height: 1.25;
  letter-spacing: -0.02em;
}

.recipe-edit-page__badge {
  flex-shrink: 0;
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

.recipe-edit-page__body :deep(.form-actions) {
  z-index: 5;
  margin-top: var(--spacing-lg);
  padding: var(--spacing-md) 0;
  background: linear-gradient(
    to top,
    var(--color-bg) 88%,
    color-mix(in srgb, var(--color-bg) 92%, transparent)
  );
  border-top: 1px solid var(--color-border);
}

@media (max-width: 767px) {
  .recipe-edit-page__body :deep(.form-content) {
    padding-bottom: calc(var(--recipe-edit-action-bar-reserve) + env(safe-area-inset-bottom, 0px));
  }

  .recipe-edit-page__body :deep(.form-actions) {
    position: fixed;
    left: var(--content-padding-mobile);
    right: var(--content-padding-mobile);
    bottom: 0;
    z-index: 45;
    margin-top: 0;
    padding-bottom: calc(var(--spacing-md) + env(safe-area-inset-bottom, 0px));
  }
}

@media (min-width: 768px) {
  .recipe-edit-page {
    padding-bottom: calc(var(--spacing-xl) + env(safe-area-inset-bottom, 0px));
  }

  .recipe-edit-page__body :deep(.form-content) {
    padding-bottom: var(--spacing-md);
  }
}

.extraction-details-overlay {
  position: fixed;
  inset: 0;
  z-index: var(--z-modal);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--spacing-lg);
  background: var(--color-bg-overlay);
}

.extraction-details-dialog {
  width: min(100%, 26rem);
  max-height: min(85vh, 32rem);
  overflow: auto;
  padding: var(--spacing-lg);
  border-radius: var(--radius-lg);
  border: 1px solid var(--color-border);
  background: var(--color-surface);
  box-shadow: var(--shadow-soft);
}

.extraction-details-dialog__title {
  margin: 0 0 var(--spacing-md);
  font-size: 1.125rem;
  font-weight: 650;
  color: var(--color-text);
}

.extraction-details-dialog__list {
  margin: 0 0 var(--spacing-md);
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
}

.extraction-details-dialog__row {
  display: grid;
  grid-template-columns: minmax(7rem, 38%) 1fr;
  gap: var(--spacing-sm) var(--spacing-md);
  font-size: 0.9rem;
  line-height: 1.45;
}

.extraction-details-dialog__row dt {
  margin: 0;
  font-weight: 600;
  color: var(--color-text-muted);
}

.extraction-details-dialog__row dd {
  margin: 0;
  color: var(--color-text);
  word-break: break-word;
}

.extraction-details-dialog__empty {
  margin: 0 0 var(--spacing-md);
}

.extraction-details-dialog__actions {
  display: flex;
  justify-content: flex-end;
}

@media (max-width: 767px) {
  .extraction-details-overlay {
    align-items: flex-end;
    padding: 0;
  }

  .extraction-details-dialog {
    width: 100%;
    max-width: none;
    max-height: 85vh;
    border-radius: var(--radius-lg) var(--radius-lg) 0 0;
    border-bottom: none;
  }
}
</style>
