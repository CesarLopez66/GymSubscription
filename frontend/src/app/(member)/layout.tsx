"use client"

import Image from "next/image"
import { usePathname } from "next/navigation"
import { AnimatePresence, motion } from "framer-motion"
import { LogOut } from "lucide-react"

import { Button } from "@/components/ui/button"
import { MemberBottomNav } from "@/components/shared/member-bottom-nav"
import { NotificationBell } from "@/components/shared/notification-bell"
import { RequireAuth } from "@/components/shared/require-auth"
import { useLogout } from "@/hooks/use-auth"
import { useMyGym } from "@/hooks/use-gyms"
import { useStoredGymName } from "@/hooks/use-stored-gym-name"

// Unlike before the bottom-nav split, MembershipGate is no longer applied
// here for every tab: the Escáner and Membresía tabs must stay reachable
// even without an active subscription (that's exactly where a member sees
// why they're blocked and pays), so each tab that should stay locked wraps
// itself in <MembershipGate> individually — see routine/nutrition/stats pages.
export default function MemberLayout({ children }: { children: React.ReactNode }) {
  return (
    <RequireAuth allowedRoles={["MEMBER"]}>
      <MemberShell>{children}</MemberShell>
    </RequireAuth>
  )
}

function MemberShell({ children }: { children: React.ReactNode }) {
  const logout = useLogout()
  const pathname = usePathname()
  const { data: gym } = useMyGym()
  // Instant-paint fallback while GET /gyms/me is in flight — see the
  // matching comment on HeaderBrand in components/shared/app-shell.tsx.
  const cachedName = useStoredGymName(true)
  const gymName = gym?.name ?? cachedName

  return (
    <div className="bg-gym-radial relative mx-auto flex h-dvh w-full max-w-lg flex-col overflow-hidden">
      <Image
        src="/images/gym-background.jpg"
        alt=""
        fill
        priority
        sizes="(max-width: 512px) 100vw, 512px"
        className="-z-10 scale-110 object-cover blur-xl"
      />
      <div className="absolute inset-0 -z-10 bg-linear-to-b from-background/92 via-background/90 to-background" />
      <header className="relative flex h-14 shrink-0 items-center justify-between gap-2 border-b bg-sidebar/85 pr-2 pl-4 text-sidebar-foreground backdrop-blur-sm">
        <span className="min-w-0 truncate font-heading text-[22px] leading-none font-semibold text-gradient-gym">
          {gymName ?? "Mi panel"}
        </span>
        <div className="flex items-center">
          <NotificationBell />
          <Button
            variant="ghost"
            size="icon-lg"
            onClick={logout}
            aria-label="Cerrar sesión"
            className="text-sidebar-foreground/70 hover:bg-sidebar-accent"
          >
            <LogOut className="size-4" />
          </Button>
        </div>
      </header>
      <main className="relative min-h-0 flex-1 overflow-y-auto px-4 pt-5 pb-6">
        <AnimatePresence mode="wait">
          <motion.div
            key={pathname}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="space-y-4"
          >
            {children}
          </motion.div>
        </AnimatePresence>
      </main>
      <MemberBottomNav />
    </div>
  )
}
