import type { UserRole } from "@/lib/types"

export const CHART_COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
]

// SUPERADMIN is intentionally excluded: it's never tied to a gym_id, so it
// never appears in a per-gym breakdown.
export const GYM_ROLE_ORDER: UserRole[] = ["GYM_ADMIN", "BRANCH_MANAGER", "TRAINER", "NUTRITIONIST", "MEMBER"]
