<template>
  <RecipeUrlImport @done="onImportDone" @close="goBack" />
</template>

<script setup lang="ts">
import { useRouter } from 'vue-router'
import RecipeUrlImport from '../components/RecipeUrlImportOverlay.vue'
import type { Recipe } from '../api/recipes'

const router = useRouter()

function goBack() {
  router.push({ name: 'add' })
}

function onImportDone(recipe: Recipe) {
  router.push({
    name: 'recipe-edit',
    params: { id: String(recipe.id) },
    query: { from: `/recipes/${recipe.id}` },
  })
}
</script>
