<template>
  <div class="admin-extract">
    <header class="admin-extract__header">
      <h1 class="admin-extract__title">AI token usage</h1>
      <p class="admin-extract__subtitle">
        OpenAI token usage per request. Estimated cost uses GPT-4o mini ($0.15 / $0.60 per 1M) and GPT-4.1 mini ($0.40 /
        $1.60 per 1M); amounts are in US cents (fractional when below 1¢).
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
                <details v-if="r.request_json" class="admin-extract__json">
                  <summary>JSON</summary>
                  <pre>{{ prettyJson(r.request_json) }}</pre>
                </details>
                <span v-else class="muted">—</span>
              </td>
              <td>
                <details v-if="r.response_json" class="admin-extract__json">
                  <summary>JSON</summary>
                  <pre>{{ prettyJson(r.response_json) }}</pre>
                </details>
                <span v-else class="muted">—</span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <p v-else class="admin-extract__empty">No AI token usage rows yet.</p>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { listAdminExtractUsage, type ExtractUsageAdminRow } from '../api/admin'

const rows = ref<ExtractUsageAdminRow[]>([])
const loading = ref(true)
const error = ref('')

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

.admin-extract__json summary {
  cursor: pointer;
  color: var(--color-primary);
  font-weight: 600;
}

.admin-extract__json pre {
  margin: 0.5rem 0 0 0;
  max-height: 240px;
  overflow: auto;
  padding: 0.5rem;
  background: var(--color-bg-muted);
  border-radius: 4px;
  font-size: 0.75rem;
  line-height: 1.35;
}

.admin-extract__empty {
  color: var(--color-text-muted);
}
</style>
