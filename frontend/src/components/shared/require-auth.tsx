"use client"

import * as React from "react"
import { useRouter } from "next/navigation"

import type { UserRole } from "@/lib/types"
import { useAuthStore } from "@/store/auth-store"

export function RequireAuth({
  allowedRoles,
  children,
}: {
  allowedRoles: UserRole[]
  children: React.ReactNode
}) {
  const router = useRouter()
  const hasHydrated = useAuthStore((s) => s.hasHydrated)
  const accessToken = useAuthStore((s) => s.accessToken)
  const user = useAuthStore((s) => s.user)

  React.useEffect(() => {
    if (!hasHydrated) return
    if (!accessToken || !user) {
      router.replace("/login")
      return
    }
    if (!allowedRoles.includes(user.role)) {
      router.replace("/login")
    }
  }, [hasHydrated, accessToken, user, allowedRoles, router])

  if (!hasHydrated || !accessToken || !user || !allowedRoles.includes(user.role)) {
    return (
      <div className="flex h-screen items-center justify-center text-muted-foreground text-sm">
        Loading…
      </div>
    )
  }

  return <>{children}</>
}
