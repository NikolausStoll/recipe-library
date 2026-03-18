<template>
  <div class="dashboard">
    <div class="dashboard-header">
      <div>
        <h1 class="dashboard-title">Welcome back!</h1>
        <p class="dashboard-subtitle">Here's what's cooking in your kitchen</p>
      </div>
    </div>

    <!-- Stats Cards -->
    <div class="stats-grid">
      <div class="stat-card">
        <div class="stat-card__icon stat-card__icon--primary">
          <svg viewBox="0 0 24 24" fill="none">
            <path d="M12 2L2 7L12 12L22 7L12 2Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            <path d="M2 17L12 22L22 17" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            <path d="M2 12L12 17L22 12" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </div>
        <div class="stat-card__content">
          <div class="stat-card__value">{{ stats.totalRecipes }}</div>
          <div class="stat-card__label">Total Recipes</div>
        </div>
      </div>

      <div class="stat-card">
        <div class="stat-card__icon stat-card__icon--warning">
          <svg viewBox="0 0 24 24" fill="none">
            <path d="M9 5H7C5.89543 5 5 5.89543 5 7V19C5 20.1046 5.89543 21 7 21H17C18.1046 21 19 20.1046 19 19V7C19 5.89543 18.1046 5 17 5H15" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </div>
        <div class="stat-card__content">
          <div class="stat-card__value">{{ stats.draftRecipes }}</div>
          <div class="stat-card__label">Drafts</div>
        </div>
      </div>

      <div class="stat-card">
        <div class="stat-card__icon stat-card__icon--secondary">
          <svg viewBox="0 0 24 24" fill="none">
            <path d="M4 19.5C4 18.837 4.26339 18.2011 4.73223 17.7322C5.20107 17.2634 5.83696 17 6.5 17H20" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            <path d="M6.5 2H20V22H6.5C5.83696 22 5.20107 21.7366 4.73223 21.2678C4.26339 20.7989 4 20.163 4 19.5V4.5C4 3.83696 4.26339 3.20107 4.73223 2.73223C5.20107 2.26339 5.83696 2 6.5 2Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </div>
        <div class="stat-card__content">
          <div class="stat-card__value">{{ stats.totalSources }}</div>
          <div class="stat-card__label">Sources</div>
        </div>
      </div>

      <div class="stat-card">
        <div class="stat-card__icon stat-card__icon--success">
          <svg viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            <path d="M12 6V12L16 14" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </div>
        <div class="stat-card__content">
          <div class="stat-card__value">{{ stats.recentlyAdded }}</div>
          <div class="stat-card__label">Added This Week</div>
        </div>
      </div>
    </div>

    <!-- Quick Actions -->
    <section class="dashboard-section">
      <h2 class="section-title">Quick Actions</h2>
      <div class="action-grid">
        <router-link to="/recipes" class="action-card">
          <div class="action-card__icon">
            <svg viewBox="0 0 24 24" fill="none">
              <path d="M12 5V19" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              <path d="M5 12H19" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </div>
          <div class="action-card__content">
            <h3 class="action-card__title">Add New Recipe</h3>
            <p class="action-card__description">Create a recipe manually or import from image</p>
          </div>
          <svg class="action-card__arrow" viewBox="0 0 24 24" fill="none">
            <path d="M5 12H19M19 12L12 5M19 12L12 19" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </router-link>

        <router-link to="/sources" class="action-card">
          <div class="action-card__icon">
            <svg viewBox="0 0 24 24" fill="none">
              <path d="M4 19.5C4 18.837 4.26339 18.2011 4.73223 17.7322C5.20107 17.2634 5.83696 17 6.5 17H20" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              <path d="M6.5 2H20V22H6.5C5.83696 22 5.20107 21.7366 4.73223 21.2678C4.26339 20.7989 4 20.163 4 19.5V4.5C4 3.83696 4.26339 3.20107 4.73223 2.73223C5.20107 2.26339 5.83696 2 6.5 2Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </div>
          <div class="action-card__content">
            <h3 class="action-card__title">Manage Sources</h3>
            <p class="action-card__description">Add cookbooks and other recipe sources</p>
          </div>
          <svg class="action-card__arrow" viewBox="0 0 24 24" fill="none">
            <path d="M5 12H19M19 12L12 5M19 12L12 19" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </router-link>

        <router-link to="/shopping" class="action-card">
          <div class="action-card__icon">
            <svg viewBox="0 0 24 24" fill="none">
              <path d="M9 2L7 8H21L19 2H9Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              <path d="M7.5 8L6 18H18L16.5 8" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </div>
          <div class="action-card__content">
            <h3 class="action-card__title">Shopping List</h3>
            <p class="action-card__description">Plan your shopping from recipes</p>
          </div>
          <svg class="action-card__arrow" viewBox="0 0 24 24" fill="none">
            <path d="M5 12H19M19 12L12 5M19 12L12 19" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </router-link>
      </div>
    </section>

    <!-- Recent Recipes -->
    <section v-if="recentRecipes.length" class="dashboard-section">
      <div class="section-header">
        <h2 class="section-title">Recent Recipes</h2>
        <router-link to="/recipes" class="section-link">View all →</router-link>
      </div>
      <div class="recipe-grid">
        <router-link
          v-for="recipe in recentRecipes"
          :key="recipe.id"
          :to="`/recipes?edit=${recipe.id}`"
          class="recipe-mini-card"
        >
          <div class="recipe-mini-card__image">
            <img
              v-if="recipe.image_path"
              :src="recipe.image_path"
              :alt="recipe.title"
              loading="lazy"
            />
            <div v-else class="recipe-mini-card__placeholder">
              <svg viewBox="0 0 24 24" fill="none">
                <path d="M12 2L2 7L12 12L22 7L12 2Z" stroke="currentColor" stroke-width="2"/>
                <path d="M2 17L12 22L22 17" stroke="currentColor" stroke-width="2"/>
                <path d="M2 12L12 17L22 12" stroke="currentColor" stroke-width="2"/>
              </svg>
            </div>
            <span v-if="recipe.status === 'draft'" class="recipe-mini-card__badge">Draft</span>
          </div>
          <div class="recipe-mini-card__content">
            <h3 class="recipe-mini-card__title">{{ recipe.title }}</h3>
            <p v-if="recipe.servings || recipe.source_name" class="recipe-mini-card__meta">
              <span v-if="recipe.servings">{{ recipe.servings }} servings</span>
              <span v-if="recipe.servings && recipe.source_name"> · </span>
              <span v-if="recipe.source_name">{{ recipe.source_name }}</span>
            </p>
          </div>
        </router-link>
      </div>
    </section>

    <!-- Empty State -->
    <div v-if="!loading && stats.totalRecipes === 0" class="empty-state">
      <svg viewBox="0 0 24 24" fill="none">
        <path d="M12 2L2 7L12 12L22 7L12 2Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        <path d="M2 17L12 22L22 17" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        <path d="M2 12L12 17L22 12" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
      <h3>Start Your Recipe Collection</h3>
      <p>Add your first recipe to get started</p>
      <router-link to="/recipes" class="btn btn--primary">Add Recipe</router-link>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { listRecipes } from '../api/recipes'
