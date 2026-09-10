"use client"

import { useRouter } from "next/navigation"
import { Eye } from "lucide-react"

import { Button } from "@/components/ui/button"
import { ROLE_LABELS } from "@/lib/labels"
import { useAuthStore } from "@/store/auth-store"

export function ImpersonationBanner() {
  const impersonation = useAuthStore((s) => s.impersonation)
  const user = useAuthStore((s) => s.user)
  const stopImpersonation = useAuthStore((s) => s.stopImpersonation)
  const router = useRouter()

  if (!impersonation || !user) return null

  return (
    <div className="sticky top-0 z-50 flex items-center justify-center gap-3 bg-amber-500 px-4 py-2 text-sm font-medium text-amber-950">
      <Eye className="size-4 shrink-0" />
      <span>
        Estás viendo como {user.first_name} {user.last_name} (
        {(user.roles ?? []).map((r) => ROLE_LABELS[r]).join(" / ")})
      </span>
      <Button
        size="sm"
        variant="outline"
        className="h-7 border-amber-950/30 bg-amber-500 text-amber-950 hover:bg-amber-500/80"
        onClick={() => {
          stopImpersonation()
          router.push("/superadmin")
        }}
      >
        Volver a superadmin
      </Button>
    </div>
  )
}
