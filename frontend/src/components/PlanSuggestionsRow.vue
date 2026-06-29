<template>
  <div v-if="suggestions.length" class="plan-suggestions">
    <p class="plan-suggestions__label meta-text">Vorschläge</p>
    <ul class="plan-suggestions__list">
      <li v-for="suggestion in suggestions" :key="suggestion.recipeId">
        <button
          type="button"
          class="plan-suggestions__item"
          :aria-label="`${suggestion.recipeTitle} planen`"
          @click="emit('pick', suggestion)"
        >
          <PlanRecipeThumb :image-url="imageUrl(suggestion.recipeId)" :alt="suggestion.recipeTitle" />
          <span class="plan-suggestions__text">
            <span class="plan-suggestions__title">{{ suggestion.recipeTitle }}</span>
            <span v-if="reasonHint(suggestion)" class="plan-suggestions__hint meta-text">
              {{ reasonHint(suggestion) }}
            </span>
          </span>
        </button>
      </li>
    </ul>
  </div>
</template>

<script setup lang="ts">
import PlanRecipeThumb from './PlanRecipeThumb.vue'
import type { PlanSuggestionCandidate } from '../utils/planSuggestionScore'

const props = defineProps<{
  suggestions: PlanSuggestionCandidate[]
  recipeImageUrls?: Record<number, string | null>
}>()

const emit = defineEmits<{
  pick: [suggestion: PlanSuggestionCandidate]
}>()

function imageUrl(recipeId: number): string | null {
  return props.recipeImageUrls?.[recipeId] ?? null
}

function reasonHint(suggestion: PlanSuggestionCandidate): string {
  return suggestion.reasons.join(' · ')
}
</script>

<style scoped>
.plan-suggestions {
  --plan-suggestion-card-width: 11.25rem;
  margin: var(--spacing-sm) 0;
}

.plan-suggestions__label {
  margin: 0 0 0.35rem;
  font-size: 0.8rem;
}

.plan-suggestions__list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  grid-template-columns: repeat(auto-fill, var(--plan-suggestion-card-width));
  gap: 0.35rem;
}

.plan-suggestions__list > li {
  min-width: 0;
}

.plan-suggestions__item {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  width: 100%;
  min-width: 0;
  padding: 0.25rem 0.45rem 0.25rem 0.25rem;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md, 8px);
  background: var(--color-surface-subtle);
  cursor: pointer;
  color: var(--color-text);
  text-align: left;
}

.plan-suggestions__item:hover {
  border-color: var(--color-accent);
  color: var(--color-accent);
}

.plan-suggestions__text {
  display: flex;
  flex-direction: column;
  min-width: 0;
  flex: 1;
}

.plan-suggestions__title {
  font-size: 0.85rem;
  line-height: 1.25;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.plan-suggestions__hint {
  font-size: 0.72rem;
  line-height: 1.2;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
</style>
