"use client"

import * as React from "react"
import { useRouter } from "next/navigation"

import { useAuthStore } from "@/store/auth-store"
import { roleHome } from "@/hooks/use-auth"

export default function Home() {
  const router = useRouter()
  const hasHydrated = useAuthStore((s) => s.hasHydrated)
  const user = useAuthStore((s) => s.user)
  const accessToken = useAuthStore((s) => s.accessToken)

  React.useEffect(() => {
    if (!hasHydrated) return
    if (accessToken && user) {
      router.replace(roleHome(user.role))
    } else {
      router.replace("/login")
    }
  }, [hasHydrated, accessToken, user, router])

  return (
    <div className="flex flex-1 items-center justify-center text-muted-foreground text-sm">
      Cargando…
    </div>
  )
}