import { listSources } from '../api/sources'
import type { RecipeListItem } from '../api/recipes'

const recipes = ref<RecipeListItem[]>([])
const sourcesCount = ref(0)
const loading = ref(true)

const stats = computed(() => {
  const now = new Date()
  const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)

  return {
    totalRecipes: recipes.value.length,
    draftRecipes: recipes.value.filter(r => r.status === 'draft').length,
    totalSources: sourcesCount.value,
    recentlyAdded: recipes.value.filter(r => {
      if (!r.created_at) return false
      const created = new Date(r.created_at)
      return created >= oneWeekAgo
    }).length,
  }
})

const recentRecipes = computed(() => {
  return [...recipes.value]
    .sort((a, b) => (b.updated_at || '').localeCompare(a.updated_at || ''))
    .slice(0, 6)
})

async function loadData() {
  loading.value = true
  try {
    const [recipesData, sourcesData] = await Promise.all([
      listRecipes(),
      listSources().catch(() => [])
    ])
    recipes.value = recipesData
    sourcesCount.value = sourcesData.length
  } catch (e) {
    console.error('Failed to load dashboard data:', e)
  } finally {
    loading.value = false
  }
}

onMounted(loadData)
</script>

<style scoped>
.dashboard {
  max-width: 1400px;
  margin: 0 auto;
}

