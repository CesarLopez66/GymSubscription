import type {
  FitnessGoal,
  GymStatus,
  PaymentStatus,
  SubscriptionRequestStatus,
  SubscriptionStatus,
} from "@/lib/types"

// Tailwind classes for colored status/category badges — used with the plain
// Badge component (`<Badge className={...}>`) instead of its built-in
// variants, so each status/category gets a consistent, distinct color across
// every screen instead of the generic default/secondary/destructive trio.
//
// Text uses only the -300/-400 shades, never -500+: this app ships a single
// committed dark theme (see globals.css) with no ThemeProvider, so a `dark:`
// variant never activates — the un-prefixed shade is what every viewer
// always sees. -300/-400 are the ones actually tuned for light text on this
// near-black background; anything darker measures under WCAG AA contrast
// against it (e.g. zinc-600 lands around 2.4:1, vs ~7:1 for zinc-400).

// Exported so pages with their own derived multi-state status (e.g. a
// promotion being active-but-expired) can compose the same palette instead
// of hardcoding colors ad hoc.
export const emerald = "border-0 bg-emerald-500/15 text-emerald-400"
export const amber = "border-0 bg-amber-500/15 text-amber-400"
export const red = "border-0 bg-red-500/15 text-red-400"
export const zinc = "border-0 bg-zinc-500/15 text-zinc-300"

export const PAYMENT_STATUS_BADGE_CLASSES: Record<PaymentStatus, string> = {
  COMPLETED: emerald,
  PENDING: amber,
  REFUNDED: zinc,
  FAILED: red,
}

export const GYM_STATUS_BADGE_CLASSES: Record<GymStatus, string> = {
  ACTIVE: emerald,
  TRIAL: amber,
  SUSPENDED: red,
  CANCELLED: zinc,
}

export const SUBSCRIPTION_STATUS_BADGE_CLASSES: Record<SubscriptionStatus, string> = {
  ACTIVE: emerald,
  PENDING: amber,
  EXPIRED: red,
  CANCELLED: zinc,
}

export const SUBSCRIPTION_REQUEST_STATUS_BADGE_CLASSES: Record<SubscriptionRequestStatus, string> = {
  APPROVED: emerald,
  PENDING: amber,
  REJECTED: red,
}

export const FITNESS_GOAL_BADGE_CLASSES: Record<FitnessGoal, string> = {
  FAT_LOSS: "border-0 bg-orange-500/15 text-orange-400",
  MUSCLE_GAIN: emerald,
  MAINTENANCE: "border-0 bg-blue-500/15 text-blue-400",
  REHAB: "border-0 bg-purple-500/15 text-purple-400",
}

// Same 6 body-region colors used by the anatomical muscle map
// (components/shared/muscle-map.tsx) — kept here too so any screen that
// lists exercises (not just the diagram) can label "which muscle" with a
// matching color instead of a flat gray tag. Falls back to `zinc` for any
// custom `muscle_group` a gym might type in outside the common set.
const MUSCLE_GROUP_COLORS: Record<string, string> = {
  Chest: "border-0 bg-rose-500/15 text-rose-400",
  Back: "border-0 bg-teal-500/15 text-teal-400",
  Shoulders: amber,
  Arms: emerald,
  Core: "border-0 bg-lime-500/15 text-lime-400",
  Legs: "border-0 bg-blue-500/15 text-blue-400",
  Cardio: "border-0 bg-pink-500/15 text-pink-400",
}

export function muscleGroupBadgeClass(muscleGroup: string) {
  return MUSCLE_GROUP_COLORS[muscleGroup] ?? zinc
}

export function activeBadgeClass(active: boolean) {
  return active ? emerald : red
}

export function urgencyBadgeClass(daysLeft: number) {
  return daysLeft <= 2 ? red : amber
}

export function riskBadgeClass(atRisk: boolean) {
  return atRisk ? red : emerald
}
