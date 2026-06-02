<template>
  <nav class="top-nav" aria-label="Main">
    <router-link to="/recipes" class="top-nav__brand">
      <span class="top-nav__brand-mark" aria-hidden="true">📖</span>
      <span class="top-nav__brand-text">Rezeptbibliothek</span>
    </router-link>
    <div class="top-nav__links">
      <router-link
        v-for="item in items"
        :key="item.to"
        :to="item.to"
        class="top-nav__link"
        :class="{ 'top-nav__link--active': isActive(item) }"
      >
        {{ item.label }}
      </router-link>
    </div>
    <div class="top-nav__actions">
      <button type="button" class="icon-btn" :title="themeLabel" aria-label="Design umschalten" @click="toggle">
        <span aria-hidden="true">{{ resolved === 'dark' ? '☀' : '☾' }}</span>
      </button>
      <router-link to="/more" class="top-nav__link top-nav__more" :class="{ 'top-nav__link--active': route.path === '/more' }">
        Mehr
      </router-link>
    </div>
  </nav>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { useTheme } from '../../composables/useTheme'

const route = useRoute()
const { resolved, toggle } = useTheme()

const items = [
  { to: '/recipes', label: 'Rezepte', match: (p: string) => p.startsWith('/recipes') },
  { to: '/plan', label: 'Plan', match: (p: string) => p.startsWith('/plan') },
  { to: '/shopping', label: 'Einkauf', match: (p: string) => p.startsWith('/shopping') },
  { to: '/sources', label: 'Quellen', match: (p: string) => p.startsWith('/sources') },
]

const themeLabel = computed(() => (resolved.value === 'dark' ? 'Zum hellen Design wechseln' : 'Zum dunklen Design wechseln'))

function isActive(item: (typeof items)[0]) {
  return item.match(route.path)
}
</script>

<style scoped>
.top-nav {
  display: flex;
  align-items: center;
  gap: var(--spacing-lg);
  height: var(--top-nav-height);
  max-width: var(--page-max-width);
  margin: 0 auto;
  padding: 0 var(--content-padding-desktop);
}

.top-nav__brand {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  text-decoration: none;
  color: var(--color-text);
  font-weight: 650;
  font-size: 1.05rem;
  flex-shrink: 0;
}

.top-nav__brand-mark {
  font-size: 1.25rem;
}

.top-nav__links {
  display: flex;
  align-items: center;
  gap: 2px;
  flex: 1;
}

.top-nav__link {
  padding: 8px 14px;
  border-radius: var(--radius-sm);
  text-decoration: none;
  color: var(--color-text-muted);
  font-weight: 500;
  font-size: 0.95rem;
  transition: color var(--transition-fast), background var(--transition-fast);
}

.top-nav__link:hover {
  color: var(--color-text);
  background: var(--color-surface-subtle);
}

.top-nav__link--active {
  color: var(--color-accent);
  font-weight: 600;
}

.top-nav__actions {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  flex-shrink: 0;
}

@media (max-width: 1023px) {
  .top-nav {
    display: none;
  }
}
</style>
