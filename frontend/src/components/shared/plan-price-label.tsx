import { formatCurrency } from "@/lib/currency"
import { discountedPrice } from "@/lib/promotions"
import type { Membership, Promotion } from "@/lib/types"

export function PlanPriceLabel({ plan, promo }: { plan: Membership; promo?: Promotion }) {
  if (!promo) {
    return (
      <>
        {plan.name} — {formatCurrency(plan.price)}
      </>
    )
  }
  return (
    <span className="flex items-center gap-1.5">
      {plan.name} —{" "}
      <span className="text-muted-foreground line-through">{formatCurrency(plan.price)}</span>{" "}
      <span className="font-medium text-primary">
        {formatCurrency(discountedPrice(Number(plan.price), promo))}
      </span>{" "}
      <span className="text-xs text-muted-foreground">· {promo.name}</span>
    </span>
  )
}
