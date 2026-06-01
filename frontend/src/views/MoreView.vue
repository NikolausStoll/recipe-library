<template>
  <div class="page more-view">
    <header class="page-header more-view__header">
      <h1 class="page-header__title h2">More</h1>
    </header>
    <ul class="more-list surface-card">
      <li v-for="item in navItems" :key="item.to">
        <router-link :to="item.to" class="more-list__link">
          <span>{{ item.label }}</span>
          <span class="more-list__chevron" aria-hidden="true">›</span>
        </router-link>
      </li>
      <li>
        <a href="#settings" class="more-list__link">
          <span>Settings</span>
          <span class="more-list__chevron" aria-hidden="true">›</span>
        </a>
      </li>
      <li id="settings" class="more-list__theme">
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

    <section class="more-about surface-card" aria-labelledby="more-about-heading">
      <h2 id="more-about-heading" class="more-about__title">About</h2>
      <p class="meta-text more-about__text">
        Recipe Library is a calm personal cookbook for your own recipes, favorites, and cooking notes.
      </p>
      <p class="meta-text more-about__version">Version {{ appVersion }}</p>
    </section>
  </div>
</template>

<script setup lang="ts">
import { useTheme, type ThemePreference } from '../composables/useTheme'
import packageJson from '../../package.json'

const { preference, setPreference } = useTheme()
const appVersion = packageJson.version

const themeOptions: { value: ThemePreference; label: string }[] = [
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
  { value: 'system', label: 'System' },
]

const navItems = [
  { to: '/sources', label: 'Sources' },
  { to: '/favorites', label: 'Favorites' },
  { to: '/admin/extract-usage', label: 'Admin' },
]
</script>

<style scoped>
.more-view__header {
  margin-bottom: var(--spacing-md);
}

.more-list {
  list-style: none;
  max-width: 28rem;
  overflow: hidden;
  margin: 0 0 var(--spacing-lg);
  padding: 0;
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

.more-list__chevron {
  color: var(--color-text-soft);
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

.more-about {
  max-width: 28rem;
  padding: var(--spacing-lg);
}

.more-about__title {
  margin: 0 0 var(--spacing-sm);
  font-size: 1rem;
  font-weight: 620;
  color: var(--color-text);
}

.more-about__text {
  margin: 0 0 var(--spacing-md);
  line-height: 1.5;
}

.more-about__version {
  margin: 0;
  font-size: 0.8125rem;
}
</style>
