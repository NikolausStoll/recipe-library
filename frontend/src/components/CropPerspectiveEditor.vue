<template>
  <div
    ref="cropWrapRef"
    class="crop-perspective-editor"
    :class="[wrapClass, { 'crop-perspective-editor--active': active }]"
    @pointerdown="onWrapPointerDown($event, active)"
  >
    <img
      ref="cropImgRef"
      :src="src"
      :alt="alt"
      class="crop-perspective-editor__img"
      @load="onImageLoad"
    />
    <div class="crop-perspective-editor__overlay" :style="overlayStyle">
      <svg
        v-if="showLines"
        class="crop-perspective-editor__lines"
        :viewBox="`0 0 ${contentRect.width} ${contentRect.height}`"
        preserveAspectRatio="none"
      >
        <polyline
          :points="polylinePoints"
          fill="none"
          stroke="var(--color-primary, #2563eb)"
          stroke-width="2"
          stroke-dasharray="6 4"
        />
      </svg>
      <span
        v-for="(pt, idx) in points"
        :key="idx"
        class="crop-perspective-editor__point"
        :style="{ left: pt.x + 'px', top: pt.y + 'px' }"
        @pointerdown.stop="onPointPointerDown($event, idx)"
      >
        {{ idx + 1 }}
      </span>
    </div>
    <slot />
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount } from 'vue'
import type { CropPoint } from '../utils/cropOverlay'
import { useCropPerspectiveEditor } from '../composables/useCropPerspectiveEditor'

const points = defineModel<CropPoint[]>('points', { default: () => [] })

const props = withDefaults(
  defineProps<{
    src: string
    alt?: string
    wrapClass?: string | string[] | Record<string, boolean>
    /** When set, natural points are scaled from preview pixels to this size (e.g. original upload file). */
    sourceDimensions?: { width: number; height: number } | null
    /** When false, taps on the image do not add corner points. */
    active?: boolean
    maxPoints?: number
  }>(),
  {
    alt: 'Bildvorschau',
    active: true,
    maxPoints: 4,
    sourceDimensions: null,
  },
)

const emit = defineEmits<{
  'dragging-change': [boolean]
  load: []
}>()

const {
  cropWrapRef,
  cropImgRef,
  contentRect,
  overlayStyle,
  polylinePoints,
  showLines,
  onImageLoad,
  onWrapPointerDown,
  onPointPointerDown,
  getNaturalPoints,
  dispose,
} = useCropPerspectiveEditor({
  points,
  maxPoints: props.maxPoints,
  sourceDimensions: computed(() => props.sourceDimensions),
  onDraggingChange: (dragging) => emit('dragging-change', dragging),
  onImageLoad: () => emit('load'),
})

defineExpose({
  getNaturalPoints,
  getImageElement: () => cropImgRef.value,
})

onBeforeUnmount(() => dispose())
</script>

<style scoped>
.crop-perspective-editor {
  position: relative;
  touch-action: none;
  cursor: default;
  display: block;
  width: 100%;
  max-width: 100%;
}

.crop-perspective-editor--active {
  cursor: crosshair;
}

.crop-perspective-editor__img {
  display: block;
  width: 100%;
  max-height: min(70vh, 720px);
  object-fit: contain;
  background: #ddd;
  vertical-align: top;
}

.crop-perspective-editor__overlay {
  position: absolute;
  pointer-events: none;
}

.crop-perspective-editor__lines {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
}

.crop-perspective-editor__point {
  position: absolute;
  width: 24px;
  height: 24px;
  transform: translate(-50%, -50%);
  border-radius: 50%;
  background: var(--color-primary, #2563eb);
  color: #fff;
  font-size: 12px;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  pointer-events: auto;
  cursor: grab;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
}

.crop-perspective-editor__point:active {
  cursor: grabbing;
}
</style>
