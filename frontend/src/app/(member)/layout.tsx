"use client"

import { LogOut } from "lucide-react"

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

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-lg flex-col">
      <header className="flex h-14 items-center justify-between border-b px-4">
        <span className="font-semibold">SubGym</span>
        <Button variant="ghost" size="icon" onClick={logout}>
          <LogOut className="size-4" />
        </Button>
      </header>
      <main className="flex-1 space-y-6 overflow-y-auto p-4 pb-10">{children}</main>
    </div>
  )
}
