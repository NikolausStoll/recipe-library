<template>
  <div class="page plan-view">
    <header class="page-header plan-view__header">
      <div>
        <h1 class="page-header__title h2">Plan</h1>
        <p v-if="dateRangeLabel" class="page-header__subtitle">{{ dateRangeLabel }}</p>
      </div>
      <div class="plan-view__header-actions">
        <button
          type="button"
          class="btn btn--secondary btn--small plan-view__week"
          :disabled="suggestionsLoading || !suggestionsHasLoaded"
          @click="openWeekSuggest"
        >
          Woche vorschlagen
        </button>
        <button
          type="button"
          class="btn btn--secondary btn--small plan-view__shop"
          :disabled="shoppingBatchActive || shoppingQueueCount === 0"
          @click="startShoppingBatch"
        >
          Zutaten einkaufen
        </button>
        <button
          type="button"
          class="btn btn--secondary btn--small plan-view__refresh"
          :disabled="suggestionsLoading"
          @click="refreshSuggestions"
        >
          {{ suggestionsLoading ? 'Lädt…' : 'Vorschläge aktualisieren' }}
        </button>
      </div>
    </header>

    <p v-if="suggestionsLoading && !suggestionsHasLoaded" class="plan-view__notice meta-text" role="status">
      Vorschläge werden geladen…
    </p>

    <p
      v-else-if="suggestionsHasLoaded && plannableRecipeCount === 0"
      class="plan-view__notice"
      role="status"
    >
      Keine planbaren Rezepte — nur <strong>bestätigte</strong> Rezepte erscheinen in Vorschlägen
      <template v-if="draftRecipeCount > 0">
        ({{ draftRecipeCount }} Entwürfe müssen erst unter Rezepte geprüft/bestätigt werden).
      </template>
    </p>

    <p
      v-else-if="suggestionsHasLoaded && plannableRecipeCount > 0 && totalSuggestionCount === 0"
      class="plan-view__notice"
      role="status"
    >
      Alle {{ plannableRecipeCount }} planbaren Rezepte sind bereits im Plan — entferne Einträge oder bestätige
      weitere Rezepte, um neue Vorschläge zu sehen.
      <template v-if="draftRecipeCount > 0">
        ({{ draftRecipeCount }} Entwürfe sind weiterhin ausgeschlossen.)
      </template>
    </p>

    <p
      v-else-if="suggestionsHasLoaded && plannableRecipeCount > 0 && totalSuggestionCount > 0"
      class="plan-view__notice plan-view__notice--hint meta-text"
      role="status"
    >
      {{ plannableRecipeCount }} planbare Rezepte — tippe auf einen Vorschlag unter einem Tag.
      <template v-if="draftRecipeCount > 0">
        {{ draftRecipeCount }} Entwürfe sind ausgeschlossen.
      </template>
    </p>

    <p v-if="suggestionsError" class="plan-view__notice plan-view__notice--error" role="alert">
      {{ suggestionsError }}
    </p>

    <p v-if="cookError" class="plan-view__notice plan-view__notice--error" role="alert">{{ cookError }}</p>

    <p v-if="hasOpenPastEntries" class="plan-view__notice" role="status">
      Es gibt noch offene Gerichte an vergangenen Tagen — mit „Gekocht“ markieren oder entfernen.
    </p>

    <div class="surface-card plan-view__card">
      <PlanDaySection
        v-for="section in planDaySections"
        :key="`${section.day.date}-${section.suggestions.length}-${suggestionsHasLoaded}`"
        :day="section.day"
        :today="today"
        :cooking-entry-id="cookingEntryId"
        :recipe-image-urls="recipeImageUrls"
        :suggestions="section.suggestions"
        :show-suggestions="section.showSuggestions"
        :suggestions-ready="suggestionsHasLoaded"
        :move-day-options="moveDayOptions(section.day.date)"
        @add="openAddSheet"
        @remove="onRemove"
        @cook="onCook"
        @move="onMove"
        @suggest-add="onSuggestAdd(section.day.date, $event)"
      />
    </div>

    <AddToPlanSheet
      :open="addSheetOpen"
      :target-date="addTargetDate"
      @close="addSheetOpen = false"
      @add="onAdd"
    />

    <PlanWeekSuggestSheet
      :open="weekSuggestOpen"
      :items="weekSuggestItems"
      :today="today"
      @close="weekSuggestOpen = false"
      @confirm="confirmWeekSuggest"
    />

    <PlanShoppingBatchFlow
      :active="shoppingBatchActive"
      :loading="shoppingBatchLoading"
      :load-error="shoppingBatchLoadError"
      :current-recipe="shoppingBatchRecipe"
      :current-item="shoppingBatchItem"
      :batch-label="shoppingBatchLabel"
      @added="onShoppingBatchAdded"
      @abort="abortShoppingBatch"
      @skip-error="skipShoppingBatchError"
    />

    <div v-if="shoppingBatchNotice" class="plan-view__shopping-notice no-print" role="status">
      <span>{{ shoppingBatchNotice }}</span>
      <router-link to="/shopping" class="plan-view__shopping-notice-link">Zur Liste</router-link>
      <button
        type="button"
        class="plan-view__shopping-notice-close"
        aria-label="Schließen"
        @click="dismissShoppingBatchNotice"
      >
        ×
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import AddToPlanSheet from '../components/AddToPlanSheet.vue'
import PlanDaySection from '../components/PlanDaySection.vue'
import PlanShoppingBatchFlow from '../components/PlanShoppingBatchFlow.vue'
import PlanWeekSuggestSheet from '../components/PlanWeekSuggestSheet.vue'
import { useMealPlan } from '../composables/useMealPlan'
import { usePlanShoppingBatch } from '../composables/usePlanShoppingBatch'
import { usePlanSuggestions } from '../composables/usePlanSuggestions'
import { formatPlanDayLabel, isPastIsoDate } from '../utils/mealPlanDates'
import { collectPlanEntriesForShopping } from '../utils/planShoppingBatch'
import { planEntryFromSuggestion, type PlanSuggestionCandidate, type WeekPlanSuggestion } from '../utils/planSuggestionScore'
import { getRecipeCardImageUrl } from '../utils/recipeDisplayImage'

