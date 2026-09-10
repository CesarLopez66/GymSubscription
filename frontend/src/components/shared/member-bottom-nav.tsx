"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Apple, Dumbbell, IdCard, ScanLine, TrendingUp } from "lucide-react"

import { cn } from "@/lib/utils"

const TABS = [
  { href: "/member", label: "Escáner", icon: ScanLine },
  { href: "/member/membership", label: "Membresía", icon: IdCard },
  { href: "/member/routine", label: "Rutina", icon: Dumbbell },
  { href: "/member/nutrition", label: "Nutrición", icon: Apple },
  { href: "/member/stats", label: "Progreso", icon: TrendingUp },
] as const

export function MemberBottomNav() {
  const pathname = usePathname()

  return (
    <nav className="relative z-10 grid shrink-0 grid-cols-5 border-t bg-sidebar/90 pt-1.5 pb-[max(0.5rem,env(safe-area-inset-bottom))] text-sidebar-foreground backdrop-blur-sm">
      {TABS.map(({ href, label, icon: Icon }) => {
        const active = href === "/member" ? pathname === "/member" : pathname.startsWith(href)
        return (
          <Link
            key={href}
            href={href}
            className={cn(
              "flex flex-col items-center gap-0.5 py-1.5 text-[10px] font-medium transition-colors",
              active ? "text-primary" : "text-sidebar-foreground/60 active:text-sidebar-foreground"
            )}
          >
            <Icon className="size-5" />
            {label}
          </Link>
        )
      })}
    </nav>
  )
}
