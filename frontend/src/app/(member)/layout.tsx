"use client"

import { usePathname } from "next/navigation"
import { AnimatePresence, motion } from "framer-motion"
import { Dumbbell, LogOut } from "lucide-react"

import { Button } from "@/components/ui/button"
import { RequireAuth } from "@/components/shared/require-auth"
import { useLogout } from "@/hooks/use-auth"

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

  return (
    <div className="bg-gym-radial relative mx-auto flex min-h-screen w-full max-w-lg flex-col">
      <div className="bg-grid-fade pointer-events-none absolute inset-0" />
      <header className="relative flex h-14 items-center justify-between border-b bg-sidebar/80 px-4 text-sidebar-foreground backdrop-blur-sm">
        <div className="flex items-center gap-2">
          <span className="flex size-7 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Dumbbell className="size-3.5" />
          </span>
          <span className="font-semibold">SubGym</span>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={logout}
          className="text-sidebar-foreground/70 hover:bg-sidebar-accent"
        >
          <LogOut className="size-4" />
        </Button>
      </header>
      <main className="relative flex-1 space-y-6 overflow-y-auto p-4 pb-10">
        <AnimatePresence mode="wait">
          <motion.div
            key={pathname}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="space-y-6"
          >
            {children}
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  )
}
