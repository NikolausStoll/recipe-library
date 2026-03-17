import { createRouter, createWebHistory } from 'vue-router'
import AppLayout from '../layouts/AppLayout.vue'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/',
      component: AppLayout,
      children: [
        { path: '', name: 'dashboard', component: () => import('../views/DashboardView.vue'), meta: { title: 'Dashboard' } },
        { path: 'recipes', name: 'recipes', component: () => import('../views/RecipesView.vue'), meta: { title: 'Recipes' } },
        { path: 'sources', name: 'sources', component: () => import('../views/SourcesView.vue'), meta: { title: 'Buchquellen' } },
        { path: 'import', name: 'import', component: () => import('../views/ImportView.vue'), meta: { title: 'Import' } },
        { path: 'shopping', name: 'shopping', component: () => import('../views/ShoppingView.vue'), meta: { title: 'Shopping' } },
      ],
    },
  ],
})

router.afterEach((to) => {
  const title = to.meta.title as string
  if (title) document.title = `${title} – Recipe Library`
})

export default router
