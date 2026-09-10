import type { MemberSubscription } from "@/lib/types"

function todayIso() {
  return new Date().toISOString().slice(0, 10)
}

// Mirrors the exact gate the backend already enforces for gym check-in
// (backend/app/services/checkin_service.py — PENDING counts as valid too
// since nothing flips it to ACTIVE until the member's first day arrives).
// Keeping the two in sync means "can I check in at the gym" and "can I see
// my portal" never disagree.
export function isSubscriptionValid(sub: MemberSubscription, today = todayIso()) {
  return (
    (sub.status === "ACTIVE" || sub.status === "PENDING") &&
    sub.start_date <= today &&
    sub.end_date >= today
  )
}

export function hasValidSubscription(subscriptions: MemberSubscription[]) {
  const today = todayIso()
  return subscriptions.some((s) => isSubscriptionValid(s, today))
}

/** Most recently ended subscription, for a "your membership expired on X" message. */
export function mostRecentSubscription(subscriptions: MemberSubscription[]) {
  return [...subscriptions].sort((a, b) => b.end_date.localeCompare(a.end_date))[0]
}
