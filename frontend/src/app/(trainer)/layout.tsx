"use client"

import { Dumbbell, Users } from "lucide-react"

import { AppShell, type NavItem } from "@/components/shared/app-shell"
import { RequireAuth } from "@/components/shared/require-auth"

const navItems: NavItem[] = [
  { label: "Clientes", href: "/trainer/clients", icon: Users },
  { label: "Ejercicios", href: "/trainer/exercises", icon: Dumbbell },
]

export default function TrainerLayout({ children }: { children: React.ReactNode }) {
  return (
    <RequireAuth allowedRoles={["TRAINER", "NUTRITIONIST", "GYM_ADMIN"]}>
      <AppShell title="Coaching" navItems={navItems}>
        {children}
      </AppShell>
    </RequireAuth>
  )
}
