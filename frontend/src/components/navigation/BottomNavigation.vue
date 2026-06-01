<template>
  <nav class="mobile-bottom-nav" aria-label="Main">
    <router-link
      v-for="item in sideItems"
      :key="item.to"
      :to="item.to"
      class="mobile-bottom-nav__item"
      :class="{ 'mobile-bottom-nav__item--active': isActive(item) }"
    >
      <span class="mobile-bottom-nav__icon" aria-hidden="true">{{ item.icon }}</span>
      <span class="mobile-bottom-nav__label">{{ item.label }}</span>
    </router-link>
    <router-link to="/add" class="mobile-bottom-nav__item mobile-bottom-nav__item--add" :class="{ 'mobile-bottom-nav__item--active': route.path === '/add' }">
      <span class="mobile-bottom-nav__icon mobile-bottom-nav__icon--add" aria-hidden="true">+</span>
      <span class="mobile-bottom-nav__label">Add</span>
    </router-link>
    <router-link
      v-for="item in rightItems"
      :key="item.to"
      :to="item.to"
      class="mobile-bottom-nav__item"
      :class="{ 'mobile-bottom-nav__item--active': isActive(item) }"
    >
      <span class="mobile-bottom-nav__icon" aria-hidden="true">{{ item.icon }}</span>
      <span class="mobile-bottom-nav__label">{{ item.label }}</span>
    </router-link>
  </nav>
</template>

<script setup lang="ts">
import { useRoute } from 'vue-router'

const route = useRoute()

const sideItems = [
  { to: '/recipes', label: 'Recipes', icon: '⌂', match: (p: string) => p.startsWith('/recipes') },
  { to: '/plan', label: 'Plan', icon: '◷', match: (p: string) => p.startsWith('/plan') },
]

const rightItems = [
  { to: '/shopping', label: 'Shopping', icon: '☐', match: (p: string) => p.startsWith('/shopping') },
  { to: '/more', label: 'More', icon: '⋯', match: (p: string) => p === '/more' || p.startsWith('/sources') || p.startsWith('/admin') || p.startsWith('/favorites') },
]

function isActive(item: { match: (p: string) => boolean }) {
  return item.match(route.path)
}
</script>

<style scoped>
.mobile-bottom-nav {
  display: none;
}

@media (max-width: 1023px) {
  .mobile-bottom-nav {
    display: flex;
    position: fixed;
    left: 0;
    right: 0;
    bottom: 0;
    height: calc(var(--bottom-nav-height) + env(safe-area-inset-bottom));
    padding-bottom: env(safe-area-inset-bottom);
    background: color-mix(in srgb, var(--color-surface) 94%, transparent);
    border-top: 1px solid var(--color-border);
    backdrop-filter: blur(16px);
    z-index: var(--z-bottom-nav);
    align-items: stretch;
    justify-content: space-around;
  }

  .mobile-bottom-nav__item {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 2px;
    text-decoration: none;
    color: var(--color-text-muted);
    font-size: 0.7rem;
    font-weight: 500;
    min-width: 0;
    padding: 6px 4px;
  }

  .mobile-bottom-nav__item--active {
    color: var(--color-accent);
  }

  .mobile-bottom-nav__icon {
    font-size: 1.15rem;
    line-height: 1;
  }

  .mobile-bottom-nav__item--add .mobile-bottom-nav__icon--add {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 36px;
    height: 28px;
    border-radius: var(--radius-md);
    background: var(--color-accent);
    color: var(--color-accent-text);
    font-size: 1.35rem;
    font-weight: 600;
  }

  .mobile-bottom-nav__item--add.mobile-bottom-nav__item--active .mobile-bottom-nav__icon--add {
    background: var(--color-accent-hover);
  }

  .mobile-bottom-nav__label {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 100%;
  }
}
</style>
