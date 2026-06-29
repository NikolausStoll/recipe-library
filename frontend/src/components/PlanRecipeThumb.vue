<template>
  <div class="plan-recipe-thumb" :class="{ 'plan-recipe-thumb--empty': !imageUrl }">
    <img v-if="imageUrl" :src="imageUrl" :alt="alt" loading="lazy" class="plan-recipe-thumb__img" />
    <svg v-else class="plan-recipe-thumb__placeholder" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M12 2L2 7L12 12L22 7L12 2Z"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
      <path
        d="M2 17L12 22L22 17"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
      <path
        d="M2 12L12 17L22 12"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
    </svg>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  imageUrl?: string | null
  alt?: string
}>()
</script>

<style scoped>
.plan-recipe-thumb {
  width: 2.5rem;
  height: 2.5rem;
  flex-shrink: 0;
  border-radius: var(--radius-sm, 6px);
  overflow: hidden;
  background: var(--color-surface-subtle);
  border: 1px solid var(--color-border);
}

.plan-recipe-thumb__img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.plan-recipe-thumb__placeholder {
  width: 1.1rem;
  height: 1.1rem;
  margin: auto;
  display: block;
  color: var(--color-text-muted);
  opacity: 0.45;
}

.plan-recipe-thumb--empty {
  display: flex;
  align-items: center;
  justify-content: center;
}
</style>
