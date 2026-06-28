<template>
  <div class="page shopping-view" :class="{ 'shopping-view--has-items': !isEmpty }">
    <header class="page-header shopping-view__header no-print">
      <div class="shopping-view__header-row">
        <div>
          <h1 class="page-header__title h2">Einkauf</h1>
          <p class="page-header__subtitle">
            <template v-if="isEmpty">Füge Zutaten aus Rezepten hinzu.</template>
            <template v-else>
              {{ itemCount }} {{ itemCount === 1 ? 'Eintrag' : 'Einträge' }}
              <span v-if="uncheckedCount < itemCount" class="shopping-view__subtitle-meta">
                · {{ uncheckedCount }} offen
              </span>
            </template>
          </p>
        </div>
        <div v-if="!isEmpty" class="shopping-view__actions">
          <button type="button" class="btn btn--secondary" @click="onPrint">Drucken</button>
          <button type="button" class="btn btn--secondary shopping-view__clear" @click="onClear">
            Liste leeren
          </button>
        </div>
      </div>
    </header>

    <div v-if="isEmpty" class="surface-card shopping-view__card no-print">
      <p class="body-text">
        Öffne ein Rezept und tippe auf das Einkaufs-Icon bei den Zutaten, um Einträge hinzuzufügen.
      </p>
      <router-link to="/recipes" class="btn btn--secondary shopping-view__link">Zu den Rezepten</router-link>
    </div>

    <div v-else class="shopping-view__list-wrap">
      <p class="shopping-view__print-title print-only">Einkaufsliste</p>

      <section v-if="sourceRecipes.length" class="shopping-view__recipes no-print" aria-label="Rezepte auf dieser Liste">
        <h2 class="shopping-view__recipes-title">Rezepte auf dieser Liste</h2>
        <ul class="shopping-view__recipes-list">
          <li v-for="recipe in sourceRecipes" :key="recipe.id" class="shopping-view__recipe-chip">
            <router-link :to="`/recipes/${recipe.id}`" class="shopping-view__recipe-link">
              {{ recipe.title }}
            </router-link>
            <button
              type="button"
              class="shopping-view__recipe-remove"
              :aria-label="`${recipe.title} von der Einkaufsliste entfernen`"
              @click="onRemoveRecipe(recipe.id, recipe.title)"
            >
              ×
            </button>
          </li>
        </ul>
      </section>

      <section
        v-for="group in grouped"
        :key="group.categoryKey"
        class="shopping-view__group"
      >
        <h2 class="shopping-view__group-title">{{ group.categoryLabel }}</h2>
        <ul class="shopping-view__list">
          <li
            v-for="item in group.items"
            :key="item.id"
            class="shopping-view__item-row"
            :class="{ 'shopping-view__item-row--checked': item.checked }"
          >
            <label class="shopping-view__item-label no-print">
              <input
                type="checkbox"
                class="shopping-view__item-checkbox"
                :checked="item.checked"
                @change="toggleChecked(item.id)"
              />
              <span class="shopping-view__item-text">{{ formatShoppingLine(item) }}</span>
            </label>
            <span class="shopping-view__item-text print-only">{{ formatShoppingLine(item) }}</span>
            <button
              type="button"
              class="shopping-view__item-remove no-print"
              :aria-label="`${formatShoppingLine(item)} entfernen`"
              @click="removeItem(item.id)"
            >
              ×
            </button>
          </li>
        </ul>
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useShoppingList } from '../composables/useShoppingList'
import { formatShoppingLine } from '../utils/shoppingListFormat'

const {
  grouped,
  sourceRecipes,
  itemCount,
  uncheckedCount,
  isEmpty,
  clearList,
  toggleChecked,
  removeItem,
  removeRecipe,
} = useShoppingList()

function onPrint() {
  window.print()
}

function onClear() {
  if (!window.confirm('Einkaufsliste wirklich leeren?')) return
  clearList()
}

function onRemoveRecipe(recipeId: number, title: string) {
  if (!window.confirm(`Zutaten von „${title}“ von der Einkaufsliste entfernen?`)) return
  removeRecipe(recipeId)
}
</script>

<style scoped>
.shopping-view__header-row {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--spacing-md);
}

.shopping-view__subtitle-meta {
  color: var(--color-text-muted);
}

.shopping-view__actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--spacing-sm);
}

.shopping-view__card {
  padding: var(--spacing-xl);
  display: flex;
  flex-direction: column;
  gap: var(--spacing-lg);
  max-width: 36rem;
}

