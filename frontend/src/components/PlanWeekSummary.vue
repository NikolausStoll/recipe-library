<template>
  <div class="plan-week-summary" role="status">
    <span class="plan-week-summary__chip">
      <strong>{{ stats.plannedOpenCount }}</strong>
      {{ stats.plannedOpenCount === 1 ? 'Gericht' : 'Gerichte' }} offen
    </span>
    <span v-if="stats.emptyFutureDayCount > 0" class="plan-week-summary__chip plan-week-summary__chip--muted">
      {{ stats.emptyFutureDayCount }} {{ stats.emptyFutureDayCount === 1 ? 'Tag' : 'Tage' }} ohne Plan
    </span>
    <span v-if="stats.shoppingEntryCount > 0" class="plan-week-summary__chip plan-week-summary__chip--muted">
      {{ stats.shoppingEntryCount }} fürs Einkaufen
    </span>
  </div>
</template>

<script setup lang="ts">
import type { PlanWeekStats } from '../utils/planWeekSummary'

defineProps<{
  stats: PlanWeekStats
}>()
</script>

<style scoped>
.plan-week-summary {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
  margin-bottom: var(--spacing-md);
}

.plan-week-summary__chip {
  display: inline-flex;
  align-items: baseline;
  gap: 0.25rem;
  padding: 0.25rem 0.55rem;
  border-radius: var(--radius-md, 8px);
  border: 1px solid var(--color-border);
  background: var(--color-surface-raised);
  font-size: 0.8rem;
  line-height: 1.3;
}

.plan-week-summary__chip--muted {
  color: var(--color-text-muted);
  background: var(--color-surface-subtle);
}

.plan-week-summary__chip strong {
  font-weight: 600;
  color: var(--color-text);
}
</style>
