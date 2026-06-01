<template>
  <div class="page more-view">
    <header class="page-header">
      <h1 class="page-header__title h2">More</h1>
    </header>
    <ul class="more-list surface-card">
      <li v-for="item in items" :key="item.to">
        <router-link :to="item.to" class="more-list__link">
          <span>{{ item.label }}</span>
          <span aria-hidden="true">›</span>
        </router-link>
      </li>
      <li class="more-list__theme">
        <span>Theme</span>
        <div class="more-list__theme-btns">
          <button
            v-for="opt in themeOptions"
            :key="opt.value"
            type="button"
            class="chip"
            :class="{ 'chip--selected': preference === opt.value }"
            @click="setPreference(opt.value)"
          >
            {{ opt.label }}
          </button>
        </div>
      </li>
    </ul>
    <p class="meta-text more-view__about">Recipe Library — personal cookbook</p>
  </div>
</template>

<script setup lang="ts">
import { useTheme, type ThemePreference } from '../composables/useTheme'

const { preference, setPreference } = useTheme()

const themeOptions: { value: ThemePreference; label: string }[] = [
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
  { value: 'system', label: 'System' },
]

const items = [
  { to: '/sources', label: 'Sources' },
  { to: '/favorites', label: 'Favorites' },
  { to: '/admin/extract-usage', label: 'Admin · AI token usage' },
]
</script>

<style scoped>
.more-list {
  list-style: none;
  max-width: 28rem;
  overflow: hidden;
}

.more-list__link {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--spacing-md) var(--spacing-lg);
  text-decoration: none;
  color: var(--color-text);
  border-bottom: 1px solid var(--color-border);
  font-weight: 500;
}

.more-list__link:hover {
  background: var(--color-surface-subtle);
}

.more-list__theme {
  padding: var(--spacing-md) var(--spacing-lg);
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
  font-weight: 500;
}

.more-list__theme-btns {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.more-view__about {
  margin-top: var(--spacing-xl);
}
</style>
