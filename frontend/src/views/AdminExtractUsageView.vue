<template>
  <div class="admin-extract">
    <header class="admin-extract__header">
      <h1 class="admin-extract__title">AI token usage</h1>
      <p class="admin-extract__subtitle">
        OpenAI token usage per request. Estimated cost uses built-in per-model input/output rates (GPT-4.x, GPT-4o, GPT-5
        families); amounts are in US cents (fractional when below 1¢). Unknown models show no estimate.
      </p>
    </header>

    <p v-if="error" class="admin-extract__error">{{ error }}</p>
    <p v-else-if="loading" class="admin-extract__loading">Loading…</p>

    <template v-else>
      <section v-if="rows.length" class="admin-extract__summary">
        <p>
          <strong>{{ rows.length }}</strong> row(s) ·
          <strong>{{ formatCents(totals.knownCostCents) }}</strong> total estimated cost (rows with known model pricing)
        </p>
        <p class="admin-extract__summary-muted">
          Sum of prompt tokens: {{ totals.prompt }} · completion: {{ totals.completion }} · total: {{ totals.total }}
        </p>
      </section>

      <div v-if="rows.length" class="admin-extract__table-wrap">
        <table class="admin-extract__table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Recipe</th>
              <th class="num">Prompt</th>
              <th class="num">Completion</th>
              <th class="num">Total</th>
              <th class="num">Cost (¢)</th>
              <th>Model</th>
              <th>Usage kind</th>
              <th>Created</th>
              <th>Request</th>
              <th>Response</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="r in rows" :key="r.id">
              <td>{{ r.id }}</td>
              <td>
                <span v-if="r.recipe_title">{{ r.recipe_title }}</span>
                <span v-else-if="r.recipe_id != null" class="muted">#{{ r.recipe_id }} (deleted?)</span>
                <span v-else class="muted">—</span>
              </td>
              <td class="num">{{ r.prompt_tokens ?? '—' }}</td>
              <td class="num">{{ r.completion_tokens ?? '—' }}</td>
              <td class="num">{{ r.total_tokens ?? '—' }}</td>
              <td class="num">
                <span v-if="r.cost_cents != null">{{ formatCents(r.cost_cents) }}</span>
                <span v-else class="muted" title="Unknown model for pricing">—</span>
              </td>
              <td class="mono">{{ r.model ?? '—' }}</td>
              <td>{{ r.usage_kind ?? '—' }}</td>
              <td class="mono nowrap">{{ r.created_at ?? '—' }}</td>
              <td>
                <button
                  v-if="r.request_json"
                  type="button"
                  class="admin-extract__json-btn"
                  @click="openJsonModal('Request', r.request_json, r.id)"
                >
                  JSON
                </button>
                <span v-else class="muted">—</span>
              </td>
              <td>
                <button
                  v-if="r.response_json"
                  type="button"
                  class="admin-extract__json-btn"
                  @click="openJsonModal('Response', r.response_json, r.id)"
                >
                  JSON
                </button>
                <span v-else class="muted">—</span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <p v-else class="admin-extract__empty">No AI token usage rows yet.</p>
    </template>

    <Teleport to="body">
      <div
        v-if="jsonModal"
        class="app-modal-overlay admin-extract__json-overlay"
        @click.self="closeJsonModal"
      >
        <div
          class="admin-extract__json-panel"
          role="dialog"
          aria-modal="true"
          aria-labelledby="admin-extract-json-title"
        >
          <div class="admin-extract__json-header">
            <h2 id="admin-extract-json-title" class="admin-extract__json-title">{{ jsonModal.title }}</h2>
            <button type="button" class="admin-extract__json-close" aria-label="Close" @click="closeJsonModal">
              ×
            </button>
          </div>
          <div class="admin-extract__json-body">
            <pre class="admin-extract__json-pre">{{ jsonModal.content }}</pre>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { listAdminExtractUsage, type ExtractUsageAdminRow } from '../api/admin'
import { useBodyModalLock } from '../composables/useBodyModalLock'

const rows = ref<ExtractUsageAdminRow[]>([])
const loading = ref(true)
const error = ref('')
const jsonModal = ref<{ title: string; content: string } | null>(null)

useBodyModalLock(computed(() => jsonModal.value != null))

const totals = computed(() => {
  let prompt = 0
  let completion = 0
  let total = 0
  let knownCostCents = 0
  for (const r of rows.value) {
    prompt += r.prompt_tokens ?? 0
    completion += r.completion_tokens ?? 0
    total += r.total_tokens ?? 0
    if (r.cost_cents != null) knownCostCents += r.cost_cents
  }
  return { prompt, completion, total, knownCostCents }
})

function formatCents(c: number): string {
  if (!Number.isFinite(c)) return '—'
  const abs = Math.abs(c)
  if (abs > 0 && abs < 0.01) return `${c.toFixed(4)} ¢`
  if (abs < 1) return `${c.toFixed(3)} ¢`
  return `${c.toFixed(2)} ¢`
}

