import { ref, watch } from 'vue'

export type ThemePreference = 'light' | 'dark' | 'system'

const STORAGE_KEY = 'recipe-library-theme'

function getSystemTheme(): 'light' | 'dark' {
  if (typeof window === 'undefined') return 'light'
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

function readStored(): ThemePreference {
  try {
    const v = localStorage.getItem(STORAGE_KEY)
    if (v === 'light' || v === 'dark' || v === 'system') return v
  } catch {
    /* ignore */
  }
  return 'system'
}

function applyResolved(theme: 'light' | 'dark') {
  document.documentElement.setAttribute('data-theme', theme)
}

const preference = ref<ThemePreference>(readStored())
const resolved = ref<'light' | 'dark'>(preference.value === 'system' ? getSystemTheme() : preference.value)

let mediaQuery: MediaQueryList | null = null

function syncResolved() {
  resolved.value = preference.value === 'system' ? getSystemTheme() : preference.value
  applyResolved(resolved.value)
}

function ensureSystemListener() {
  if (typeof window === 'undefined') return
  if (!mediaQuery) {
    mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    mediaQuery.addEventListener('change', () => {
      if (preference.value === 'system') syncResolved()
    })
  }
}

export function useTheme() {
  ensureSystemListener()

  function setPreference(next: ThemePreference) {
    preference.value = next
    try {
      localStorage.setItem(STORAGE_KEY, next)
    } catch {
      /* ignore */
    }
    syncResolved()
  }

  function toggle() {
    setPreference(resolved.value === 'dark' ? 'light' : 'dark')
  }

  watch(preference, syncResolved, { immediate: true })

  return { preference, resolved, setPreference, toggle }
}

/** Call once before app mount so first paint matches stored theme. */
export function initTheme() {
  syncResolved()
  ensureSystemListener()
}