.dashboard-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  margin-bottom: var(--spacing-xl);
  gap: var(--spacing-lg);
}

.dashboard-title {
  font-size: 2rem;
  font-weight: 800;
  color: var(--color-text);
  margin: 0 0 var(--spacing-xs) 0;
  letter-spacing: -0.02em;
}

.dashboard-subtitle {
  font-size: 1rem;
  color: var(--color-text-muted);
  margin: 0;
}

/* Stats */
.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  gap: var(--spacing-lg);
  margin-bottom: var(--spacing-2xl);
}

.stat-card {
  display: flex;
  align-items: center;
  gap: var(--spacing-md);
  padding: var(--spacing-lg);
  background: var(--color-bg-elevated);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-card);
  transition: all var(--transition-base);
}

.stat-card:hover {
  box-shadow: var(--shadow-hover);
  transform: translateY(-2px);
}

.stat-card__icon {
  width: 56px;
  height: 56px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-lg);
  flex-shrink: 0;
}

.stat-card__icon svg {
  width: 28px;
  height: 28px;
  stroke-width: 2;
}

.stat-card__icon--primary {
  background: rgba(255, 107, 53, 0.1);
  color: var(--color-primary);
}

.stat-card__icon--secondary {
  background: rgba(0, 78, 137, 0.1);
  color: var(--color-secondary);
}

.stat-card__icon--warning {
  background: rgba(255, 182, 39, 0.1);
  color: var(--color-accent);
}

.stat-card__icon--success {
  background: rgba(56, 161, 105, 0.1);
  color: var(--color-success);
}

.stat-card__content {
  flex: 1;
}

.stat-card__value {
  font-size: 2rem;
  font-weight: 800;
  color: var(--color-text);
  line-height: 1;
  margin-bottom: var(--spacing-xs);
}

.stat-card__label {
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--color-text-muted);
}

/* Sections */
.dashboard-section {
  margin-bottom: var(--spacing-2xl);
}

.section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: var(--spacing-lg);
}

.section-title {
  font-size: 1.5rem;
  font-weight: 700;
  color: var(--color-text);
  margin: 0;
}

.section-link {
  font-size: 0.95rem;
  font-weight: 600;
  color: var(--color-primary);
  text-decoration: none;
  transition: color var(--transition-fast);
}

.section-link:hover {
  color: var(--color-primary-dark);
}

/* Actions */
.action-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: var(--spacing-lg);
}

.action-card {
  display: flex;
  align-items: center;
  gap: var(--spacing-md);
  padding: var(--spacing-lg);
  background: var(--color-bg-elevated);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  text-decoration: none;
  transition: all var(--transition-base);
  position: relative;
  overflow: hidden;
}

.action-card::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  width: 4px;
  height: 100%;
  background: var(--color-primary);
  transform: scaleY(0);
  transition: transform var(--transition-base);
}

.action-card:hover {
  border-color: var(--color-primary);
  box-shadow: var(--shadow-hover);
  transform: translateX(4px);
}

.action-card:hover::before {
  transform: scaleY(1);
}

.action-card__icon {
  width: 48px;
  height: 48px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-md);
  background: rgba(255, 107, 53, 0.1);
  color: var(--color-primary);
  flex-shrink: 0;
}

.action-card__icon svg {
  width: 24px;
  height: 24px;
  stroke-width: 2;
}

.action-card__content {
  flex: 1;
  min-width: 0;
}

