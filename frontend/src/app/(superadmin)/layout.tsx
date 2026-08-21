"use client"

import { Building2 } from "lucide-react"

import { AppShell, type NavItem } from "@/components/shared/app-shell"
import { RequireAuth } from "@/components/shared/require-auth"

const navItems: NavItem[] = [{ label: "Gyms", href: "/superadmin", icon: Building2 }]

export default function SuperAdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <RequireAuth allowedRoles={["SUPERADMIN"]}>
      <AppShell title="SubGym · Platform" navItems={navItems}>
        {children}
      </AppShell>
    </RequireAuth>
  )
}
