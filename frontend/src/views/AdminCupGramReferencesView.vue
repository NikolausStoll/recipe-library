<template>
  <div class="admin-cup-refs">
    <header class="admin-cup-refs__header">
      <router-link to="/more" class="admin-cup-refs__back link-secondary">← Mehr</router-link>
      <h1 class="admin-cup-refs__title">Cup → Gramm (URL-Import)</h1>
      <p class="admin-cup-refs__subtitle meta-text">
        Referenzwerte für die KI-Normalisierung bei URL-Rezepten, wenn im Rohrezept „cup“ vorkommt.
        Lockere Zutaten (z. B. Spinat) wiegen deutlich weniger als 100 g pro Cup.
      </p>
    </header>

    <p v-if="error" class="admin-cup-refs__error" role="alert">{{ error }}</p>
    <p v-else-if="loading" class="admin-cup-refs__loading meta-text">Wird geladen…</p>

    <template v-else>
      <form class="admin-cup-refs__form surface-card" @submit.prevent="onAdd">
        <h2 class="admin-cup-refs__form-title">Eintrag hinzufügen</h2>
        <div class="admin-cup-refs__form-grid">
          <div class="form-field">
            <label for="cup-ref-cups">Cup(s)</label>
            <input
              id="cup-ref-cups"
              v-model.number="draft.cups"
              type="number"
              min="0.01"
              step="any"
              required
              class="form-input"
            />
          </div>
          <div class="form-field">
            <label for="cup-ref-grams">Gramm</label>
            <input
              id="cup-ref-grams"
              v-model.number="draft.grams"
              type="number"
              min="1"
              step="1"
              required
              class="form-input"
            />
          </div>
          <div class="form-field admin-cup-refs__field-ingredient">
            <label for="cup-ref-ingredient">Zutat / Kontext</label>
            <input
              id="cup-ref-ingredient"
              v-model="draft.ingredient"
              type="text"
              required
              class="form-input"
            />
          </div>
          <div class="form-field admin-cup-refs__field-note">
            <label for="cup-ref-note">Notiz (optional)</label>
            <input id="cup-ref-note" v-model="draft.note" type="text" class="form-input" />
          </div>
        </div>
        <button type="submit" class="btn btn--primary" :disabled="saving">
          {{ saving ? 'Speichern…' : 'Hinzufügen' }}
        </button>
      </form>

      <section v-if="references.length" class="admin-cup-refs__list surface-card">
        <h2 class="admin-cup-refs__list-title">Referenzen</h2>
        <ul class="admin-cup-refs__items">
          <li v-for="ref in references" :key="ref.id" class="admin-cup-refs__item">
            <template v-if="editingId === ref.id">
              <div class="admin-cup-refs__edit-grid">
                <input v-model.number="editDraft.cups" type="number" min="0.01" step="any" class="form-input" aria-label="Cup(s)" />
                <span class="admin-cup-refs__arrow" aria-hidden="true">→</span>
                <input v-model.number="editDraft.grams" type="number" min="1" step="1" class="form-input" aria-label="Gramm" />
                <input v-model="editDraft.ingredient" type="text" class="form-input" aria-label="Zutat" />
                <input v-model="editDraft.note" type="text" class="form-input" aria-label="Notiz" />
              </div>
              <div class="admin-cup-refs__item-actions">
                <button type="button" class="btn btn--primary btn--small" :disabled="saving" @click="saveEdit(ref.id)">
                  Speichern
                </button>
                <button type="button" class="btn btn--secondary btn--small" @click="cancelEdit">Abbrechen</button>
              </div>
            </template>
            <template v-else>
              <span class="admin-cup-refs__line">
                <strong>{{ formatCups(ref.cups) }}</strong>
                <span class="admin-cup-refs__ingredient">{{ ref.ingredient }}</span>
                <span aria-hidden="true">→</span>
                <strong>{{ ref.grams }} g</strong>
                <span v-if="ref.note" class="admin-cup-refs__note meta-text">({{ ref.note }})</span>
              </span>
              <div class="admin-cup-refs__item-actions">
                <button type="button" class="btn btn--ghost btn--small" @click="startEdit(ref)">Bearbeiten</button>
                <button type="button" class="btn btn--ghost btn--small admin-cup-refs__delete" @click="onDelete(ref.id)">
                  Löschen
                </button>
              </div>
            </template>
          </li>
        </ul>
      </section>
      <p v-else class="admin-cup-refs__empty meta-text">Noch keine Referenzen. Beim ersten URL-Import mit „cup“ werden nur die allgemeinen Good/Bad-Beispiele genutzt.</p>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import {
  listCupGramReferences,
  createCupGramReference,
  updateCupGramReference,
  deleteCupGramReference,
  type CupGramReference,
} from '../api/admin'

