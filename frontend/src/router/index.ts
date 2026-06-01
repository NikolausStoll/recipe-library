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
          path: 'recipes/:id?',
          name: 'recipes',
          component: () => import('../views/RecipesView.vue'),
          meta: { title: 'Recipes' },
        },
        {
          path: 'favorites/:id?',
          name: 'favorites',
          component: () => import('../views/RecipesView.vue'),
          props: { favoritesOnly: true },
          meta: { title: 'Favorites' },
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
          meta: { title: 'Add recipe' },
        },
        {
          path: 'shopping',
          name: 'shopping',
          component: () => import('../views/ShoppingView.vue'),
          meta: { title: 'Shopping' },
        },
        {
          path: 'sources/:id?',
          name: 'sources',
          component: () => import('../views/SourcesView.vue'),
          meta: { title: 'Sources' },
        },
        {
          path: 'more',
          name: 'more',
          component: () => import('../views/MoreView.vue'),
          meta: { title: 'More' },
        },
        {
          path: 'admin/extract-usage',
          name: 'admin-extract-usage',
          component: () => import('../views/AdminExtractUsageView.vue'),
          meta: { title: 'Admin · AI token usage' },
        },
      ],
    },
  ],
})

router.afterEach((to) => {
  const title = to.meta.title as string
  if (title) document.title = `${title} – Recipe Library`
})

export default router
