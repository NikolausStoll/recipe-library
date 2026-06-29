<template>
  <div class="page plan-view">
    <header class="page-header plan-view__header">
      <div>
        <h1 class="page-header__title h2">Plan</h1>
        <p v-if="dateRangeLabel" class="page-header__subtitle">{{ dateRangeLabel }}</p>
      </div>
      <button
        type="button"
        class="btn btn--secondary btn--small plan-view__refresh"
        :disabled="suggestionsLoading"
        @click="refreshSuggestions"
      >
        {{ suggestionsLoading ? 'Lädt…' : 'Vorschläge aktualisieren' }}
      </button>
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
        @add="openAddSheet"
        @remove="onRemove"
        @cook="onCook"
        @suggest-add="onSuggestAdd(section.day.date, $event)"
      />
    </div>

    <AddToPlanSheet
      :open="addSheetOpen"
      :target-date="addTargetDate"
      @close="addSheetOpen = false"
      @add="onAdd"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, ref } from 'vue'
import AddToPlanSheet from '../components/AddToPlanSheet.vue'
import PlanDaySection from '../components/PlanDaySection.vue'
import { useMealPlan } from '../composables/useMealPlan'
import { usePlanSuggestions } from '../composables/usePlanSuggestions'
import { isPastIsoDate } from '../utils/mealPlanDates'
import type { PlanSuggestionCandidate } from '../utils/planSuggestionScore'
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
const cookingEntryId = ref<string | null>(null)
const cookError = ref<string | null>(null)

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
</script>

<style scoped>
.plan-view__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--spacing-md);
  margin-bottom: var(--spacing-lg);
}

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
</style>
