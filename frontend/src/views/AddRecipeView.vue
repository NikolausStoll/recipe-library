<template>
  <div class="page add-recipe-view">
    <header class="page-header">
      <h1 class="page-header__title h2">Rezept hinzufügen</h1>
      <p class="page-header__subtitle">Importiere ein Rezept per Foto, Website, Text oder starte von Grund auf.</p>
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
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter, useRoute } from 'vue-router'

const router = useRouter()
const route = useRoute()

const isMobile = ref(typeof window !== 'undefined' && window.matchMedia('(max-width: 767px)').matches)

onMounted(() => {
  const mode = route.query.mode
  if (mode === 'image') router.replace({ name: 'add-image', query: { mode: 'upload' } })
  if (mode === 'url') router.replace({ name: 'add-url' })
  if (mode === 'text') router.replace({ name: 'add-text' })
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
    title: 'Foto aufnehmen',
    description: 'Rezept aus Kochbuch, Zeitschrift oder Notiz erfassen.',
    action: () => router.push({ name: 'add-image', query: { mode: 'camera' } }),
  },
  {
    id: 'upload',
    title: 'Bild hochladen',
    description: 'Fotos verwenden, die bereits aufgenommen wurden.',
    action: () => router.push({ name: 'add-image', query: { mode: 'upload' } }),
  },
  {
    id: 'url',
    title: 'Website einfügen',
    description: 'Von einer Rezept-URL importieren.',
    action: () => router.push({ name: 'add-url' }),
  },
  {
    id: 'text',
    title: 'Text einfügen',
    description: 'Rezepttext aus Notizen, Nachrichten oder Dokumenten verarbeiten.',
    action: () => router.push({ name: 'add-text' }),
  },
  {
    id: 'manual',
    title: 'Manuell eingeben',
    description: 'Mit einem leeren Rezept starten.',
    action: goManual,
  },
]

const orderedOptions = computed(() => {
  if (isMobile.value) return allOptions
  return [allOptions[1], allOptions[2], allOptions[3], allOptions[4], allOptions[0]]
})

function goManual() {
  router.push({ name: 'recipe-edit', params: { id: 'new' } })
}
</script>

<style scoped>
.add-recipe-view {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.add-recipe-view .page-header {
  width: 100%;
  max-width: 640px;
  text-align: center;
}

.add-recipe-options {
  display: grid;
  grid-template-columns: 1fr;
  gap: var(--spacing-md);
  width: 100%;
  max-width: 520px;
}

@media (min-width: 768px) {
  .add-recipe-options {
    max-width: 640px;
  }
}
</style>
