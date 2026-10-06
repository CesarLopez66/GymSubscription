import { MUSCLE_LABELS } from "@/components/shared/muscle-map"
import type { DayOfWeek, WorkoutPlanItem } from "@/lib/types"

export const WEEK_ORDER: DayOfWeek[] = [
  "MONDAY",
  "TUESDAY",
  "WEDNESDAY",
  "THURSDAY",
  "FRIDAY",
  "SATURDAY",
  "SUNDAY",
]

// getDay() is 0-indexed from Sunday; map it onto our Monday-first week order.
const JS_DAY_TO_DAY_OF_WEEK: DayOfWeek[] = [
  "SUNDAY",
  "MONDAY",
  "TUESDAY",
  "WEDNESDAY",
  "THURSDAY",
  "FRIDAY",
  "SATURDAY",
]

export function todayDayOfWeek(date = new Date()): DayOfWeek {
  return JS_DAY_TO_DAY_OF_WEEK[date.getDay()]
}

/** Local "YYYY-MM-DD" (toISOString would shift late-evening dates to tomorrow in UTC-4). */
export function localDateKey(date: Date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, "0")
  const d = String(date.getDate()).padStart(2, "0")
  return `${y}-${m}-${d}`
}

/** The 7 local dates (Monday first) of the week containing `date`. */
export function currentWeekDates(date = new Date()) {
  const monday = new Date(date)
  monday.setHours(0, 0, 0, 0)
  monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7))
  return WEEK_ORDER.map((_, i) => {
    const day = new Date(monday)
    day.setDate(monday.getDate() + i)
    return day
  })
}

/** "Espalda y brazos" from a day's exercises, in the order they first appear. */
export function muscleSummary(items: WorkoutPlanItem[]) {
  const labels = [...new Set(items.map((i) => MUSCLE_LABELS[i.exercise.muscle_group] ?? i.exercise.muscle_group))]
  if (labels.length === 0) return ""
  const [first, ...rest] = labels
  const tail = rest.map((l) => l.toLowerCase())
  if (tail.length === 0) return first
  return `${[first, ...tail.slice(0, -1)].join(", ")} y ${tail[tail.length - 1]}`
}

/** "Día 2 de 4": position of `day` among the plan's training days, Monday first. */
export function trainingDayPosition(items: WorkoutPlanItem[], day: DayOfWeek) {
  const days = WEEK_ORDER.filter((d) => items.some((i) => i.day_of_week === d))
  const index = days.indexOf(day)
  return index === -1 ? null : { index: index + 1, total: days.length }
}
