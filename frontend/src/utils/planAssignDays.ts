import type { PlanDay } from './mealPlanTypes'
import {
  daysBetweenIso,
  formatPlanDayCompactLabel,
  isPastIsoDate,
  isTodayIsoDate,
} from './mealPlanDates'

export interface PlanAssignDayOption {
  date: string
  compactLabel: string
  subLabel: string
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
      return {
        date: day.date,
        compactLabel: label,
        subLabel,
        plannedCount: day.entries.filter((entry) => !entry.cookedAt).length,
        isToday: isTodayIsoDate(day.date, today),
      }
    })
}