const {
  plan,
  visibleDays,
  dateRangeLabel,
  hasOpenPastEntries,
  today,
  refreshPlanWindow,
  addEntry,
  removeEntry,
  moveEntry,
  markEntryCooked,
} = useMealPlan()

const {
  recipes: suggestionRecipes,
  suggestionLookup,
  totalSuggestionCount,
  plannableRecipeCount,
  draftRecipeCount,
  hasLoaded: suggestionsHasLoaded,
  refreshSuggestions,
  weekSuggestions,
  loading: suggestionsLoading,
  error: suggestionsError,
} = usePlanSuggestions(plan, today)

const planDaySections = computed(() => {
  const lookup = suggestionLookup.value
  const todayStr = today.value
  return visibleDays.value.map((day) => ({
    day,
    suggestions: lookup[day.date] ?? [],
    showSuggestions: !isPastIsoDate(day.date, todayStr),
  }))
})

const addSheetOpen = ref(false)
const addTargetDate = ref<string | null>(null)
const weekSuggestOpen = ref(false)
const weekSuggestItems = ref<WeekPlanSuggestion[]>([])
const cookingEntryId = ref<string | null>(null)
const cookError = ref<string | null>(null)
const shoppingBatchNotice = ref<string | null>(null)
let shoppingBatchNoticeTimer: ReturnType<typeof setTimeout> | null = null

const {
  active: shoppingBatchActive,
  loading: shoppingBatchLoading,
  loadError: shoppingBatchLoadError,
  currentRecipe: shoppingBatchRecipe,
  currentItem: shoppingBatchItem,
  batchLabel: shoppingBatchLabel,
  result: shoppingBatchResult,
  start: startPlanShoppingBatch,
  onAdded: onShoppingBatchAdded,
  abort: abortShoppingBatch,
  skipFailedAndContinue: skipShoppingBatchError,
  dismissResult: dismissShoppingBatchResult,
} = usePlanShoppingBatch()

const shoppingQueueCount = computed(() =>
  collectPlanEntriesForShopping(plan.value, { today: today.value }).length,
)

watch(shoppingBatchResult, (value) => {
  if (!value) return
  if (value.ingredientCount === 0) {
    shoppingBatchNotice.value =
      value.recipeCount === 1
        ? 'Keine Zutaten aus dem Plan hinzugefügt.'
        : `Keine Zutaten aus ${value.recipeCount} Rezepten hinzugefügt.`
  } else {
    shoppingBatchNotice.value =
      value.ingredientCount === 1
        ? `1 Zutat aus ${value.recipeCount} ${value.recipeCount === 1 ? 'Rezept' : 'Rezepten'} hinzugefügt.`
        : `${value.ingredientCount} Zutaten aus ${value.recipeCount} Rezepten hinzugefügt.`
  }
  if (shoppingBatchNoticeTimer) clearTimeout(shoppingBatchNoticeTimer)
  shoppingBatchNoticeTimer = setTimeout(() => {
    shoppingBatchNotice.value = null
  }, 8000)
  dismissShoppingBatchResult()
})

