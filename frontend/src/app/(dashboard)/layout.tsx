"use client"

import { CreditCard, LayoutDashboard, ScanLine, Users, Wallet } from "lucide-react"

import { AppShell, type NavItem } from "@/components/shared/app-shell"
import { RequireAuth } from "@/components/shared/require-auth"

const navItems: NavItem[] = [
  { label: "Resumen", href: "/dashboard", icon: LayoutDashboard },
  { label: "Miembros", href: "/dashboard/members", icon: Users },
  { label: "Planes de membresía", href: "/dashboard/memberships", icon: CreditCard },
  { label: "Pagos y punto de venta", href: "/dashboard/payments", icon: Wallet },
  { label: "Monitor de check-in", href: "/dashboard/check-in", icon: ScanLine },
]

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <RequireAuth allowedRoles={["GYM_ADMIN"]}>
      <AppShell title="SubGym · Admin" navItems={navItems}>
        {children}
      </AppShell>
    </RequireAuth>
  )
}
