<template>
  <section
    class="plan-suggestions-panel"
    :class="{ 'plan-suggestions-panel--sidebar': layout === 'sidebar' }"
    aria-labelledby="plan-suggestions-panel-title"
  >
    <header class="plan-suggestions-panel__header">
      <div class="plan-suggestions-panel__header-text">
        <h2 id="plan-suggestions-panel-title" class="plan-suggestions-panel__title">Vorschläge</h2>
        <p v-if="hint" class="plan-suggestions-panel__hint meta-text">{{ hint }}</p>
      </div>
      <p v-if="suggestions.length" class="plan-suggestions-panel__count meta-text">
        {{ suggestions.length }} {{ suggestions.length === 1 ? 'Rezept' : 'Rezepte' }}
      </p>
    </header>

    <p v-if="loading" class="plan-suggestions-panel__status meta-text">Lädt…</p>
    <p v-else-if="error" class="plan-suggestions-panel__status plan-suggestions-panel__status--error">
      {{ error }}
    </p>
    <p v-else-if="ready && suggestions.length === 0" class="plan-suggestions-panel__status meta-text">
      Keine Vorschläge verfügbar.
    </p>

    <ul v-else class="plan-suggestions-panel__grid">
      <li v-for="suggestion in suggestions" :key="suggestion.recipeId">
        <button
          type="button"
          class="plan-suggestions-panel__card"
          :aria-label="`${suggestion.recipeTitle} einem Tag zuweisen`"
          @click="emit('assign', suggestion, $event)"
        >
          <PlanRecipeThumb
            :image-url="imageUrl(suggestion.recipeId)"
            :alt="suggestion.recipeTitle"
          />
          <span class="plan-suggestions-panel__text">
            <span class="plan-suggestions-panel__recipe">{{ suggestion.recipeTitle }}</span>
            <span
              v-if="layout !== 'sidebar' && primaryReason(suggestion)"
              class="plan-suggestions-panel__meta meta-text"
            >
              {{ primaryReason(suggestion) }}
            </span>
          </span>
          <span class="plan-suggestions-panel__action" aria-hidden="true">Zuweisen</span>
        </button>
      </li>
    </ul>
  </section>
</template>

<script setup lang="ts">
import PlanRecipeThumb from './PlanRecipeThumb.vue'
import type { PlanSuggestionCandidate } from '../utils/planSuggestionScore'

const props = withDefaults(
  defineProps<{
    suggestions: PlanSuggestionCandidate[]
    recipeImageUrls?: Record<number, string | null>
    loading?: boolean
    ready?: boolean
    error?: string | null
    hint?: string | null
    layout?: 'default' | 'sidebar'
  }>(),
  { layout: 'default' },
)

const emit = defineEmits<{
  assign: [suggestion: PlanSuggestionCandidate, event: MouseEvent]
}>()

function imageUrl(recipeId: number): string | null {
  return props.recipeImageUrls?.[recipeId] ?? null
}

function primaryReason(suggestion: PlanSuggestionCandidate): string {
  return suggestion.reasons[0] ?? ''
}
</script>

<style scoped>
.plan-suggestions-panel {
  display: flex;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
}

.plan-suggestions-panel__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--spacing-md);
  margin-bottom: var(--spacing-md);
  flex-shrink: 0;
}

.plan-suggestions-panel__header-text {
  min-width: 0;
}

.plan-suggestions-panel__title {
  margin: 0;
  font-size: 1.1rem;
  font-weight: 600;
  color: var(--color-accent);
}

.plan-suggestions-panel__hint {
  margin: 0.3rem 0 0;
  font-size: 0.82rem;
  line-height: 1.4;
  max-width: 36rem;
}

.plan-suggestions-panel__count {
  margin: 0;
  flex-shrink: 0;
  font-size: 0.78rem;
  padding: 0.2rem 0.55rem;
  border-radius: 999px;
  background: color-mix(in srgb, var(--color-accent) 12%, var(--color-surface-subtle));
  color: var(--color-accent);
  font-weight: 500;
}

