<template>
  <div class="app-layout">
    <header class="app-header">
      <div class="app-header__container">
        <router-link to="/" class="app-brand">
          <svg class="app-brand__icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 2L2 7L12 12L22 7L12 2Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            <path d="M2 17L12 22L22 17" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            <path d="M2 12L12 17L22 12" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
          <span class="app-brand__text">Recipe Library</span>
        </router-link>
        <nav class="app-nav">
          <router-link
            to="/"
            class="nav-link"
            :class="{ 'nav-link--active': route.name === 'dashboard' }"
          >
            <svg class="nav-link__icon" viewBox="0 0 24 24" fill="none">
              <path d="M3 9L12 2L21 9V20C21 20.5304 20.7893 21.0391 20.4142 21.4142C20.0391 21.7893 19.5304 22 19 22H5C4.46957 22 3.96086 21.7893 3.58579 21.4142C3.21071 21.0391 3 20.5304 3 20V9Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
            <span>Dashboard</span>
          </router-link>
          <router-link
            to="/recipes"
            class="nav-link"
            :class="{ 'nav-link--active': route.name === 'recipes' }"
          >
            <svg class="nav-link__icon" viewBox="0 0 24 24" fill="none">
              <path d="M12 2L2 7L12 12L22 7L12 2Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              <path d="M2 17L12 22L22 17" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              <path d="M2 12L12 17L22 12" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
            <span>Recipes</span>
          </router-link>
          <router-link
            to="/sources"
            class="nav-link"
            :class="{ 'nav-link--active': route.name === 'sources' }"
          >
            <svg class="nav-link__icon" viewBox="0 0 24 24" fill="none">
              <path d="M4 19.5C4 18.837 4.26339 18.2011 4.73223 17.7322C5.20107 17.2634 5.83696 17 6.5 17H20" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              <path d="M6.5 2H20V22H6.5C5.83696 22 5.20107 21.7366 4.73223 21.2678C4.26339 20.7989 4 20.163 4 19.5V4.5C4 3.83696 4.26339 3.20107 4.73223 2.73223C5.20107 2.26339 5.83696 2 6.5 2Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
            <span>Sources</span>
          </router-link>
          <router-link
            to="/shopping"
            class="nav-link"
            :class="{ 'nav-link--active': route.name === 'shopping' }"
          >
            <svg class="nav-link__icon" viewBox="0 0 24 24" fill="none">
              <path d="M9 2L7 8H21L19 2H9Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              <path d="M7.5 8L6 18H18L16.5 8" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              <path d="M9 22C9.55228 22 10 21.5523 10 21C10 20.4477 9.55228 20 9 20C8.44772 20 8 20.4477 8 21C8 21.5523 8.44772 22 9 22Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              <path d="M15 22C15.5523 22 16 21.5523 16 21C16 20.4477 15.5523 20 15 20C14.4477 20 14 20.4477 14 21C14 21.5523 14.4477 22 15 22Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
            <span>Shopping</span>
          </router-link>
        </nav>
      </div>
    </header>
    <main class="app-content">
      <router-view />
    </main>
  </div>
</template>

<script setup lang="ts">
import { useRoute } from 'vue-router'

const route = useRoute()
</script>

<style scoped>
.app-layout {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}

.app-header {
  background: var(--color-header-bg);
  border-bottom: 1px solid var(--color-header-border);
  box-shadow: var(--shadow-sm);
  position: sticky;
  top: 0;
  z-index: 100;
  flex-shrink: 0;
}

.app-header__container {
  max-width: 1400px;
  margin: 0 auto;
  padding: var(--spacing-md) var(--spacing-lg);
  display: flex;
  align-items: center;
  gap: var(--spacing-2xl);
}

.app-brand {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  font-weight: 700;
  font-size: 1.25rem;
  color: var(--color-header-fg);
  text-decoration: none;
  transition: color var(--transition-fast);
}

.app-brand:hover {
  color: var(--color-primary);
}

.app-brand__icon {
  width: 28px;
  height: 28px;
  color: var(--color-primary);
}

.app-brand__text {
  background: linear-gradient(135deg, var(--color-primary), var(--color-secondary));
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.app-nav {
  display: flex;
  gap: var(--spacing-xs);
  flex: 1;
}

.nav-link {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  padding: var(--spacing-sm) var(--spacing-md);
  color: var(--color-text-muted);
  text-decoration: none;
  border-radius: var(--radius-md);
  font-weight: 500;
  font-size: 0.95rem;
  transition: all var(--transition-fast);
  position: relative;
}

.nav-link__icon {
  width: 20px;
  height: 20px;
  stroke-width: 2;
}

.nav-link:hover {
  color: var(--color-primary);
  background: var(--color-header-hover);
}

.nav-link--active {
  color: var(--color-primary);
  font-weight: 600;
}

.nav-link--active::after {
  content: '';
  position: absolute;
  bottom: -1rem;
  left: 50%;
  transform: translateX(-50%);
  width: 40%;
  height: 3px;
  background: var(--color-primary);
  border-radius: var(--radius-full) var(--radius-full) 0 0;
}

.app-content {
  flex: 1;
  background: var(--color-bg);
  padding: var(--spacing-xl);
}

@media (max-width: 768px) {
  .app-header__container {
    flex-direction: column;
    gap: var(--spacing-md);
    align-items: flex-start;
  }

  .app-nav {
    width: 100%;
    overflow-x: auto;
  }

  .nav-link span {
    white-space: nowrap;
  }

  .app-content {
    padding: var(--spacing-md);
  }
}
</style>