.action-card__title {
  font-size: 1rem;
  font-weight: 600;
  color: var(--color-text);
  margin: 0 0 var(--spacing-xs) 0;
}

.action-card__description {
  font-size: 0.875rem;
  color: var(--color-text-muted);
  margin: 0;
  line-height: 1.4;
}

.action-card__arrow {
  width: 20px;
  height: 20px;
  color: var(--color-text-muted);
  flex-shrink: 0;
  transition: all var(--transition-fast);
}

.action-card:hover .action-card__arrow {
  color: var(--color-primary);
  transform: translateX(4px);
}

/* Recipe Grid */
.recipe-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: var(--spacing-lg);
}

.recipe-mini-card {
  background: var(--color-bg-elevated);
  border-radius: var(--radius-lg);
  overflow: hidden;
  box-shadow: var(--shadow-card);
  transition: all var(--transition-base);
  text-decoration: none;
}

.recipe-mini-card:hover {
  box-shadow: var(--shadow-hover);
  transform: translateY(-4px);
}

.recipe-mini-card__image {
  position: relative;
  width: 100%;
  height: 140px;
  overflow: hidden;
  background: var(--color-bg-muted);
}

.recipe-mini-card__image img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: transform var(--transition-slow);
}

.recipe-mini-card:hover .recipe-mini-card__image img {
  transform: scale(1.05);
}

.recipe-mini-card__placeholder {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--color-text-light);
}

.recipe-mini-card__placeholder svg {
  width: 48px;
  height: 48px;
  opacity: 0.3;
}

.recipe-mini-card__badge {
  position: absolute;
  top: var(--spacing-sm);
  left: var(--spacing-sm);
  padding: var(--spacing-xs) var(--spacing-sm);
  background: var(--color-draft-bg);
  color: var(--color-draft-fg);
  border-radius: var(--radius-sm);
  font-size: 0.7rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.recipe-mini-card__content {
  padding: var(--spacing-md);
}

.recipe-mini-card__title {
  font-size: 0.95rem;
  font-weight: 600;
  color: var(--color-text);
  margin: 0 0 var(--spacing-xs) 0;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  line-height: 1.4;
}

.recipe-mini-card__meta {
  font-size: 0.8rem;
  color: var(--color-text-muted);
  margin: 0;
}

/* Empty State */
.empty-state {
  text-align: center;
  padding: var(--spacing-2xl) var(--spacing-lg);
  background: var(--color-bg-elevated);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-card);
}

.empty-state svg {
  width: 80px;
  height: 80px;
  color: var(--color-text-light);
  margin-bottom: var(--spacing-lg);
}

.empty-state h3 {
  font-size: 1.5rem;
  font-weight: 700;
  color: var(--color-text);
  margin: 0 0 var(--spacing-sm) 0;
}

.empty-state p {
  font-size: 1rem;
  color: var(--color-text-muted);
  margin: 0 0 var(--spacing-lg) 0;
}

.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--spacing-sm);
  padding: var(--spacing-sm) var(--spacing-lg);
  border: none;
  border-radius: var(--radius-md);
  font: inherit;
  font-weight: 600;
  font-size: 0.95rem;
  cursor: pointer;
  text-decoration: none;
  transition: all var(--transition-fast);
}

.btn--primary {
  background: var(--color-btn-primary-bg);
  color: var(--color-btn-primary-fg);
  box-shadow: var(--shadow-sm);
}

.btn--primary:hover {
  background: var(--color-btn-primary-hover);
  box-shadow: var(--shadow-md);
  transform: translateY(-1px);
}

@media (max-width: 768px) {
  .dashboard-title {
    font-size: 1.75rem;
  }

  .stats-grid {
    grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
    gap: var(--spacing-md);
  }

  .stat-card {
    flex-direction: column;
    text-align: center;
  }

  .action-grid {
    grid-template-columns: 1fr;
  }

  .recipe-grid {
    grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
    gap: var(--spacing-md);
  }
}
</style>
