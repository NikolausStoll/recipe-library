import { onBeforeUnmount, onMounted, watch, type WatchSource } from 'vue'

function setBodyModalLocked(locked: boolean) {
  document.body.classList.toggle('app-modal-open', locked)
}

/** Prevent page scroll while a teleported modal overlay is open. */
export function useBodyModalLock(isOpen?: WatchSource<boolean>) {
  if (isOpen != null) {
    watch(isOpen, (open) => setBodyModalLocked(!!open), { immediate: true })
    onBeforeUnmount(() => setBodyModalLocked(false))
    return
  }

  onMounted(() => setBodyModalLocked(true))
  onBeforeUnmount(() => setBodyModalLocked(false))
}
