<template>
  <div class="page plan-view">
    <header class="page-header plan-view__header">
      <div class="plan-view__header-text">
        <h1 class="page-header__title h2">Plan</h1>
        <p v-if="dateRangeLabel" class="page-header__subtitle">{{ dateRangeLabel }}</p>
      </div>
      <div class="plan-view__header-actions">
        <button
          type="button"
          class="btn btn--secondary btn--small"
          :disabled="suggestionsLoading || !suggestionsHasLoaded"
          @click="openWeekSuggest"
        >
          Woche vorschlagen
        </button>
        <button
          type="button"
          class="btn btn--secondary btn--small"
          :disabled="shoppingBatchActive || shoppingQueueCount === 0"
          @click="startShoppingBatch"
        >
          Zutaten einkaufen
        </button>
        <button
          type="button"
          class="btn btn--secondary btn--small"
          :disabled="suggestionsLoading"
          @click="refreshSuggestions"
        >
          {{ suggestionsLoading ? 'Lädt…' : 'Vorschläge aktualisieren' }}
        </button>
      </div>
    </header>

    <PlanWeekSummary :stats="weekStats" />

    <p v-if="suggestionsError" class="plan-view__notice plan-view__notice--error" role="alert">
      {{ suggestionsError }}
    </p>

    <p v-if="cookError" class="plan-view__notice plan-view__notice--error" role="alert">{{ cookError }}</p>

    <p v-if="hasOpenPastEntries" class="plan-view__notice" role="status">
      Es gibt noch offene Gerichte an vergangenen Tagen — mit „Gekocht“ markieren oder entfernen.
    </p>

    <p v-if="suggestionStatusNotice" class="plan-view__notice plan-view__notice--hint meta-text" role="status">
      {{ suggestionStatusNotice }}
    </p>

    <section class="plan-view__suggestions-primary surface-card">
      <PlanSuggestionsPanel
        :suggestions="flatSuggestions"
        :recipe-image-urls="recipeImageUrls"
        :loading="suggestionsLoading && !suggestionsHasLoaded"
        :ready="suggestionsHasLoaded"
        :error="suggestionsError"
        :hint="suggestionsHint"
        @assign="openAssignForSuggestion"
      />
    </section>

    <section class="plan-view__planned">
      <h2 class="plan-view__planned-title">Geplant</h2>
      <div class="surface-card plan-view__days">
        <PlanDaySection
          v-for="section in planDaySections"
          :key="section.day.date"
          :day="section.day"
          :today="today"
          :cooking-entry-id="cookingEntryId"
          :recipe-image-urls="recipeImageUrls"
          :can-move="section.isFutureOrToday && assignableDayCount > 1"
          @add="openAddSheet"
          @remove="onRemove"
          @cook="onCook"
          @assign-move="openAssignForMove"
        />
      </div>
    </section>

    <PlanAssignDaySheet
      :open="assignOpen"
      :title="assignTitle"
      :recipe-title="assignRecipeTitle"
      :days="assignDayOptions"
      @close="closeAssign"
      @select="onAssignDay"
    />

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
import PlanAssignDaySheet from '../components/PlanAssignDaySheet.vue'
import PlanDaySection from '../components/PlanDaySection.vue'
import PlanShoppingBatchFlow from '../components/PlanShoppingBatchFlow.vue'
import PlanSuggestionsPanel from '../components/PlanSuggestionsPanel.vue'
import PlanWeekSuggestSheet from '../components/PlanWeekSuggestSheet.vue'
import PlanWeekSummary from '../components/PlanWeekSummary.vue'
import { useMealPlan } from '../composables/useMealPlan'
import { usePlanShoppingBatch } from '../composables/usePlanShoppingBatch'
import { usePlanSuggestions } from '../composables/usePlanSuggestions'
import { buildAssignDayOptions } from '../utils/planAssignDays'
import { isPastIsoDate } from '../utils/mealPlanDates'
import { collectPlanEntriesForShopping } from '../utils/planShoppingBatch'
import {
  buildDedupedDaySuggestionGroups,
  computePlanWeekStats,
  flattenDedupedSuggestions,
} from '../utils/planWeekSummary'
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
  const todayStr = today.value
  return visibleDays.value.map((day) => ({
    day,
    isFutureOrToday: !isPastIsoDate(day.date, todayStr),
  }))
})

