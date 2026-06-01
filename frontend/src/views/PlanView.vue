<template>
  <div class="page plan-view">
    <header class="page-header">
      <h1 class="page-header__title h2">Plan</h1>
      <p class="page-header__subtitle">Weekly meal planning and a cook-soon queue will live here.</p>
    </header>
    <div class="surface-card plan-view__card">
      <p class="body-text">This area is reserved for future meal planning. For now, browse recipes and mark favorites.</p>
      <router-link to="/recipes" class="btn btn--secondary plan-view__link">Browse recipes</router-link>
    </div>
  </div>
</template>

<style scoped>
.plan-view__card {
  padding: var(--spacing-xl);
  display: flex;
  flex-direction: column;
  gap: var(--spacing-lg);
  max-width: 36rem;
}

.plan-view__link {
  align-self: flex-start;
  text-decoration: none;
}
</style>
