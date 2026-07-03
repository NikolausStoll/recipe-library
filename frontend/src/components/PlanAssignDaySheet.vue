<template>
  <Teleport to="body">
    <div
      v-if="open"
      class="app-modal-overlay plan-assign-day"
      role="dialog"
      aria-modal="true"
      aria-labelledby="plan-assign-day-title"
      @click.self="emit('close')"
    >
      <div class="plan-assign-day__panel">
        <header class="plan-assign-day__header">
          <div class="plan-assign-day__header-text">
            <h2 id="plan-assign-day-title" class="plan-assign-day__title">{{ title }}</h2>
            <p v-if="recipeTitle" class="plan-assign-day__recipe">{{ recipeTitle }}</p>
            <p class="plan-assign-day__hint meta-text">Wähle den Zieltag aus</p>
          </div>
          <button type="button" class="plan-assign-day__close" aria-label="Schließen" @click="emit('close')">
            ×
          </button>
        </header>

        <div v-if="days.length" class="plan-assign-day__days" role="listbox" aria-label="Zieltag">
          <button
            v-for="day in days"
            :key="day.date"
            type="button"
            class="plan-assign-day__card"
            :class="{ 'plan-assign-day__card--today': day.isToday }"
            role="option"
            :aria-label="`${day.compactLabel} ${day.subLabel}`"
            @click="emit('select', day.date)"
          >
            <span class="plan-assign-day__label">{{ day.compactLabel }}</span>
            <span class="plan-assign-day__sub">{{ day.subLabel }}</span>
            <span v-if="day.plannedCount > 0" class="plan-assign-day__meta meta-text">
              {{ day.plannedCount }} {{ day.plannedCount === 1 ? 'Gericht' : 'Gerichte' }}
            </span>
          </button>
        </div>

        <p v-else class="plan-assign-day__empty meta-text">Keine passenden Tage verfügbar.</p>

        <footer class="plan-assign-day__footer">
          <button type="button" class="btn btn--secondary plan-assign-day__cancel" @click="emit('close')">
            Abbrechen
          </button>
        </footer>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useBodyModalLock } from '../composables/useBodyModalLock'
import type { PlanAssignDayOption } from '../utils/planAssignDays'

const props = defineProps<{
  open: boolean
  title: string
  recipeTitle?: string | null
  days: PlanAssignDayOption[]
}>()

const emit = defineEmits<{
  close: []
  select: [date: string]
}>()

useBodyModalLock(computed(() => props.open))
</script>

<style scoped>
.plan-assign-day__panel {
  width: min(100%, 36rem);
  max-height: min(90vh, 28rem);
  display: flex;
  flex-direction: column;
  background: var(--color-surface);
  border-radius: var(--radius-lg, 12px);
  box-shadow: var(--shadow-soft);
  border: 1px solid var(--color-border);
}

.plan-assign-day__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--spacing-md);
  padding: var(--spacing-lg) var(--spacing-lg) var(--spacing-sm);
}

.plan-assign-day__title {
  margin: 0;
  font-size: 1.125rem;
  font-weight: 600;
}

.plan-assign-day__recipe {
  margin: 0.25rem 0 0;
  font-size: 0.95rem;
  font-weight: 500;
  line-height: 1.35;
}

.plan-assign-day__hint {
  margin: 0.35rem 0 0;
  font-size: 0.82rem;
}

.plan-assign-day__close {
  border: none;
  background: transparent;
  font-size: 1.5rem;
  line-height: 1;
  color: var(--color-text-muted);
  cursor: pointer;
  padding: 0.125rem 0.375rem;
  flex-shrink: 0;
}

.plan-assign-day__days {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(4.5rem, 1fr));
  gap: var(--spacing-sm);
  padding: var(--spacing-md) var(--spacing-lg);
  overflow-x: auto;
  overflow-y: auto;
  flex: 1;
  min-height: 0;
}

.plan-assign-day__card {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.1rem;
  min-height: 5.5rem;
  padding: var(--spacing-sm) var(--spacing-xs);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md, 8px);
  background: var(--color-surface-subtle);
  color: var(--color-text);
  cursor: pointer;
  text-align: center;
}

.plan-assign-day__card:hover {
  border-color: var(--color-accent);
  color: var(--color-accent);
}

.plan-assign-day__card--today {
  border-color: color-mix(in srgb, var(--color-accent) 45%, var(--color-border));
  background: color-mix(in srgb, var(--color-accent) 8%, var(--color-surface-subtle));
}

.plan-assign-day__label {
  font-size: 0.95rem;
  font-weight: 600;
  line-height: 1.2;
}

.plan-assign-day__sub {
  font-size: 1.1rem;
  font-weight: 500;
  line-height: 1.1;
  color: var(--color-text-muted);
}

.plan-assign-day__card:hover .plan-assign-day__sub {
  color: inherit;
}

.plan-assign-day__meta {
  margin-top: 0.15rem;
  font-size: 0.68rem;
  line-height: 1.2;
}

.plan-assign-day__empty {
  margin: 0;
  padding: var(--spacing-md) var(--spacing-lg);
}

.plan-assign-day__footer {
  display: flex;
  justify-content: flex-end;
  padding: var(--spacing-md) var(--spacing-lg) var(--spacing-lg);
  border-top: 1px solid var(--color-border);
}

@media (max-width: 639px) {
  .plan-assign-day.app-modal-overlay {
    align-items: flex-end;
    padding: 0;
  }

  .plan-assign-day__panel {
    width: 100%;
    max-height: min(88vh, 32rem);
    border-radius: var(--radius-lg, 12px) var(--radius-lg, 12px) 0 0;
    border-bottom: none;
  }

  .plan-assign-day__days {
    grid-template-columns: repeat(4, minmax(4.25rem, 1fr));
    gap: 0.45rem;
  }

  .plan-assign-day__card {
    min-height: 4.75rem;
    padding: 0.55rem 0.35rem;
  }
}
</style>
