import { createRouter, createWebHistory } from 'vue-router'
import AppShell from '../layouts/AppShell.vue'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/',
      component: AppShell,
      children: [
        { path: '', redirect: '/recipes' },
        { path: 'dashboard', redirect: '/recipes' },
        {
          path: 'recipes/:id/edit',
          name: 'recipe-edit',
          component: () => import('../views/RecipeEditPage.vue'),
          meta: { title: 'Rezept bearbeiten', hideBottomNav: true },
        },
        {
          path: 'recipes/:id?',
          name: 'recipes',
          component: () => import('../views/RecipesView.vue'),
          meta: { title: 'Rezepte' },
        },
        {
          path: 'favorites/:id?',
          name: 'favorites',
          component: () => import('../views/RecipesView.vue'),
          props: { favoritesOnly: true },
          meta: { title: 'Favoriten' },
        },
        {
          path: 'plan',
          name: 'plan',
          component: () => import('../views/PlanView.vue'),
          meta: { title: 'Plan' },
        },
        {
          path: 'add',
          name: 'add',
          component: () => import('../views/AddRecipeView.vue'),
          meta: { title: 'Rezept hinzufügen' },
        },
        {
          path: 'add/image',
          name: 'add-image',
          component: () => import('../views/AddRecipeImageImportView.vue'),
          meta: { title: 'Rezept aus Bildern hinzufügen' },
        },
        {
          path: 'add/url',
          name: 'add-url',
          component: () => import('../views/AddRecipeUrlImportView.vue'),
          meta: { title: 'Rezept von Website importieren' },
        },
        {
          path: 'add/text',
          name: 'add-text',
          component: () => import('../views/AddRecipeTextImportView.vue'),
          meta: { title: 'Rezept aus Text importieren' },
        },
        {
          path: 'shopping',
          name: 'shopping',
          component: () => import('../views/ShoppingView.vue'),
          meta: { title: 'Einkauf' },
        },
        {
          path: 'sources/:id?',
          name: 'sources',
          component: () => import('../views/SourcesView.vue'),
          meta: { title: 'Quellen' },
        },
        {
          path: 'more',
          name: 'more',
          component: () => import('../views/MoreView.vue'),
          meta: { title: 'Mehr' },
        },
        {
          path: 'admin/extract-usage',
          name: 'admin-extract-usage',
          component: () => import('../views/AdminExtractUsageView.vue'),
          meta: { title: 'Admin · KI-Tokennutzung' },
        },
      ],
    },
  ],
})

router.afterEach((to) => {
  const title = to.meta.title as string
  if (title) document.title = `${title} – Rezeptbibliothek`
})

export default router
