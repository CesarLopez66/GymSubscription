"use client"

import { Apple, ClipboardList, Dumbbell } from "lucide-react"

import { AppShell, type NavItem } from "@/components/shared/app-shell"
import { RequireAuth } from "@/components/shared/require-auth"

const navItems: NavItem[] = [
  { label: "Evaluaciones", href: "/trainer/evaluations", icon: ClipboardList },
  { label: "Constructor de rutinas", href: "/trainer/workouts", icon: Dumbbell },
  { label: "Prescriptor de macros", href: "/trainer/nutrition", icon: Apple },
]

export default function TrainerLayout({ children }: { children: React.ReactNode }) {
  return (
    <RequireAuth allowedRoles={["TRAINER", "NUTRITIONIST", "GYM_ADMIN"]}>
      <AppShell title="SubGym · Coaching" navItems={navItems}>
        {children}
      </AppShell>
    </RequireAuth>
  )
}
