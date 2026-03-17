<template>
  <div class="app-layout">
    <header class="app-header">
      <router-link to="/" class="app-brand">Recipe Library</router-link>
      <nav class="app-nav">
        <router-link to="/" class="nav-link" active-class="nav-link--active">Dashboard</router-link>
        <router-link to="/recipes" class="nav-link" active-class="nav-link--active">Recipes</router-link>
        <router-link to="/sources" class="nav-link" active-class="nav-link--active">Sources</router-link>
        <router-link to="/shopping" class="nav-link" active-class="nav-link--active">Shopping</router-link>
      </nav>
    </header>
    <main class="app-content">
      <router-view />
    </main>
  </div>
</template>

<script setup lang="ts">
</script>

<style scoped>
.app-layout {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}

.app-header {
  display: flex;
  align-items: center;
  gap: 1.5rem;
  padding: 0.75rem 1.5rem;
  background: var(--color-header-bg);
  color: var(--color-header-fg);
  flex-shrink: 0;
}

.app-brand {
  font-weight: 700;
  font-size: 1.25rem;
  color: inherit;
  text-decoration: none;
}

.app-brand:hover {
  text-decoration: underline;
}

.app-nav {
  display: flex;
  gap: 0.5rem;
}

.nav-link {
  padding: 0.5rem 0.75rem;
  color: inherit;
  text-decoration: none;
  border-radius: 4px;
  opacity: 0.85;
}

.nav-link:hover,
.nav-link--active {
  opacity: 1;
  background: var(--color-header-hover);
}

.app-content {
  flex: 1;
  padding: 1.5rem;
  background: var(--color-bg);
}
</style>
