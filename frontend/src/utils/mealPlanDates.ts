/** Local calendar date as YYYY-MM-DD */
export function todayIsoDate(): string {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function addDaysIso(isoDate: string, days: number): string {
  const [y, m, d] = isoDate.split('-').map(Number)
  const dt = new Date(y, m - 1, d)
  dt.setDate(dt.getDate() + days)
  const ny = dt.getFullYear()
  const nm = String(dt.getMonth() + 1).padStart(2, '0')
  const nd = String(dt.getDate()).padStart(2, '0')
  return `${ny}-${nm}-${nd}`
}

export function compareIsoDates(a: string, b: string): number {
  return a.localeCompare(b)
}

export function isPastIsoDate(isoDate: string, today = todayIsoDate()): boolean {
  return compareIsoDates(isoDate, today) < 0
}

export function isTodayIsoDate(isoDate: string, today = todayIsoDate()): boolean {
  return isoDate === today
}

export function isWeekendIsoDate(isoDate: string): boolean {
  const [y, m, d] = isoDate.split('-').map(Number)
  const dow = new Date(y, m - 1, d).getDay()
  return dow === 0 || dow === 6
}

const WEEKDAY_SHORT_DE = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'] as const

/** e.g. "Fr, 26. Jun" */
export function formatPlanDayLabel(isoDate: string, today = todayIsoDate()): string {
  const [y, m, d] = isoDate.split('-').map(Number)
  const dt = new Date(y, m - 1, d)
  const weekday = WEEKDAY_SHORT_DE[dt.getDay()]
  const month = dt.toLocaleDateString('de', { month: 'short' }).replace(/\.$/, '')
  const suffix = isTodayIsoDate(isoDate, today) ? ' · heute' : ''
  return `${weekday}, ${d}. ${month}${suffix}`
}

/** Weekday-only label for desktop assignment popover (no Heute/Morgen). */
export function formatPlanDayPopoverLabel(isoDate: string): { label: string; subLabel: string } {
  const [y, m, d] = isoDate.split('-').map(Number)
  const dt = new Date(y, m - 1, d)
  return { label: WEEKDAY_SHORT_DE[dt.getDay()], subLabel: String(d) }
}

/** Compact label for day assignment UI: Heute / Morgen / Do + day number */
export function formatPlanDayCompactLabel(
  isoDate: string,
  today = todayIsoDate(),
): { label: string; subLabel: string } {
  const [y, m, d] = isoDate.split('-').map(Number)
  const dt = new Date(y, m - 1, d)
  const subLabel = String(d)
  if (isTodayIsoDate(isoDate, today)) return { label: 'Heute', subLabel }
  if (daysBetweenIso(today, isoDate) === 1) return { label: 'Morgen', subLabel }
  return { label: WEEKDAY_SHORT_DE[dt.getDay()], subLabel }
}

export function formatPlanDateRange(start: string, end: string): string {
  const fmt = (iso: string) => {
    const [y, m, d] = iso.split('-').map(Number)
    return new Date(y, m - 1, d).toLocaleDateString('de', { day: 'numeric', month: 'short' })
  }
  return `${fmt(start)} – ${fmt(end)}`
}

export function eachIsoDateInclusive(start: string, end: string): string[] {
  const dates: string[] = []
  let cur = start
  while (compareIsoDates(cur, end) <= 0) {
    dates.push(cur)
    cur = addDaysIso(cur, 1)
  }
  return dates
}

/** Whole calendar days from `from` to `to` (positive if `to` is later). */
export function daysBetweenIso(from: string, to: string): number {
  const [fy, fm, fd] = from.split('-').map(Number)
  const [ty, tm, td] = to.split('-').map(Number)
  const fromMs = Date.UTC(fy, fm - 1, fd)
  const toMs = Date.UTC(ty, tm - 1, td)
  return Math.round((toMs - fromMs) / 86_400_000)
}
