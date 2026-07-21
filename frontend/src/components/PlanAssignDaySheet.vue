<template>
  <Teleport to="body">
    <!-- Mobile: bottom sheet -->
    <div
      v-if="open && isMobileSheet"
      class="app-modal-overlay plan-assign-day plan-assign-day--sheet"
      role="dialog"
      aria-modal="true"
      aria-labelledby="plan-assign-day-title"
      @click.self="emit('close')"
    >
      <div class="plan-assign-day__panel">
        <header class="plan-assign-day__header">
          <div class="plan-assign-day__header-text">
            <h2 id="plan-assign-day-title" class="plan-assign-day__title">{{ title }}</h2>
            <p v-if="recipeTitle" class="plan-assign-day__recipe">{{ recipeTitle }}</p>
            <p class="plan-assign-day__hint meta-text">Wähle den Zieltag aus</p>
          </div>
          <button type="button" class="plan-assign-day__close" aria-label="Schließen" @click="emit('close')">
            ×
          </button>
        </header>

        <PlanAssignDayOptions
          class="plan-assign-day__days plan-assign-day__days--sheet"
          :days="days"
          variant="sheet"
          @select="emit('select', $event)"
        />

        <footer class="plan-assign-day__footer">
          <button type="button" class="btn btn--secondary plan-assign-day__cancel" @click="emit('close')">
            Abbrechen
          </button>
        </footer>
      </div>
    </div>

    <!-- Desktop: compact anchored popover -->
    <template v-else-if="open">
      <div
        class="plan-assign-day__backdrop"
        aria-hidden="true"
        @click="emit('close')"
      />
      <div
        ref="popoverRef"
        class="plan-assign-day__popover"
        role="dialog"
        aria-modal="true"
        aria-labelledby="plan-assign-day-popover-title"
        tabindex="-1"
        :style="popoverStyle"
        @keydown.escape.prevent="emit('close')"
      >
        <span
          class="plan-assign-day__arrow"
          :class="`plan-assign-day__arrow--${popoverPlacement}`"
          :style="arrowStyle"
          aria-hidden="true"
        />
        <div class="plan-assign-day__popover-inner">
          <span id="plan-assign-day-popover-title" class="visually-hidden">
            {{ recipeTitle || title }}
          </span>
          <PlanAssignDayOptions
            class="plan-assign-day__days plan-assign-day__days--popover"
            :days="days"
            variant="popover"
            @select="emit('select', $event)"
          />
        </div>
      </div>
    </template>
  </Teleport>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import PlanAssignDayOptions from './PlanAssignDayOptions.vue'
import { usePlanAssignLayout } from '../composables/usePlanAssignLayout'
import { useBodyModalLock } from '../composables/useBodyModalLock'
import type { PlanAssignAnchor } from '../utils/planAssignAnchor'
import { computeAnchoredPopoverPlacement } from '../utils/planAssignAnchor'
import type { PlanAssignDayOption } from '../utils/planAssignDays'

const props = defineProps<{
  open: boolean
  title: string
  recipeTitle?: string | null
  days: PlanAssignDayOption[]
  anchor?: PlanAssignAnchor | null
}>()

const emit = defineEmits<{
  close: []
  select: [date: string]
}>()

const { isMobileSheet } = usePlanAssignLayout()

const mobileSheetOpen = computed(() => props.open && isMobileSheet.value)
useBodyModalLock(mobileSheetOpen)

const popoverRef = ref<HTMLElement | null>(null)
const popoverStyle = ref<Record<string, string>>({ visibility: 'hidden' })
const arrowStyle = ref<Record<string, string>>({})
const popoverPlacement = ref<'top' | 'bottom'>('bottom')

function updatePopoverPosition() {
  if (!props.open || isMobileSheet.value || !popoverRef.value) return

  const anchor = props.anchor ?? {
    left: window.innerWidth / 2 - 40,
    top: window.innerHeight / 2 - 20,
    width: 80,
    height: 40,
  }

  const rect = popoverRef.value.getBoundingClientRect()
  const placement = computeAnchoredPopoverPlacement(anchor, rect.width, rect.height)

  popoverPlacement.value = placement.placement
  popoverStyle.value = {
    top: `${placement.top}px`,
    left: `${placement.left}px`,
    visibility: 'visible',
  }
  arrowStyle.value = {
    left: `${placement.arrowLeft}px`,
  }
}

