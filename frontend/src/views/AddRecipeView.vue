<template>
  <div class="page add-recipe-view">
    <header class="page-header">
      <h1 class="page-header__title h2">Add recipe</h1>
      <p class="page-header__subtitle">Capture a recipe from a photo, website, or start from scratch.</p>
    </header>

    <div class="add-recipe-options">
      <button
        v-for="opt in orderedOptions"
        :key="opt.id"
        type="button"
        class="add-option-card"
        @click="opt.action()"
      >
        <h2 class="add-option-card__title">{{ opt.title }}</h2>
        <p class="add-option-card__desc">{{ opt.description }}</p>
      </button>
    </div>

    <RecipeImportOverlay v-if="showImageImport" @done="onImportDone" @close="showImageImport = false" />
    <RecipeUrlImportOverlay v-if="showUrlImport" @done="onImportDone" @close="showUrlImport = false" />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import RecipeImportOverlay from '../components/RecipeImportOverlayUnified.vue'
import RecipeUrlImportOverlay from '../components/RecipeUrlImportOverlay.vue'
import type { Recipe } from '../api/recipes'

const router = useRouter()
const route = useRoute()

const showImageImport = ref(false)
const showUrlImport = ref(false)

const isMobile = ref(typeof window !== 'undefined' && window.matchMedia('(max-width: 767px)').matches)

onMounted(() => {
  const mode = route.query.mode
  if (mode === 'image') showImageImport.value = true
  if (mode === 'url') showUrlImport.value = true
  if (mode === 'manual') goManual()
})

type AddOption = {
  id: string
  title: string
  description: string
  action: () => void
}

const allOptions: AddOption[] = [
  {
    id: 'photo',
    title: 'Take photo',
    description: 'Capture a recipe from a cookbook, magazine, or note.',
    action: () => {
      showImageImport.value = true
    },
  },
  {
    id: 'upload',
    title: 'Upload image',
    description: 'Use photos you already took.',
    action: () => {
      showImageImport.value = true
    },
  },
  {
    id: 'url',
    title: 'Paste website',
    description: 'Import from a recipe URL.',
    action: () => {
      showUrlImport.value = true
    },
  },
  {
    id: 'manual',
    title: 'Manual entry',
    description: 'Start with an empty recipe.',
    action: goManual,
  },
]

const orderedOptions = computed(() => {
  if (isMobile.value) return allOptions
  return [allOptions[1], allOptions[2], allOptions[3], allOptions[0]]
})

function goManual() {
  router.push({ name: 'recipes', params: { id: 'new' } })
}

function onImportDone(recipe: Recipe) {
  showImageImport.value = false
  showUrlImport.value = false
  router.push({ name: 'recipes', params: { id: String(recipe.id) }, query: { review: '1' } })
}
</script>

<style scoped>
.add-recipe-options {
  display: grid;
  gap: var(--spacing-md);
  max-width: 520px;
}

@media (min-width: 768px) {
  .add-recipe-options {
    max-width: 640px;
    grid-template-columns: 1fr 1fr;
  }

  .add-recipe-options .add-option-card:first-child {
    grid-column: 1 / -1;
  }
}
</style>