.plan-suggestions-panel__status {
  margin: 0;
  font-size: 0.9rem;
  flex-shrink: 0;
}

.plan-suggestions-panel__status--error {
  color: var(--color-danger);
}

.plan-suggestions-panel__grid {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(min(100%, 15rem), 1fr));
  gap: var(--spacing-sm);
  min-width: 0;
}

.plan-suggestions-panel__card {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: var(--spacing-sm);
  width: 100%;
  min-width: 0;
  padding: 0.55rem 0.65rem;
  border: 1px solid color-mix(in srgb, var(--color-accent) 22%, var(--color-border));
  border-radius: var(--radius-md, 8px);
  background: var(--color-surface-subtle);
  cursor: pointer;
  color: var(--color-text);
  text-align: left;
  transition: border-color 0.15s ease, box-shadow 0.15s ease;
}

.plan-suggestions-panel__card:hover {
  border-color: var(--color-accent);
  box-shadow: 0 0 0 1px color-mix(in srgb, var(--color-accent) 25%, transparent);
}

.plan-suggestions-panel__card :deep(.plan-recipe-thumb) {
  width: 2.75rem;
  height: 2.75rem;
  flex-shrink: 0;
}

.plan-suggestions-panel__text {
  display: flex;
  flex-direction: column;
  min-width: 0;
  gap: 0.1rem;
}

.plan-suggestions-panel__recipe {
  font-size: 0.92rem;
  font-weight: 500;
  line-height: 1.3;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.plan-suggestions-panel__meta {
  font-size: 0.72rem;
  line-height: 1.25;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.plan-suggestions-panel__action {
  flex-shrink: 0;
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--color-accent);
  padding: 0.25rem 0.45rem;
  border-radius: var(--radius-sm, 6px);
  background: color-mix(in srgb, var(--color-accent) 10%, transparent);
}

/* Desktop right-hand column */
.plan-suggestions-panel--sidebar .plan-suggestions-panel__title {
  font-size: 1.2rem;
}

.plan-suggestions-panel--sidebar .plan-suggestions-panel__hint {
  max-width: none;
  font-size: 0.8rem;
}

.plan-suggestions-panel--sidebar .plan-suggestions-panel__grid {
  grid-template-columns: 1fr;
  gap: 0.4rem;
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  scrollbar-gutter: stable;
  padding-right: 0.5rem;
}

.plan-suggestions-panel--sidebar .plan-suggestions-panel__card {
  padding: 0.5rem 0.55rem;
}

.plan-suggestions-panel--sidebar .plan-suggestions-panel__recipe {
  -webkit-line-clamp: 3;
  font-size: 0.9rem;
}

.plan-suggestions-panel--sidebar .plan-suggestions-panel__card :deep(.plan-recipe-thumb) {
  width: 2.5rem;
  height: 2.5rem;
}

@media (max-width: 639px) {
  .plan-suggestions-panel__grid {
    display: flex;
    gap: var(--spacing-sm);
    overflow-x: auto;
    overscroll-behavior-x: contain;
    scroll-snap-type: x proximity;
    scrollbar-width: thin;
    padding: 0 0.1rem 0.35rem;
  }

  .plan-suggestions-panel__grid > li {
    flex: 0 0 min(68vw, 13rem);
    min-width: 0;
    scroll-snap-align: start;
  }

  .plan-suggestions-panel__card {
    display: flex;
    flex-direction: column;
    align-items: stretch;
    min-height: 9rem;
    padding: 0;
    overflow: hidden;
  }

  .plan-suggestions-panel__card :deep(.plan-recipe-thumb) {
    width: 100%;
    height: 5.5rem;
    border-radius: 0;
  }

  .plan-suggestions-panel__text {
    padding: 0.55rem 0.65rem 0.65rem;
  }

  .plan-suggestions-panel__recipe {
    -webkit-line-clamp: 2;
  }

  .plan-suggestions-panel__action {
    display: none;
  }
}

@media (min-width: 960px) {
  .plan-suggestions-panel--sidebar {
    flex: 1;
    min-height: 0;
  }
}
</style>
