<template>
  <div class="tag-input">
    <div v-if="modelValue.length" class="chip-row tag-input__chips">
      <span
        v-for="t in modelValue"
        :key="t"
        class="chip chip--tag chip--tag-removable"
        role="button"
        tabindex="0"
        @click="remove(t)"
        @keydown.enter.prevent="remove(t)"
      >
        {{ formatLabel(t) }}
        <span aria-hidden="true">×</span>
      </span>
    </div>
    <div class="tag-input__picker">
      <input
        v-model="filter"
        type="search"
        class="field-input tag-input__filter"
        :placeholder="placeholder"
        :aria-label="ariaLabel"
      />
      <div class="chip-row tag-input__suggestions">
        <button
          v-for="opt in filteredOptions"
          :key="opt"
          type="button"
          class="chip"
          :class="{ 'chip--selected': modelValue.includes(opt) }"
          @click="toggle(opt)"
        >
          {{ formatLabel(opt) }}
        </button>
      </div>
      <p v-if="!filteredOptions.length && filter.trim()" class="meta-text tag-input__empty">Keine passenden Tags</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'

const props = withDefaults(
  defineProps<{
    modelValue: string[]
    options: string[]
    formatLabel?: (tag: string) => string
    placeholder?: string
    ariaLabel?: string
  }>(),
  {
    placeholder: 'Tags suchen…',
    ariaLabel: 'Tags zum Hinzufügen suchen',
  },
)

const emit = defineEmits<{
  'update:modelValue': [value: string[]]
}>()

const filter = ref('')

const filteredOptions = computed(() => {
  const q = filter.value.trim().toLowerCase()
  const opts = props.options.filter((o) => !props.modelValue.includes(o))
  if (!q) return opts.slice(0, 24)
  return opts.filter((o) => o.toLowerCase().includes(q) || formatLabel(o).toLowerCase().includes(q)).slice(0, 24)
})

function formatLabel(t: string) {
  return props.formatLabel ? props.formatLabel(t) : t.replace(/_/g, ' ')
}

function toggle(tag: string) {
  if (props.modelValue.includes(tag)) remove(tag)
  else emit('update:modelValue', [...props.modelValue, tag])
}

function remove(tag: string) {
  emit(
    'update:modelValue',
    props.modelValue.filter((t) => t !== tag)
  )
}
</script>

<style scoped>
.tag-input {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
}

.tag-input__filter {
  margin-bottom: var(--spacing-sm);
}

.tag-input__suggestions {
  max-height: 160px;
  overflow-y: auto;
}

.tag-input__empty {
  margin: var(--spacing-sm) 0 0;
}
</style>
