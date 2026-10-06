"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Apple, Dumbbell, House, IdCard, Lock, TrendingUp } from "lucide-react"

import { cn } from "@/lib/utils"
import { hasValidSubscription } from "@/lib/subscription-status"
import { useSubscriptions } from "@/hooks/use-subscriptions"

// `gated` tabs sit behind <MembershipGate>: while the member has no valid
// subscription they still open (that's where the gate explains why and how
// to pay), but show a lock so the reason is visible before tapping.
const TABS = [
  { href: "/member", label: "Inicio", icon: House, gated: false },
  { href: "/member/membership", label: "Membresía", icon: IdCard, gated: false },
  { href: "/member/routine", label: "Rutina", icon: Dumbbell, gated: true },
  { href: "/member/nutrition", label: "Nutrición", icon: Apple, gated: true },
  { href: "/member/stats", label: "Progreso", icon: TrendingUp, gated: true },
] as const

export function MemberBottomNav() {
  const pathname = usePathname()
  const { data: subscriptions } = useSubscriptions()
  // Until subscriptions load, assume access is fine rather than flashing locks.
  const locked = subscriptions ? !hasValidSubscription(subscriptions.items) : false

  return (
    <nav
      aria-label="Navegación principal"
      className="relative z-10 grid shrink-0 grid-cols-5 border-t bg-sidebar/90 px-1 pt-1.5 pb-[max(0.75rem,env(safe-area-inset-bottom))] text-sidebar-foreground backdrop-blur-sm"
    >
      {TABS.map(({ href, label, icon, gated }) => {
        const active = href === "/member" ? pathname === "/member" : pathname.startsWith(href)
        const Icon = gated && locked ? Lock : icon
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex min-h-11 flex-col items-center gap-1 text-[11px] font-medium transition-colors",
              active ? "text-foreground" : "text-muted-foreground active:text-foreground"
            )}
          >
            <span
              className={cn(
                "grid h-7.5 w-13 place-items-center rounded-full transition-colors",
                active && "bg-primary/20 text-primary"
              )}
            >
              <Icon className="size-5" />
            </span>
            {label}
          </Link>
        )
      })}
    </nav>
  )
}
