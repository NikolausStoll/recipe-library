<template>
  <section
    :id="`plan-day-${day.date}`"
    class="plan-day"
    :class="{
      'plan-day--today': isToday,
      'plan-day--past': isPast,
      'plan-day--weekend': isWeekend,
      'plan-day--empty': day.entries.length === 0,
    }"
  >
    <header class="plan-day__header">
      <h2 class="plan-day__title">{{ dayLabel }}</h2>
      <p v-if="isPast && hasOpenEntries" class="plan-day__past-hint meta-text">Noch offen</p>
      <button
        v-if="!isPast"
        type="button"
        class="btn btn--secondary btn--small plan-day__add"
        @click="emit('add', day.date)"
      >
        + Rezept
      </button>
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
          <span class="plan-day__recipe-title">{{ entry.recipeTitle }}</span>
          <span class="plan-day__servings meta-text">
            {{ entry.servings }} {{ entry.servings === 1 ? 'Portion' : 'Portionen' }}
          </span>
        </router-link>

        <div class="plan-day__actions">
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

          <button
            v-if="!entry.cookedAt && canMove"
            type="button"
            class="btn btn--secondary btn--small plan-day__move-btn"
            aria-label="Zu anderem Tag verschieben"
            @click="emit('assign-move', entry.id, day.date, entry.recipeTitle)"
          >
            Verschieben
          </button>

          <button
            type="button"
            class="plan-day__remove"
            :aria-label="`${entry.recipeTitle} aus dem Plan entfernen`"
            @click="emit('remove', entry.id)"
          >
            ×
          </button>
        </div>
      </li>
    </ul>

    <p v-else-if="!isPast" class="plan-day__empty meta-text">
      Noch nichts geplant.
    </p>
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import PlanRecipeThumb from './PlanRecipeThumb.vue'
import type { PlanDay, PlanEntry } from '../utils/mealPlanTypes'
import { formatPlanDayLabel, isPastIsoDate, isTodayIsoDate, isWeekendIsoDate, todayIsoDate } from '../utils/mealPlanDates'
import { PLAN_MANY_ENTRIES_HINT } from '../utils/mealPlanTypes'

const props = defineProps<{
  day: PlanDay
  today?: string
  cookingEntryId?: string | null
  recipeImageUrls?: Record<number, string | null>
  canMove?: boolean
}>()

const emit = defineEmits<{
  add: [date: string]
  remove: [entryId: string]
  cook: [entryId: string]
  'assign-move': [entryId: string, sourceDate: string, recipeTitle: string]
}>()

const referenceToday = computed(() => props.today ?? todayIsoDate())
const dayLabel = computed(() => formatPlanDayLabel(props.day.date, referenceToday.value))
const isToday = computed(() => isTodayIsoDate(props.day.date, referenceToday.value))
const isPast = computed(() => isPastIsoDate(props.day.date, referenceToday.value))
const isWeekend = computed(() => isWeekendIsoDate(props.day.date))
const hasOpenEntries = computed(() => props.day.entries.some((e) => !e.cookedAt))
const showManyHint = computed(() => props.day.entries.length >= PLAN_MANY_ENTRIES_HINT)

function entryImageUrl(entry: PlanEntry): string | null {
  return entry.recipeImageUrl ?? props.recipeImageUrls?.[entry.recipeId] ?? null
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

.plan-day--today {
  background: color-mix(in srgb, var(--color-accent) 6%, transparent);
  margin-inline: calc(-1 * var(--spacing-md));
  padding-inline: var(--spacing-md);
  border-radius: var(--radius-md, 8px);
}

.plan-day--past {
  opacity: 0.88;
}

.plan-day--empty:not(.plan-day--past) .plan-day__title {
  color: var(--color-text-muted);
}

.plan-day__header {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  margin-bottom: var(--spacing-sm);
}

.plan-day__title {
  margin: 0;
  flex: 1;
  min-width: 0;
  font-size: 1rem;
  font-weight: 600;
}

.plan-day--today .plan-day__title {
  color: var(--color-accent);
}

.plan-day__past-hint {
  color: var(--color-warning, #b45309);
  font-size: 0.8rem;
}

.plan-day__add {
  flex-shrink: 0;
  margin-left: auto;
}

.plan-day__many-hint {
  margin: 0 0 var(--spacing-sm);
  font-size: 0.85rem;
}

.plan-day__list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.45rem;
}

.plan-day__item {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  padding: 0.5rem 0.6rem;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md, 8px);
  background: var(--color-surface-subtle);
}

.plan-day__item--cooked {
  opacity: 0.75;
}

.plan-day__item--cooked .plan-day__recipe-title {
  text-decoration: line-through;
  color: var(--color-text-muted);
}

.plan-day__link {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 0.1rem;
  color: var(--color-text);
  text-decoration: none;
  line-height: 1.35;
}

.plan-day__link:hover .plan-day__recipe-title {
  color: var(--color-accent);
}

.plan-day__recipe-title {
  font-size: 0.95rem;
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.plan-day__servings {
  font-size: 0.78rem;
}

.plan-day__actions {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  flex-shrink: 0;
}

.plan-day__cook {
  flex-shrink: 0;
}

.plan-day__cooked-label {
  font-size: 0.78rem;
  color: var(--color-text-muted);
  padding: 0 0.25rem;
}

.plan-day__move-btn {
  flex-shrink: 0;
  font-size: 0.78rem;
  padding-inline: 0.45rem;
}

.plan-day__remove {
  border: none;
  background: transparent;
  color: var(--color-text-muted);
  font-size: 1.2rem;
  line-height: 1;
  cursor: pointer;
  padding: 0 0.15rem;
}

.plan-day__remove:hover {
  color: var(--color-danger);
}

.plan-day__empty {
  margin: 0;
  font-size: 0.85rem;
}

@media (min-width: 960px) {
  .plan-day--today {
    margin-inline: calc(-1 * var(--spacing-xl));
    padding-inline: var(--spacing-xl);
  }

  .plan-day__item {
    padding: 0.55rem 0.75rem;
  }
}
</style>