function prettyJson(raw: string): string {
  try {
    return JSON.stringify(JSON.parse(raw), null, 2)
  } catch {
    return raw
  }
}

function openJsonModal(kind: 'Request' | 'Response', raw: string, rowId: number) {
  jsonModal.value = {
    title: `${kind} JSON · row #${rowId}`,
    content: prettyJson(raw),
  }
}

function closeJsonModal() {
  jsonModal.value = null
}

function onEscapeKey(e: KeyboardEvent) {
  if (e.key === 'Escape' && jsonModal.value) closeJsonModal()
}

watch(jsonModal, (modal) => {
  if (modal) window.addEventListener('keydown', onEscapeKey)
  else window.removeEventListener('keydown', onEscapeKey)
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', onEscapeKey)
})

onMounted(async () => {
  loading.value = true
  error.value = ''
  try {
    const data = await listAdminExtractUsage()
    rows.value = data.rows
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Failed to load'
  } finally {
    loading.value = false
  }
})
</script>

<style scoped>
.admin-extract {
  max-width: 1600px;
  margin: 0 auto;
  padding: var(--spacing-lg);
}

.admin-extract__header {
  margin-bottom: var(--spacing-xl);
}

.admin-extract__title {
  margin: 0 0 var(--spacing-sm) 0;
  font-size: 1.75rem;
  font-weight: 700;
  color: var(--color-text);
}

.admin-extract__subtitle {
  margin: 0;
  font-size: 0.9rem;
  color: var(--color-text-muted);
  max-width: 52rem;
  line-height: 1.5;
}

.admin-extract__error {
  color: var(--color-error);
}

.admin-extract__loading {
  color: var(--color-text-muted);
}

.admin-extract__summary {
  margin-bottom: var(--spacing-md);
  padding: var(--spacing-md);
  background: var(--color-bg-elevated);
  border-radius: var(--radius-md);
  border: 1px solid var(--color-border);
}

.admin-extract__summary p {
  margin: 0 0 var(--spacing-xs) 0;
}

.admin-extract__summary-muted {
  font-size: 0.85rem;
  color: var(--color-text-muted);
}

.admin-extract__table-wrap {
  overflow-x: auto;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-bg-elevated);
}

.admin-extract__table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.85rem;
}

.admin-extract__table th,
.admin-extract__table td {
  padding: 0.5rem 0.65rem;
  text-align: left;
  border-bottom: 1px solid var(--color-border);
  vertical-align: top;
}

.admin-extract__table th {
  background: var(--color-bg-muted);
  font-weight: 600;
  white-space: nowrap;
}

.admin-extract__table .num {
  text-align: right;
  font-variant-numeric: tabular-nums;
}

.admin-extract__table .mono {
  font-family: ui-monospace, monospace;
  font-size: 0.8rem;
  word-break: break-all;
}

.admin-extract__table .nowrap {
  white-space: nowrap;
}

.muted {
  color: var(--color-text-muted);
}

.admin-extract__json-btn {
  padding: 0;
  border: none;
  background: none;
  cursor: pointer;
  color: var(--color-primary);
  font-weight: 600;
  font-size: inherit;
  font-family: inherit;
}

.admin-extract__json-btn:hover {
  text-decoration: underline;
}

.admin-extract__json-overlay {
  padding: 1.5rem;
}

.admin-extract__json-panel {
  display: flex;
  flex-direction: column;
  width: min(960px, 100%);
  max-height: min(85vh, 900px);
  background: var(--color-bg-elevated);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-lg, 0 12px 40px rgba(0, 0, 0, 0.2));
  overflow: hidden;
}

.admin-extract__json-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--spacing-md);
  padding: 0.85rem 1rem;
  border-bottom: 1px solid var(--color-border);
  background: var(--color-bg-muted);
}

.admin-extract__json-title {
  margin: 0;
  font-size: 1rem;
  font-weight: 600;
  color: var(--color-text);
}

.admin-extract__json-close {
  flex-shrink: 0;
  width: 2rem;
  height: 2rem;
  border: none;
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--color-text-muted);
  font-size: 1.5rem;
  line-height: 1;
  cursor: pointer;
}

.admin-extract__json-close:hover {
  background: var(--color-bg-elevated);
  color: var(--color-text);
}

.admin-extract__json-body {
  flex: 1;
  overflow: auto;
  padding: 1rem;
}

.admin-extract__json-pre {
  margin: 0;
  font-family: ui-monospace, monospace;
  font-size: 0.8rem;
  line-height: 1.45;
  white-space: pre-wrap;
  word-break: break-word;
  color: var(--color-text);
}

.admin-extract__empty {
  color: var(--color-text-muted);
}

@media (max-width: 640px) {
  .admin-extract__json-overlay {
    padding: 0;
    align-items: stretch;
  }

  .admin-extract__json-panel {
    width: 100%;
    max-height: 100%;
    border-radius: 0;
  }
}
</style>
