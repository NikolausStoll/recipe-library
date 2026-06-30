<template>
  <section
    :id="`plan-day-${day.date}`"
    class="plan-day"
    :class="{
      'plan-day--today': isToday,
      'plan-day--past': isPast,
      'plan-day--weekend': isWeekend,
    }"
  >
    <header class="plan-day__header">
      <h2 class="plan-day__title">{{ dayLabel }}</h2>
      <p v-if="isPast && hasOpenEntries" class="plan-day__past-hint meta-text">Noch offen</p>
    </header>

    <p v-if="showManyHint" class="plan-day__many-hint meta-text">
      Ungewöhnlich viele Gerichte an einem Tag — passt schon, falls du z. B. Backen und Abendessen kombinierst.
    </p>

    <ul v-if="day.entries.length" class="plan-day__list">
      <li
        v-for="entry in day.entries"
        :key="entry.id"
        class="plan-day__item"
        :class="{ 'plan-day__item--cooked': entry.cookedAt }"
      >
        <PlanRecipeThumb
          :image-url="entryImageUrl(entry)"
          :alt="entry.recipeTitle"
        />

        <router-link :to="`/recipes/${entry.recipeId}`" class="plan-day__link">
          {{ entry.recipeTitle }}
          <span class="plan-day__servings meta-text">({{ entry.servings }} {{ entry.servings === 1 ? 'Portion' : 'Portionen' }})</span>
        </router-link>

        <button
          v-if="!entry.cookedAt"
          type="button"
          class="btn btn--secondary btn--small plan-day__cook"
          :disabled="cookingEntryId === entry.id"
          @click="emit('cook', entry.id)"
        >
          {{ cookingEntryId === entry.id ? '…' : 'Gekocht' }}
        </button>
        <span v-else class="plan-day__cooked-label meta-text">Gekocht</span>

        <label v-if="!entry.cookedAt && moveTargets.length > 0" class="plan-day__move">
          <select
            class="plan-day__move-select"
            :value="''"
            aria-label="Verschieben nach"
            @change="onMoveSelect(entry.id, $event)"
          >
            <option value="" disabled selected hidden>↔</option>
            <option v-for="option in moveTargets" :key="option.date" :value="option.date">
              {{ option.label }}
            </option>
          </select>
        </label>

        <button
          type="button"
          class="plan-day__remove"
          :aria-label="`${entry.recipeTitle} aus dem Plan entfernen`"
          @click="emit('remove', entry.id)"
        >
          ×
        </button>
      </li>
    </ul>

    <PlanSuggestionsRow
      v-if="showSuggestionBlock && suggestions.length > 0"
      :suggestions="suggestions"
      :recipe-image-urls="recipeImageUrls"
      @pick="emit('suggest-add', $event)"
    />

    <p v-else-if="showEmptySuggestionHint" class="plan-day__no-suggestions meta-text">
      Keine Vorschläge für diesen Tag.
    </p>

    <button type="button" class="btn btn--secondary btn--small plan-day__add" @click="emit('add', day.date)">
      + Rezept
    </button>
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import PlanRecipeThumb from './PlanRecipeThumb.vue'
import PlanSuggestionsRow from './PlanSuggestionsRow.vue'
import type { PlanDay, PlanEntry } from '../utils/mealPlanTypes'
import type { PlanSuggestionCandidate } from '../utils/planSuggestionScore'
import { formatPlanDayLabel, isPastIsoDate, isTodayIsoDate, isWeekendIsoDate, todayIsoDate } from '../utils/mealPlanDates'
import { PLAN_MANY_ENTRIES_HINT } from '../utils/mealPlanTypes'

const props = defineProps<{
  day: PlanDay
  today?: string
  cookingEntryId?: string | null
  recipeImageUrls?: Record<number, string | null>
  suggestions?: PlanSuggestionCandidate[]
  showSuggestions?: boolean
  suggestionsReady?: boolean
  moveDayOptions?: { date: string; label: string }[]
}>()

const moveTargets = computed(() => props.moveDayOptions ?? [])

