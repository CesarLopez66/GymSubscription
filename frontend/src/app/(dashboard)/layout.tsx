"use client"

import { Building2, CreditCard, LayoutDashboard, ScanLine, Tag, Users, Wallet } from "lucide-react"

import { AppShell, type NavItem } from "@/components/shared/app-shell"
import { RequireAuth } from "@/components/shared/require-auth"
import { branchesQueryOptions } from "@/hooks/use-branches"
import { checkInsQueryOptions } from "@/hooks/use-checkins"
import { membershipsQueryOptions } from "@/hooks/use-memberships"
import { paymentsQueryOptions } from "@/hooks/use-payments"
import { promotionsQueryOptions } from "@/hooks/use-promotions"
import { usersQueryOptions } from "@/hooks/use-users"

const navItems: NavItem[] = [
  { label: "Resumen", href: "/dashboard", icon: LayoutDashboard },
  {
    label: "Miembros",
    href: "/dashboard/members",
    icon: Users,
    prefetch: (qc) => qc.prefetchQuery(usersQueryOptions("MEMBER", 1, 100)),
  },
  {
    label: "Sucursales",
    href: "/dashboard/branches",
    icon: Building2,
    prefetch: (qc) => qc.prefetchQuery(branchesQueryOptions()),
  },
  {
    label: "Planes de membresía",
    href: "/dashboard/memberships",
    icon: CreditCard,
    prefetch: (qc) => qc.prefetchQuery(membershipsQueryOptions()),
  },
  {
    label: "Promociones",
    href: "/dashboard/promotions",
    icon: Tag,
    prefetch: (qc) => qc.prefetchQuery(promotionsQueryOptions()),
  },
  {
    label: "Pagos y punto de venta",
    href: "/dashboard/payments",
    icon: Wallet,
    prefetch: (qc) => qc.prefetchQuery(paymentsQueryOptions()),
  },
  {
    label: "Monitor de check-in",
    href: "/dashboard/check-in",
    icon: ScanLine,
    prefetch: (qc) => qc.prefetchQuery(checkInsQueryOptions(undefined, 25)),
  },
]

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <RequireAuth allowedRoles={["GYM_ADMIN"]}>
      <AppShell title="Admin" navItems={navItems}>
        {children}
      </AppShell>
    </RequireAuth>
  )
}
