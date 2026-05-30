import { onBeforeUnmount, onMounted } from 'vue'

/** Prevent page scroll while a teleported modal overlay is open. */
export function useBodyModalLock() {
  onMounted(() => {
    document.body.classList.add('app-modal-open')
  })
  onBeforeUnmount(() => {
    document.body.classList.remove('app-modal-open')
  })
}