const recipeImageUrls = computed(() =>
  Object.fromEntries(
    suggestionRecipes.value.map((recipe) => [recipe.id, getRecipeCardImageUrl(recipe)]),
  ),
)

onMounted(async () => {
  refreshPlanWindow()
  await refreshSuggestions()
  await nextTick()
  document.getElementById(`plan-day-${today.value}`)?.scrollIntoView({ block: 'start' })
})

function openAddSheet(date: string) {
  addTargetDate.value = date
  addSheetOpen.value = true
}

function onAdd(payload: {
  recipeId: number
  recipeTitle: string
  recipeImageUrl?: string | null
  servings: number
}) {
  if (!addTargetDate.value) return
  addEntry(addTargetDate.value, payload)
}

function onSuggestAdd(date: string, suggestion: PlanSuggestionCandidate) {
  addEntry(date, {
    recipeId: suggestion.recipeId,
    recipeTitle: suggestion.recipeTitle,
    servings: suggestion.defaultServings,
    recipeImageUrl: recipeImageUrls.value[suggestion.recipeId] ?? null,
  })
}

function moveDayOptions(currentDate: string) {
  const todayStr = today.value
  return visibleDays.value
    .filter((day) => day.date !== currentDate && !isPastIsoDate(day.date, todayStr))
    .map((day) => ({
      date: day.date,
      label: formatPlanDayLabel(day.date, todayStr),
    }))
}

function onMove(entryId: string, targetDate: string) {
  moveEntry(entryId, targetDate)
}

function openWeekSuggest() {
  weekSuggestItems.value = weekSuggestions()
  weekSuggestOpen.value = true
}

function confirmWeekSuggest() {
  for (const item of weekSuggestItems.value) {
    addEntry(item.date, {
      ...planEntryFromSuggestion(item.candidate, {
        recipeImageUrl: recipeImageUrls.value[item.candidate.recipeId] ?? null,
      }),
    })
  }
  weekSuggestOpen.value = false
  weekSuggestItems.value = []
}

function onRemove(entryId: string) {
  removeEntry(entryId)
}

async function onCook(entryId: string) {
  cookError.value = null
  cookingEntryId.value = entryId
  try {
    await markEntryCooked(entryId)
  } catch {
    cookError.value = 'Koch-Eintrag konnte nicht gespeichert werden. Bitte erneut versuchen.'
  } finally {
    cookingEntryId.value = null
  }
}

async function startShoppingBatch() {
  await startPlanShoppingBatch(plan.value)
}

function dismissShoppingBatchNotice() {
  shoppingBatchNotice.value = null
  if (shoppingBatchNoticeTimer) clearTimeout(shoppingBatchNoticeTimer)
}
</script>

<style scoped>
.plan-view__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--spacing-md);
  margin-bottom: var(--spacing-lg);
}

.plan-view__header-actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: var(--spacing-sm);
  flex-shrink: 0;
}

.plan-view__shop,
.plan-view__refresh {
  flex-shrink: 0;
}

.plan-view__card {
  padding: var(--spacing-lg) var(--spacing-xl);
  max-width: 40rem;
}

.plan-view__notice {
  margin-bottom: var(--spacing-md);
  padding: var(--spacing-sm) var(--spacing-md);
  border-radius: var(--radius-md, 8px);
  background: var(--color-surface-raised);
  border: 1px solid var(--color-border);
  font-size: 0.9rem;
}

.plan-view__notice--error {
  border-color: var(--color-delete-border, #fca5a5);
  color: var(--color-danger);
}

.plan-view__notice--hint {
  background: transparent;
  border-style: dashed;
}

.plan-view__shopping-notice {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: var(--spacing-sm);
  margin-bottom: var(--spacing-md);
  padding: var(--spacing-sm) var(--spacing-md);
  border-radius: var(--radius-md, 8px);
  background: var(--color-surface-raised);
  border: 1px solid var(--color-border);
  font-size: 0.9rem;
}

.plan-view__shopping-notice-link {
  color: var(--color-accent);
  font-weight: 500;
}

.plan-view__shopping-notice-close {
  margin-left: auto;
  border: none;
  background: transparent;
  font-size: 1.25rem;
  line-height: 1;
  color: var(--color-text-muted);
  cursor: pointer;
  padding: 0 0.25rem;
}
</style>
