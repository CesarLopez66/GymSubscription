import type { Promotion } from "@/lib/types"

// A plan-specific promotion wins over a gym-wide one; no stacking multiple
// promotions on the same plan.
export function applicablePromotion(promotions: Promotion[], membershipId: string): Promotion | undefined {
  const today = new Date().toISOString().slice(0, 10)
  const isLive = (p: Promotion) => p.is_active && p.start_date <= today && p.end_date >= today
  return (
    promotions.find((p) => p.membership_id === membershipId && isLive(p)) ??
    promotions.find((p) => p.membership_id === null && isLive(p))
  )
}

export function discountedPrice(price: number, promo: Promotion): number {
  const value = Number(promo.discount_value)
  const raw = promo.discount_type === "PERCENTAGE" ? price * (1 - value / 100) : price - value
  // Round to cents: floating-point subtraction/percentage math otherwise
  // produces values like 24.990000000000002 that both look wrong on screen
  // and can fail the backend's exact-amount match by a fraction of a cent.
  return Math.round(Math.max(0, raw) * 100) / 100
}
