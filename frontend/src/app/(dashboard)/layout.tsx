"use client"

import { Building2, CreditCard, LayoutDashboard, Palette, Receipt, Tag } from "lucide-react"

import { AppShell, type NavItem } from "@/components/shared/app-shell"
import { RequireAuth } from "@/components/shared/require-auth"
import { branchesQueryOptions } from "@/hooks/use-branches"
import { membershipsQueryOptions } from "@/hooks/use-memberships"
import { promotionsQueryOptions } from "@/hooks/use-promotions"

// Config-only: day-to-day people/pagos/check-in now live under /branch
// (see app/(branch)/layout.tsx), delegated to each branch's own manager —
// the admin's nav keeps only gym-wide setup plus (via /dashboard itself,
// still reachable) a read-only aggregate across every branch for oversight.
const navItems: NavItem[] = [
  { label: "Resumen", href: "/dashboard", icon: LayoutDashboard },
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
    label: "Suscripción",
    href: "/dashboard/subscription",
    icon: Receipt,
  },
  {
    label: "Personalización",
    href: "/dashboard/settings",
    icon: Palette,
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