.shopping-view__link {
  align-self: flex-start;
  text-decoration: none;
}

.shopping-view__list-wrap {
  max-width: 40rem;
}

.shopping-view__recipes {
  margin-bottom: var(--spacing-xl);
  padding-bottom: var(--spacing-lg);
  border-bottom: 1px solid var(--color-border);
}

.shopping-view__recipes-title {
  font-size: 0.875rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--color-text-muted);
  margin-bottom: var(--spacing-sm);
}

.shopping-view__recipes-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-wrap: wrap;
  gap: var(--spacing-xs);
}

.shopping-view__recipe-chip {
  display: inline-flex;
  align-items: center;
  gap: 0.15rem;
  padding: 0.2rem 0.45rem 0.2rem 0.65rem;
  border: 1px solid var(--color-border);
  border-radius: 999px;
  background: var(--color-surface-raised);
}

.shopping-view__recipe-link {
  color: var(--color-accent);
  text-decoration: none;
  font-size: 0.9rem;
}

.shopping-view__recipe-link:hover {
  text-decoration: underline;
}

.shopping-view__recipe-remove {
  border: none;
  background: transparent;
  color: var(--color-text-muted);
  font-size: 1.1rem;
  line-height: 1;
  cursor: pointer;
  padding: 0 0.2rem;
}

.shopping-view__recipe-remove:hover {
  color: var(--color-danger);
}

.shopping-view__group + .shopping-view__group {
  margin-top: var(--spacing-xl);
}

.shopping-view__group-title {
  font-size: 0.875rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--color-text-muted);
  margin-bottom: var(--spacing-sm);
}

.shopping-view__list {
  list-style: none;
  margin: 0;
  padding: 0;
}

.shopping-view__item-row {
  display: flex;
  align-items: flex-start;
  gap: var(--spacing-sm);
  padding: 0.35rem 0;
  line-height: 1.45;
}

.shopping-view__item-label {
  display: flex;
  align-items: flex-start;
  gap: var(--spacing-sm);
  flex: 1;
  min-width: 0;
  cursor: pointer;
}

.shopping-view__item-checkbox {
  margin-top: 0.2rem;
  flex-shrink: 0;
}

.shopping-view__item-text {
  flex: 1;
  min-width: 0;
}

.shopping-view__item-row--checked .shopping-view__item-text {
  text-decoration: line-through;
  color: var(--color-text-muted);
}

.shopping-view__item-remove {
  border: none;
  background: transparent;
  color: var(--color-text-muted);
  font-size: 1.2rem;
  line-height: 1;
  cursor: pointer;
  padding: 0 0.15rem;
  flex-shrink: 0;
}

.shopping-view__item-remove:hover {
  color: var(--color-danger);
}

.shopping-view__print-title {
  display: none;
  font-size: 1.25rem;
  font-weight: 600;
  margin-bottom: 1rem;
}

.shopping-view__clear {
  color: var(--color-danger);
  border-color: var(--color-delete-border);
}

.print-only {
  display: none;
}

@media print {
  .no-print {
    display: none !important;
  }

  .print-only {
    display: block !important;
  }

  .shopping-view {
    padding: 0;
    max-width: none;
  }

  .shopping-view__list-wrap {
    max-width: none;
    column-count: 2;
    column-gap: 1.25rem;
  }

  .shopping-view__print-title {
    column-span: all;
    font-size: 10pt;
    font-weight: 600;
    margin: 0 0 0.35rem;
  }

  .shopping-view__group {
    break-inside: avoid;
    margin: 0 0 0.45rem;
  }

  .shopping-view__group + .shopping-view__group {
    margin-top: 0.35rem;
  }

  .shopping-view__group-title {
    color: #000;
    font-size: 7pt;
    font-weight: 700;
    letter-spacing: 0.06em;
    margin: 0.25rem 0 0.1rem;
    break-after: avoid;
  }

  .shopping-view__item-row {
    display: block;
    font-size: 8pt;
    line-height: 1.2;
    padding: 0.05rem 0;
  }

  .shopping-view__item-row .print-only::before {
    content: '– ';
    color: #444;
  }

  .shopping-view__item-row--checked {
    display: none;
  }
}
</style>

<style>
@media print {
  @page {
    margin: 0.75cm;
  }

  .app-shell__header,
  .mobile-bottom-nav {
    display: none !important;
  }

  .app-shell__main {
    padding: 0 !important;
    max-width: none !important;
  }

  .page {
    padding: 0 !important;
  }
}
</style>
