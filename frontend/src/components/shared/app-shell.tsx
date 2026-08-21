"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { LogOut, type LucideIcon } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { useLogout } from "@/hooks/use-auth"
import { useAuthStore } from "@/store/auth-store"

export interface NavItem {
  label: string
  href: string
  icon: LucideIcon
}

export function AppShell({
  title,
  navItems,
  children,
}: {
  title: string
  navItems: NavItem[]
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const user = useAuthStore((s) => s.user)
  const logout = useLogout()

  const initials = user ? `${user.first_name[0]}${user.last_name[0]}` : "?"

  return (
    <div className="flex min-h-screen w-full">
      <aside className="hidden w-64 shrink-0 flex-col border-r bg-muted/30 md:flex">
        <div className="flex h-16 items-center border-b px-6">
          <span className="font-semibold tracking-tight">{title}</span>
        </div>
        <nav className="flex-1 space-y-1 p-3">
          {navItems.map((item) => {
            const active = pathname === item.href || pathname.startsWith(`${item.href}/`)
            const Icon = item.icon
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                  active
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                <Icon className="size-4" />
                {item.label}
              </Link>
            )
          })}
        </nav>
        <div className="flex items-center gap-3 border-t p-4">
          <Avatar className="size-8">
            <AvatarFallback>{initials}</AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">
              {user?.first_name} {user?.last_name}
            </p>
            <p className="truncate text-xs text-muted-foreground">{user?.role}</p>
          </div>
          <Button variant="ghost" size="icon" onClick={logout} title="Log out">
            <LogOut className="size-4" />
          </Button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-16 items-center justify-between border-b px-4 md:hidden">
          <span className="font-semibold">{title}</span>
          <Button variant="ghost" size="icon" onClick={logout}>
            <LogOut className="size-4" />
          </Button>
        </header>
        <main className="flex-1 overflow-y-auto p-4 md:p-8">{children}</main>
      </div>
    </div>
  )
}
