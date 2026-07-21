import { onBeforeUnmount, onMounted, ref } from 'vue'

const MOBILE_MQ = '(max-width: 639px)'

/** True when day assignment should use the mobile sheet instead of the desktop popover. */
export function usePlanAssignLayout() {
  const isMobileSheet = ref(
    typeof window !== 'undefined' ? window.matchMedia(MOBILE_MQ).matches : false,
  )

  let mq: MediaQueryList | null = null

  function onChange(event: MediaQueryListEvent) {
    isMobileSheet.value = event.matches
  }

  onMounted(() => {
    mq = window.matchMedia(MOBILE_MQ)
    isMobileSheet.value = mq.matches
    mq.addEventListener('change', onChange)
  })

  onBeforeUnmount(() => {
    mq?.removeEventListener('change', onChange)
  })

  return { isMobileSheet }
}