const references = ref<CupGramReference[]>([])
const loading = ref(true)
const saving = ref(false)
const error = ref('')
const editingId = ref<number | null>(null)

const draft = ref({ cups: 1, grams: 30, ingredient: '', note: '' })
const editDraft = ref({ cups: 1, grams: 30, ingredient: '', note: '' })

function formatCups(cups: number): string {
  if (cups === 1) return '1 cup'
  const whole = Math.abs(cups - Math.round(cups)) < 1e-6
  return whole ? `${Math.round(cups)} cups` : `${cups} cups`
}

async function load() {
  loading.value = true
  error.value = ''
  try {
    const data = await listCupGramReferences()
    references.value = data.references
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Laden fehlgeschlagen'
  } finally {
    loading.value = false
  }
}

async function onAdd() {
  saving.value = true
  error.value = ''
  try {
    await createCupGramReference({
      ingredient: draft.value.ingredient.trim(),
      cups: draft.value.cups,
      grams: draft.value.grams,
      note: draft.value.note.trim() || null,
    })
    draft.value = { cups: 1, grams: 30, ingredient: '', note: '' }
    await load()
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Speichern fehlgeschlagen'
  } finally {
    saving.value = false
  }
}

function startEdit(ref: CupGramReference) {
  editingId.value = ref.id
  editDraft.value = {
    cups: ref.cups,
    grams: ref.grams,
    ingredient: ref.ingredient,
    note: ref.note ?? '',
  }
}

function cancelEdit() {
  editingId.value = null
}

async function saveEdit(id: number) {
  saving.value = true
  error.value = ''
  try {
    await updateCupGramReference(id, {
      cups: editDraft.value.cups,
      grams: editDraft.value.grams,
      ingredient: editDraft.value.ingredient.trim(),
      note: editDraft.value.note.trim() || null,
    })
    editingId.value = null
    await load()
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Speichern fehlgeschlagen'
  } finally {
    saving.value = false
  }
}

async function onDelete(id: number) {
  if (!confirm('Diesen Eintrag löschen?')) return
  error.value = ''
  try {
    await deleteCupGramReference(id)
    if (editingId.value === id) editingId.value = null
    await load()
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Löschen fehlgeschlagen'
  }
}

onMounted(() => {
  void load()
})
</script>

<style scoped>
.admin-cup-refs {
  max-width: 40rem;
  margin: 0 auto;
  padding-bottom: var(--spacing-xl);
}

.admin-cup-refs__header {
  margin-bottom: var(--spacing-lg);
}

.admin-cup-refs__back {
  display: inline-block;
  margin-bottom: var(--spacing-sm);
  font-size: 0.875rem;
}

.admin-cup-refs__title {
  margin: 0 0 var(--spacing-xs);
  font-size: 1.35rem;
  font-weight: 650;
}

.admin-cup-refs__subtitle {
  margin: 0;
  line-height: 1.45;
}

.admin-cup-refs__error {
  color: var(--color-error);
}

.admin-cup-refs__form {
  padding: var(--spacing-md);
  margin-bottom: var(--spacing-lg);
}

.admin-cup-refs__form-title,
.admin-cup-refs__list-title {
  margin: 0 0 var(--spacing-md);
  font-size: 1rem;
  font-weight: 620;
}

.admin-cup-refs__form-grid {
  display: grid;
  grid-template-columns: 5rem 5rem 1fr;
  gap: var(--spacing-sm);
  margin-bottom: var(--spacing-md);
}

.admin-cup-refs__field-ingredient {
  grid-column: 1 / -1;
}

.admin-cup-refs__field-note {
  grid-column: 1 / -1;
}

.admin-cup-refs__list {
  padding: var(--spacing-md);
}

.admin-cup-refs__items {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
}

.admin-cup-refs__item {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xs);
  padding-bottom: var(--spacing-md);
  border-bottom: 1px solid var(--color-border);
}

.admin-cup-refs__item:last-child {
  padding-bottom: 0;
  border-bottom: none;
}

.admin-cup-refs__line {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 0.35rem 0.5rem;
  font-size: 0.95rem;
}

.admin-cup-refs__ingredient {
  color: var(--color-text);
}

.admin-cup-refs__arrow {
  color: var(--color-text-muted);
}

.admin-cup-refs__edit-grid {
  display: grid;
  grid-template-columns: 4.5rem auto 4.5rem 1fr;
  gap: var(--spacing-xs);
  align-items: center;
}

.admin-cup-refs__item-actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--spacing-xs);
}

.admin-cup-refs__delete {
  color: var(--color-danger);
}

.admin-cup-refs__empty {
  margin: 0;
}
</style>
