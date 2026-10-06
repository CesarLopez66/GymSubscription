"use client"

import { LayoutDashboard, ScanLine, Users, Wallet } from "lucide-react"

import { AppShell, type NavItem } from "@/components/shared/app-shell"
import { RequireAuth } from "@/components/shared/require-auth"
import { checkInsQueryOptions } from "@/hooks/use-checkins"
import { paymentsQueryOptions } from "@/hooks/use-payments"
import { usersQueryOptions } from "@/hooks/use-users"

// Same operational surface as (dashboard) minus everything that's gym-wide
// config (branches, plans, promotions, subscription billing,
// personalization) — those stay GYM_ADMIN-only. A branch manager's access
// is already confined server-side (see get_effective_branch_id in the
// backend), this nav just doesn't surface UI they'd have no use for.
const navItems: NavItem[] = [
  { label: "Resumen", href: "/branch", icon: LayoutDashboard },
  {
    label: "Personas",
    href: "/branch/members",
    icon: Users,
    prefetch: (qc) => qc.prefetchQuery(usersQueryOptions("MEMBER", 1, 100)),
  },
  {
    label: "Pagos y punto de venta",
    href: "/branch/payments",
    icon: Wallet,
    prefetch: (qc) => qc.prefetchQuery(paymentsQueryOptions()),
  },
  {
    label: "Monitor de check-in",
    href: "/branch/check-in",
    icon: ScanLine,
    prefetch: (qc) => qc.prefetchQuery(checkInsQueryOptions(undefined, 25)),
  },
]

export default function BranchLayout({ children }: { children: React.ReactNode }) {
  return (
    <RequireAuth allowedRoles={["BRANCH_MANAGER"]}>
      <AppShell title="Sucursal" navItems={navItems}>
        {children}
      </AppShell>
    </RequireAuth>
  )
}
