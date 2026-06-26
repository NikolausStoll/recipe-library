<template>
  <div class="page shopping-view" :class="{ 'shopping-view--has-items': !isEmpty }">
    <header class="page-header shopping-view__header no-print">
      <div class="shopping-view__header-row">
        <div>
          <h1 class="page-header__title h2">Einkauf</h1>
          <p class="page-header__subtitle">
            {{ isEmpty ? 'Füge Zutaten aus Rezepten hinzu.' : `${itemCount} ${itemCount === 1 ? 'Eintrag' : 'Einträge'}` }}
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
          <li v-for="recipe in sourceRecipes" :key="recipe.id">
            <router-link :to="`/recipes/${recipe.id}`" class="shopping-view__recipe-link">
              {{ recipe.title }}
            </router-link>
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
          <li v-for="item in group.items" :key="item.id" class="shopping-view__item">
            {{ formatShoppingLine(item) }}
          </li>
        </ul>
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useShoppingList } from '../composables/useShoppingList'
import { formatShoppingLine } from '../utils/shoppingListFormat'

const { grouped, sourceRecipes, itemCount, isEmpty, clearList } = useShoppingList()

function onPrint() {
  window.print()
}

function onClear() {
  if (!window.confirm('Einkaufsliste wirklich leeren?')) return
  clearList()
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
  gap: var(--spacing-xs) var(--spacing-md);
}

.shopping-view__recipe-link {
  color: var(--color-accent);
  text-decoration: none;
  font-size: 0.95rem;
}

.shopping-view__recipe-link:hover {
  text-decoration: underline;
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

.shopping-view__item {
  padding: 0.35rem 0;
  line-height: 1.45;
}

.shopping-view__item::before {
  content: '– ';
  color: var(--color-text-muted);
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
  }

  .shopping-view__group-title {
    color: #000;
    margin-top: 0.75rem;
  }

  .shopping-view__item {
    font-size: 11pt;
  }
}
</style>

<style>
@media print {
  .app-shell__header,
  .mobile-bottom-nav {
    display: none !important;
  }

  .app-shell__main {
    padding: 0 !important;
  }
}
</style>
