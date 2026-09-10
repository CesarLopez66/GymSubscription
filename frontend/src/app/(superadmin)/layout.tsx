"use client"

import { BarChart3, Building2, LayoutDashboard, Receipt } from "lucide-react"

import { AppShell, type NavItem } from "@/components/shared/app-shell"
import { RequireAuth } from "@/components/shared/require-auth"

// No data-prefetch on hover here on purpose: all four screens below share
// one overview query, so whichever of them is mounted already holds it —
// re-running it from a hover would just flip that shared query's
// `isFetching` back to true and pop every page's full-screen "Actualizando…"
// overlay (see LoadingOverlay) from nothing more than the mouse passing
// near the sidebar. Route-code prefetch (AppShell's `router.prefetch`,
// unconditional) already covers the cheap part.
const navItems: NavItem[] = [
  { label: "Inicio", href: "/superadmin", icon: LayoutDashboard },
  { label: "Estadísticas", href: "/superadmin/stats", icon: BarChart3 },
  { label: "Gimnasios", href: "/superadmin/gyms", icon: Building2 },
  { label: "Historial de pagos", href: "/superadmin/activity", icon: Receipt },
]

export default function SuperAdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <RequireAuth allowedRoles={["SUPERADMIN"]}>
      <AppShell title="Plataforma" navItems={navItems}>
        {children}
      </AppShell>
    </RequireAuth>
  )
}
