<template>
  <Teleport to="body">
    <div
      v-if="open"
      class="app-modal-overlay plan-week-suggest"
      role="dialog"
      aria-modal="true"
      aria-labelledby="plan-week-suggest-title"
      @click.self="emit('close')"
    >
      <div class="plan-week-suggest__panel">
        <header class="plan-week-suggest__header">
          <div>
            <h2 id="plan-week-suggest-title" class="plan-week-suggest__title">Woche vorschlagen</h2>
            <p class="plan-week-suggest__subtitle meta-text">
              Top-Vorschlag pro leerem Tag — ohne bereits geplante Rezepte zu wiederholen.
            </p>
          </div>
          <button type="button" class="plan-week-suggest__close" aria-label="Schließen" @click="emit('close')">
            ×
          </button>
        </header>

        <div v-if="items.length === 0" class="plan-week-suggest__empty body-text">
          Keine leeren Tage mit Vorschlägen — der Plan ist voll oder es fehlen passende Rezepte.
        </div>

        <ul v-else class="plan-week-suggest__list">
          <li v-for="item in items" :key="item.date" class="plan-week-suggest__row">
            <span class="plan-week-suggest__day meta-text">{{ dayLabel(item.date) }}</span>
            <span class="plan-week-suggest__recipe">{{ item.candidate.recipeTitle }}</span>
            <span v-if="reasonHint(item.candidate)" class="plan-week-suggest__hint meta-text">
              {{ reasonHint(item.candidate) }}
            </span>
          </li>
        </ul>

        <footer class="plan-week-suggest__footer">
          <button type="button" class="btn btn--secondary" @click="emit('close')">Abbrechen</button>
          <button type="button" class="btn btn--primary" :disabled="items.length === 0" @click="emit('confirm')">
            {{ items.length === 1 ? '1 Rezept planen' : `${items.length} Rezepte planen` }}
          </button>
        </footer>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useBodyModalLock } from '../composables/useBodyModalLock'
import { formatPlanDayLabel, todayIsoDate } from '../utils/mealPlanDates'
import type { PlanSuggestionCandidate, WeekPlanSuggestion } from '../utils/planSuggestionScore'

const props = defineProps<{
  open: boolean
  items: WeekPlanSuggestion[]
  today?: string
}>()

const emit = defineEmits<{
  close: []
  confirm: []
}>()

useBodyModalLock(computed(() => props.open))

const referenceToday = computed(() => props.today ?? todayIsoDate())

function dayLabel(date: string): string {
  return formatPlanDayLabel(date, referenceToday.value)
}

function reasonHint(candidate: PlanSuggestionCandidate): string {
  return candidate.reasons.slice(0, 2).join(' · ')
}
</script>

<style scoped>
.plan-week-suggest__panel {
  width: min(100%, 28rem);
  max-height: min(85vh, 36rem);
  display: flex;
  flex-direction: column;
  background: var(--color-surface);
  border-radius: var(--radius-lg, 12px);
  box-shadow: var(--shadow-soft);
  border: 1px solid var(--color-border);
}

.plan-week-suggest__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--spacing-md);
  padding: var(--spacing-lg) var(--spacing-lg) var(--spacing-sm);
}

.plan-week-suggest__title {
  font-size: 1.125rem;
  font-weight: 600;
}

.plan-week-suggest__subtitle {
  margin-top: 0.25rem;
}

.plan-week-suggest__close {
  border: none;
  background: transparent;
  font-size: 1.5rem;
  line-height: 1;
  color: var(--color-text-muted);
  cursor: pointer;
  padding: 0.125rem 0.375rem;
}

.plan-week-suggest__empty {
  padding: var(--spacing-lg);
}

.plan-week-suggest__list {
  list-style: none;
  margin: 0;
  padding: 0 var(--spacing-lg);
  overflow-y: auto;
  flex: 1;
  min-height: 0;
}

.plan-week-suggest__row {
  display: grid;
  grid-template-columns: 5.5rem minmax(0, 1fr);
  gap: 0.15rem 0.5rem;
  padding: var(--spacing-sm) 0;
  border-top: 1px solid var(--color-border);
}

.plan-week-suggest__row:first-child {
  border-top: none;
}

.plan-week-suggest__day {
  grid-row: span 2;
  align-self: center;
  font-weight: 500;
}

.plan-week-suggest__recipe {
  font-weight: 500;
  line-height: 1.3;
}

.plan-week-suggest__hint {
  grid-column: 2;
  font-size: 0.75rem;
  line-height: 1.2;
}

.plan-week-suggest__footer {
  display: flex;
  justify-content: flex-end;
  gap: var(--spacing-sm);
  padding: var(--spacing-lg);
  border-top: 1px solid var(--color-border);
}
</style>
