<template>
  <div class="app-shell" :class="{ 'app-shell--no-bottom-nav': hideBottomNav }">
    <header class="app-shell__header">
      <TopNavigation />
    </header>
    <main class="app-shell__main">
      <router-view />
    </main>
    <BottomNavigation v-if="!hideBottomNav" />

    <MergeSuggestionSheet
      :open="mergeSheetOpen"
      :suggestions="activeMergeSuggestions"
      @dismiss="dismissMergeReview"
      @merge="mergeItems"
      @skip="skipMergeSuggestion"
    />
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import MergeSuggestionSheet from '../components/MergeSuggestionSheet.vue'
import { useShoppingList } from '../composables/useShoppingList'
import TopNavigation from '../components/navigation/TopNavigation.vue'
import BottomNavigation from '../components/navigation/BottomNavigation.vue'

const route = useRoute()
const hideBottomNav = computed(() => route.meta.hideBottomNav === true)

const {
  mergeSheetOpen,
  activeMergeSuggestions,
  mergeItems,
  dismissMergeReview,
  skipMergeSuggestion,
} = useShoppingList()
</script>

<style scoped>
.app-shell {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}

.app-shell__header {
  position: sticky;
  top: 0;
  z-index: var(--z-header);
  background: var(--color-surface);
  border-bottom: 1px solid var(--color-border);
}

.app-shell__main {
  flex: 1 1 auto;
  width: 100%;
  max-width: var(--page-max-width);
  margin: 0 auto;
  padding: var(--content-padding-desktop);
  padding-bottom: var(--content-padding-desktop);
}

@media (max-width: 1023px) {
  .app-shell__main {
    padding: var(--content-padding-mobile);
    padding-bottom: calc(var(--bottom-nav-height) + env(safe-area-inset-bottom) + var(--content-padding-mobile));
  }

  .app-shell--no-bottom-nav .app-shell__main {
    padding-bottom: calc(env(safe-area-inset-bottom) + var(--content-padding-mobile));
  }
}

@media (min-width: 768px) and (max-width: 1023px) {
  .app-shell__main {
    padding: var(--content-padding-tablet);
    padding-bottom: calc(var(--bottom-nav-height) + env(safe-area-inset-bottom) + var(--content-padding-tablet));
  }
}
</style>