watch(
  () => [props.open, props.anchor, props.days.length, isMobileSheet.value] as const,
  async ([open]) => {
    if (!open || isMobileSheet.value) return
    popoverStyle.value = { visibility: 'hidden' }
    await nextTick()
    updatePopoverPosition()
    popoverRef.value?.focus({ preventScroll: true })
  },
)

function onViewportChange() {
  if (props.open && !isMobileSheet.value) updatePopoverPosition()
}

onMounted(() => {
  if (typeof window === 'undefined') return
  window.addEventListener('resize', onViewportChange)
  window.addEventListener('scroll', onViewportChange, true)
})

onBeforeUnmount(() => {
  if (typeof window === 'undefined') return
  window.removeEventListener('resize', onViewportChange)
  window.removeEventListener('scroll', onViewportChange, true)
})
</script>

<style scoped>
/* —— Mobile sheet —— */
.plan-assign-day--sheet {
  align-items: flex-end;
  padding: 0;
}

.plan-assign-day__panel {
  width: min(100%, 36rem);
  max-height: min(88vh, 32rem);
  display: flex;
  flex-direction: column;
  background: var(--color-surface);
  border-radius: var(--radius-lg, 12px) var(--radius-lg, 12px) 0 0;
  box-shadow: var(--shadow-soft);
  border: 1px solid var(--color-border);
  border-bottom: none;
}

.plan-assign-day__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--spacing-md);
  padding: var(--spacing-lg) var(--spacing-lg) var(--spacing-sm);
}

.plan-assign-day__title {
  margin: 0;
  font-size: 1.125rem;
  font-weight: 600;
}

.plan-assign-day__recipe {
  margin: 0.25rem 0 0;
  font-size: 0.95rem;
  font-weight: 500;
  line-height: 1.35;
}

.plan-assign-day__hint {
  margin: 0.35rem 0 0;
  font-size: 0.82rem;
}

.plan-assign-day__close {
  border: none;
  background: transparent;
  font-size: 1.5rem;
  line-height: 1;
  color: var(--color-text-muted);
  cursor: pointer;
  padding: 0.125rem 0.375rem;
  flex-shrink: 0;
}

.plan-assign-day__days--sheet {
  padding: var(--spacing-md) var(--spacing-lg);
  overflow-x: auto;
  overflow-y: auto;
  flex: 1;
  min-height: 0;
}

.plan-assign-day__footer {
  display: flex;
  justify-content: flex-end;
  padding: var(--spacing-md) var(--spacing-lg) var(--spacing-lg);
  border-top: 1px solid var(--color-border);
}

/* —— Desktop popover —— */
.plan-assign-day__backdrop {
  position: fixed;
  inset: 0;
  z-index: calc(var(--z-modal) - 1);
  background: transparent;
}

.plan-assign-day__popover {
  position: fixed;
  z-index: var(--z-modal);
  width: max-content;
  max-width: calc(100vw - 1rem);
  filter: drop-shadow(0 2px 10px color-mix(in srgb, var(--color-text) 12%, transparent));
}

.plan-assign-day__popover-inner {
  position: relative;
  padding: 0.28rem 0.32rem;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm, 6px);
}

.plan-assign-day__arrow {
  position: absolute;
  width: 0.55rem;
  height: 0.55rem;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  transform: rotate(45deg);
  pointer-events: none;
}

.plan-assign-day__arrow--bottom {
  top: -0.3rem;
  border-bottom: none;
  border-right: none;
}

.plan-assign-day__arrow--top {
  bottom: -0.3rem;
  border-top: none;
  border-left: none;
}

.plan-assign-day__days--popover {
  padding: 0;
}

.visually-hidden {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}
</style>
