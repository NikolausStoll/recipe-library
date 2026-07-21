import type { PlanDay } from './mealPlanTypes'
import {
  formatPlanDayCompactLabel,
  formatPlanDayPopoverLabel,
  isPastIsoDate,
  isTodayIsoDate,
} from './mealPlanDates'

export interface PlanAssignDayOption {
  date: string
  compactLabel: string
  subLabel: string
  popoverLabel: string
  popoverSubLabel: string
  plannedCount: number
  isToday: boolean
}

export function buildAssignDayOptions(
  days: PlanDay[],
  today: string,
  excludeDate?: string,
): PlanAssignDayOption[] {
  return days
    .filter((day) => !isPastIsoDate(day.date, today) && day.date !== excludeDate)
    .map((day) => {
      const { label, subLabel } = formatPlanDayCompactLabel(day.date, today)
      const popover = formatPlanDayPopoverLabel(day.date)
      return {
        date: day.date,
        compactLabel: label,
        subLabel,
        popoverLabel: popover.label,
        popoverSubLabel: popover.subLabel,
        plannedCount: day.entries.filter((entry) => !entry.cookedAt).length,
        isToday: isTodayIsoDate(day.date, today),
      }
    })
}
