/**
 * Tracks crop overlay dimensions without ResizeObserver ↔ Vue render loops.
 */
export function createCropDisplaySizeTracker() {
  const sizes = new Map<number, { w: number; h: number }>()
  const wraps = new Map<number, HTMLDivElement>()
  const observers = new Map<number, ResizeObserver>()
  const rafIds = new Map<number, number>()
  let onChange: (() => void) | null = null

  function notify() {
    onChange?.()
  }

  function refresh(id: number) {
    const wrap = wraps.get(id)
    if (!wrap) return
    const r = wrap.getBoundingClientRect()
    const w = Math.round(r.width)
    const h = Math.round(r.height)
    const prev = sizes.get(id)
    if (prev?.w === w && prev?.h === h) return
    sizes.set(id, { w, h })
    notify()
  }

  function scheduleRefresh(id: number) {
    const prev = rafIds.get(id)
    if (prev != null) cancelAnimationFrame(prev)
    rafIds.set(
      id,
      requestAnimationFrame(() => {
        rafIds.delete(id)
        refresh(id)
      }),
    )
  }

  function attachWrap(id: number, el: HTMLDivElement) {
    if (wraps.get(id) === el) return
    detachWrap(id)
    wraps.set(id, el)
    refresh(id)
    if (typeof ResizeObserver !== 'undefined') {
      const ro = new ResizeObserver(() => scheduleRefresh(id))
      ro.observe(el)
      observers.set(id, ro)
    }
  }

  /** Vue ref callback: ignore null (re-render); cleanup via detachWrap/remove. */
  function wrapRef(id: number, el: unknown) {
    if (el instanceof HTMLDivElement) attachWrap(id, el)
  }

  function detachWrap(id: number) {
    const raf = rafIds.get(id)
    if (raf != null) cancelAnimationFrame(raf)
    rafIds.delete(id)
    observers.get(id)?.disconnect()
    observers.delete(id)
    wraps.delete(id)
    sizes.delete(id)
  }

  function get(id: number) {
    return sizes.get(id) ?? { w: 0, h: 0 }
  }

  function dispose() {
    for (const id of [...observers.keys()]) detachWrap(id)
    onChange = null
  }

  return {
    wrapRef,
    attachWrap,
    detachWrap,
    get,
    setOnChange(cb: (() => void) | null) {
      onChange = cb
    },
    dispose,
  }
}
