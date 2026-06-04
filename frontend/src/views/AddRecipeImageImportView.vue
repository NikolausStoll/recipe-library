<template>
  <RecipeImageImport
    :initial-mode="initialMode"
    @done="onImportDone"
    @close="goBack"
  />
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import RecipeImageImport from '../components/RecipeImportOverlayUnified.vue'
import { postGenerateRecipeTags } from '../api/recipes'
import type { Recipe } from '../api/recipes'

const route = useRoute()
const router = useRouter()

const initialMode = computed((): 'camera' | 'upload' | undefined => {
  const mode = route.query.mode
  if (mode === 'camera' || mode === 'upload') return mode
  return undefined
})

function goBack() {
  router.push({ name: 'add' })
}

function onImportDone(recipe: Recipe) {
  void postGenerateRecipeTags(recipe.id).catch(() => {})
  router.push({
    name: 'recipe-edit',
    params: { id: String(recipe.id) },
    query: { from: `/recipes/${recipe.id}` },
  })
}
</script>
