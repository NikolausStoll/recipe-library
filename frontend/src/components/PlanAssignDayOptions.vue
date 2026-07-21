<template>
  <div v-if="days.length" class="plan-assign-day-options" :class="`plan-assign-day-options--${variant}`" role="listbox" aria-label="Zieltag">
    <button
      v-for="day in days"
      :key="day.date"
      type="button"
      class="plan-assign-day-options__chip"
      :class="{
        'plan-assign-day-options__chip--today': day.isToday,
        'plan-assign-day-options__chip--popover': variant === 'popover',
      }"
      role="option"
      :aria-label="chipAriaLabel(day)"
      @click="emit('select', day.date)"
    >
      <template v-if="variant === 'popover'">
        <span class="plan-assign-day-options__label">{{ day.popoverLabel }}</span>
        <span class="plan-assign-day-options__sub">{{ day.popoverSubLabel }}</span>
      </template>
      <template v-else>
        <span class="plan-assign-day-options__label">{{ day.compactLabel }}</span>
        <span class="plan-assign-day-options__sub">{{ day.subLabel }}</span>
        <span v-if="day.plannedCount > 0" class="plan-assign-day-options__meta meta-text">
          {{ day.plannedCount }} {{ day.plannedCount === 1 ? 'Gericht' : 'Gerichte' }}
        </span>
      </template>
      <span
        v-if="day.plannedCount > 0 && variant === 'popover'"
        class="plan-assign-day-options__count"
        :title="`${day.plannedCount} geplant`"
      >
        {{ day.plannedCount }}
      </span>
    </button>
  </div>
  <p v-else class="plan-assign-day-options__empty meta-text">Keine passenden Tage verfügbar.</p>
</template>

<script setup lang="ts">
import type { PlanAssignDayOption } from '../utils/planAssignDays'

defineProps<{
  days: PlanAssignDayOption[]
  variant: 'sheet' | 'popover'
}>()

const emit = defineEmits<{
  select: [date: string]
}>()

function chipAriaLabel(day: PlanAssignDayOption): string {
  const count =
    day.plannedCount > 0
      ? `, ${day.plannedCount} ${day.plannedCount === 1 ? 'Gericht' : 'Gerichte'} geplant`
      : ''
  return `${day.compactLabel} ${day.subLabel}${count}`
}
</script>

<style scoped>
.plan-assign-day-options--sheet {
  display: grid;
  grid-template-columns: repeat(4, minmax(4.25rem, 1fr));
  gap: 0.45rem;
}

.plan-assign-day-options--popover {
  display: flex;
  flex-wrap: nowrap;
  align-items: stretch;
  gap: 0.2rem;
}

.plan-assign-day-options__chip {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.05rem;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md, 8px);
  background: var(--color-surface-subtle);
  color: var(--color-text);
  cursor: pointer;
  text-align: center;
  transition: border-color 0.12s ease, color 0.12s ease, background 0.12s ease;
}

.plan-assign-day-options--sheet .plan-assign-day-options__chip {
  min-height: 4.75rem;
  padding: 0.55rem 0.35rem;
}

.plan-assign-day-options--popover .plan-assign-day-options__chip {
  position: relative;
  flex: 0 0 auto;
  min-width: 2.15rem;
  min-height: 0;
  padding: 0.2rem 0.28rem 0.18rem;
  border-radius: var(--radius-sm, 6px);
}

.plan-assign-day-options__chip:hover {
  border-color: var(--color-accent);
  color: var(--color-accent);
}

.plan-assign-day-options__chip--today {
  border-color: color-mix(in srgb, var(--color-accent) 45%, var(--color-border));
  background: color-mix(in srgb, var(--color-accent) 8%, var(--color-surface-subtle));
}

.plan-assign-day-options__label {
  font-size: 0.82rem;
  font-weight: 600;
  line-height: 1.15;
}

.plan-assign-day-options--sheet .plan-assign-day-options__label {
  font-size: 0.95rem;
}

.plan-assign-day-options--popover .plan-assign-day-options__label {
  font-size: 0.72rem;
  font-weight: 650;
  line-height: 1;
}

.plan-assign-day-options__sub {
  font-size: 0.95rem;
  font-weight: 500;
  line-height: 1;
  color: var(--color-text-muted);
}

.plan-assign-day-options--popover .plan-assign-day-options__sub {
  font-size: 0.58rem;
  font-weight: 500;
  line-height: 1;
}

.plan-assign-day-options__chip:hover .plan-assign-day-options__sub {
  color: inherit;
}

.plan-assign-day-options__meta {
  margin-top: 0.15rem;
  font-size: 0.68rem;
  line-height: 1.2;
}

.plan-assign-day-options__count {
  position: absolute;
  top: 0.1rem;
  right: 0.12rem;
  min-width: 0.75rem;
  height: 0.75rem;
  padding: 0 0.12rem;
  border-radius: 999px;
  font-size: 0.5rem;
  font-weight: 600;
  line-height: 0.75rem;
  background: color-mix(in srgb, var(--color-accent) 14%, var(--color-surface-subtle));
  color: var(--color-accent);
}

.plan-assign-day-options__empty {
  margin: 0;
  padding: 0.25rem 0;
  font-size: 0.82rem;
}
</style>
