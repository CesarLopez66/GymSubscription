"use client"

import { CreditCard, LayoutDashboard, ScanLine, Users, Wallet } from "lucide-react"

import { AppShell, type NavItem } from "@/components/shared/app-shell"
import { RequireAuth } from "@/components/shared/require-auth"

const navItems: NavItem[] = [
  { label: "Overview", href: "/dashboard", icon: LayoutDashboard },
  { label: "Members", href: "/dashboard/members", icon: Users },
  { label: "Membership plans", href: "/dashboard/memberships", icon: CreditCard },
  { label: "Payments & POS", href: "/dashboard/payments", icon: Wallet },
  { label: "Check-in monitor", href: "/dashboard/check-in", icon: ScanLine },
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
