"use client"

import * as React from "react"
import { useRouter } from "next/navigation"

import type { UserRole } from "@/lib/types"
import { useAuthStore } from "@/store/auth-store"
import { roleHome } from "@/hooks/use-auth"

// A stable empty-array fallback — `?? []` would create a fresh array every
// render, which would make the effect below re-run on every render too.
const NO_ROLES: UserRole[] = []

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
  // Defense in depth alongside the auth-store migration that backfills this
  // for sessions persisted before roles became a list: a hard crash here
  // would block login entirely, so an unexpected shape reads as "no roles"
  // instead of throwing.
  const userRoles = user?.roles ?? NO_ROLES

  React.useEffect(() => {
    if (!hasHydrated) return
    if (!accessToken || !user) {
      router.replace("/login")
      return
    }
    if (!userRoles.some((r) => allowedRoles.includes(r))) {
      // A wrong-role visit (e.g. a MEMBER hitting a /dashboard URL) is a
      // fully authenticated user, not a logged-out one — bouncing them to
      // /login would show a confusing "log back in" dead end instead of
      // just taking them to the area they actually have access to.
      router.replace(roleHome(userRoles))
    }
  }, [hasHydrated, accessToken, user, userRoles, allowedRoles, router])

  if (
    !hasHydrated ||
    !accessToken ||
    !user ||
    !userRoles.some((r) => allowedRoles.includes(r))
  ) {
    return (
      <div className="flex h-screen items-center justify-center text-muted-foreground text-sm">
        Cargando…
      </div>
    )
  }

  return <>{children}</>
}