const suggestionGroups = computed(() =>
  buildDedupedDaySuggestionGroups(
    visibleDays.value.map((day) => ({
      date: day.date,
      entries: day.entries,
      suggestions: suggestionLookup.value[day.date] ?? [],
    })),
    today.value,
    4,
  ),
)

const flatSuggestions = computed(() => flattenDedupedSuggestions(suggestionGroups.value))

const assignableDayCount = computed(
  () => visibleDays.value.filter((day) => !isPastIsoDate(day.date, today.value)).length,
)

const shoppingQueueCount = computed(() =>
  collectPlanEntriesForShopping(plan.value, { today: today.value }).length,
)

const weekStats = computed(() =>
  computePlanWeekStats(visibleDays.value, today.value, shoppingQueueCount.value),
)

const suggestionStatusNotice = computed(() => {
  if (suggestionsLoading.value && !suggestionsHasLoaded.value) return null
  if (!suggestionsHasLoaded.value) return null
  if (plannableRecipeCount.value === 0) {
    const draftHint =
      draftRecipeCount.value > 0
        ? ` (${draftRecipeCount.value} Entwürfe müssen erst bestätigt werden.)`
        : ''
    return `Keine planbaren Rezepte — nur bestätigte Rezepte erscheinen in Vorschlägen.${draftHint}`
  }
  if (totalSuggestionCount.value === 0) {
    return 'Alle planbaren Rezepte sind bereits in der Woche — entferne Einträge für neue Vorschläge.'
  }
  return null
})

const suggestionsHint = computed(() => {
  if (!suggestionsHasLoaded.value || totalSuggestionCount.value === 0) return null
  return 'Tippe ein Rezept und wähle den Zieltag — jedes Rezept nur einmal pro Woche.'
})

type AssignContext =
  | { kind: 'suggestion'; suggestion: PlanSuggestionCandidate }
  | { kind: 'move'; entryId: string; sourceDate: string; recipeTitle: string }

const assignOpen = ref(false)
const assignContext = ref<AssignContext | null>(null)

const assignTitle = computed(() =>
  assignContext.value?.kind === 'move' ? 'Zu Tag verschieben' : 'Tag auswählen',
)

const assignRecipeTitle = computed(() => {
  const ctx = assignContext.value
  if (!ctx) return null
  return ctx.kind === 'move' ? ctx.recipeTitle : ctx.suggestion.recipeTitle
})

const assignDayOptions = computed(() => {
  const ctx = assignContext.value
  const excludeDate = ctx?.kind === 'move' ? ctx.sourceDate : undefined
  return buildAssignDayOptions(visibleDays.value, today.value, excludeDate)
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

function openAssignForSuggestion(suggestion: PlanSuggestionCandidate) {
  assignContext.value = { kind: 'suggestion', suggestion }
  assignOpen.value = true
}

function openAssignForMove(entryId: string, sourceDate: string, recipeTitle: string) {
  assignContext.value = { kind: 'move', entryId, sourceDate, recipeTitle }
  assignOpen.value = true
}

function closeAssign() {
  assignOpen.value = false
  assignContext.value = null
}

function onAssignDay(date: string) {
  const ctx = assignContext.value
  if (!ctx) return
  if (ctx.kind === 'suggestion') {
    onSuggestAdd(date, ctx.suggestion)
  } else {
    moveEntry(ctx.entryId, date)
  }
  closeAssign()
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
  margin-bottom: var(--spacing-md);
}

.plan-view__header-text {
  min-width: 0;
}

.plan-view__header-actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: var(--spacing-sm);
  flex-shrink: 0;
}

.plan-view__suggestions-primary {
  margin-bottom: var(--spacing-lg);
  padding: var(--spacing-md) var(--spacing-lg);
  border: 1px solid color-mix(in srgb, var(--color-accent) 28%, var(--color-border));
  background: color-mix(in srgb, var(--color-accent) 4%, var(--color-surface));
  min-width: 0;
}

.plan-view__planned {
  min-width: 0;
}

.plan-view__planned-title {
  margin: 0 0 var(--spacing-sm);
  font-size: 0.88rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--color-text-muted);
}

.plan-view__days {
  padding: var(--spacing-md) var(--spacing-lg);
  min-width: 0;
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
  margin-top: var(--spacing-md);
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

@media (min-width: 640px) {
  .plan-view__suggestions-primary {
    padding: var(--spacing-lg) var(--spacing-xl);
  }

  .plan-view__days {
    padding: var(--spacing-lg) var(--spacing-xl);
  }
}
</style>