const emit = defineEmits<{
  add: [date: string]
  remove: [entryId: string]
  cook: [entryId: string]
  move: [entryId: string, targetDate: string]
  'suggest-add': [suggestion: PlanSuggestionCandidate]
}>()

const referenceToday = computed(() => props.today ?? todayIsoDate())
const dayLabel = computed(() => formatPlanDayLabel(props.day.date, referenceToday.value))
const isToday = computed(() => isTodayIsoDate(props.day.date, referenceToday.value))
const isPast = computed(() => isPastIsoDate(props.day.date, referenceToday.value))
const isWeekend = computed(() => isWeekendIsoDate(props.day.date))
const hasOpenEntries = computed(() => props.day.entries.some((e) => !e.cookedAt))
const showManyHint = computed(() => props.day.entries.length >= PLAN_MANY_ENTRIES_HINT)
const suggestions = computed(() => props.suggestions ?? [])
const showSuggestionBlock = computed(() => props.showSuggestions === true)
const showEmptySuggestionHint = computed(
  () => showSuggestionBlock.value && props.suggestionsReady === true && suggestions.value.length === 0,
)

function entryImageUrl(entry: PlanEntry): string | null {
  return entry.recipeImageUrl ?? props.recipeImageUrls?.[entry.recipeId] ?? null
}

function onMoveSelect(entryId: string, event: Event) {
  const target = event.target as HTMLSelectElement
  const date = target.value
  if (!date) return
  emit('move', entryId, date)
  target.value = ''
}
</script>

<style scoped>
.plan-day {
  padding: var(--spacing-md) 0;
  border-top: 1px solid var(--color-border);
}

.plan-day:first-child {
  border-top: none;
  padding-top: 0;
}

.plan-day--today .plan-day__title {
  color: var(--color-accent);
}

.plan-day--past {
  opacity: 0.92;
}

.plan-day__header {
  display: flex;
  align-items: baseline;
  gap: var(--spacing-sm);
  margin-bottom: var(--spacing-sm);
}

.plan-day__title {
  font-size: 0.95rem;
  font-weight: 600;
}

.plan-day__past-hint {
  color: var(--color-warning, #b45309);
}

.plan-day__many-hint {
  margin-bottom: var(--spacing-sm);
  font-size: 0.85rem;
}

.plan-day__list {
  list-style: none;
  margin: 0 0 var(--spacing-sm);
  padding: 0;
}

.plan-day__item {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  padding: 0.35rem 0;
}

.plan-day__item--cooked .plan-day__link {
  text-decoration: line-through;
  color: var(--color-text-muted);
}

.plan-day__cook {
  flex-shrink: 0;
}

.plan-day__cooked-label {
  flex-shrink: 0;
  font-size: 0.8rem;
  color: var(--color-text-muted);
}

.plan-day__move {
  flex-shrink: 0;
}

.plan-day__move-select {
  width: 2.1rem;
  padding: 0.2rem 0.1rem;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm, 6px);
  background: var(--color-surface-subtle);
  color: var(--color-text-muted);
  font-size: 0.85rem;
  line-height: 1;
  cursor: pointer;
  text-align: center;
}

.plan-day__move-select:focus {
  outline: 2px solid var(--color-accent);
  outline-offset: 1px;
}

.plan-day__link {
  flex: 1;
  min-width: 0;
  color: var(--color-text);
  text-decoration: none;
  line-height: 1.4;
}

.plan-day__link:hover {
  color: var(--color-accent);
}

.plan-day__servings {
  font-size: 0.85em;
}

.plan-day__remove {
  border: none;
  background: transparent;
  color: var(--color-text-muted);
  font-size: 1.2rem;
  line-height: 1;
  cursor: pointer;
  flex-shrink: 0;
}

.plan-day__remove:hover {
  color: var(--color-danger);
}

.plan-day__add {
  margin-top: var(--spacing-xs);
  margin-bottom: var(--spacing-sm);
}

.plan-day__no-suggestions {
  margin: 0;
  font-size: 0.8rem;
}
</style>
