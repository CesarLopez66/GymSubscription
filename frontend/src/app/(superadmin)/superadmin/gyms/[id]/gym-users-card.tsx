"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Eye, Search } from "lucide-react"

import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { EntityCard } from "@/components/shared/entity-card"
import { initialsOf } from "@/components/shared/member-picker"
import { StaggerGroup, StaggerItem } from "@/components/shared/motion"
import { activeBadgeClass } from "@/lib/badge-colors"
import { ApiError } from "@/lib/api-client"
import { formatRelativeDate } from "@/lib/format"
import { ROLE_LABELS } from "@/lib/labels"
import type { UserRole } from "@/lib/types"
import { roleHome } from "@/hooks/use-auth"
import { useGymUsers, useImpersonate } from "@/hooks/use-superadmin"
import { useAuthStore } from "@/store/auth-store"
import { AddGymAdminDialog } from "./add-gym-admin-dialog"

const GYM_ROLES: UserRole[] = ["GYM_ADMIN", "BRANCH_MANAGER", "TRAINER", "NUTRITIONIST", "MEMBER"]
const ALL_ROLES = "ALL"

export function GymUsersCard({ gymId }: { gymId: string }) {
  const router = useRouter()
  const startImpersonation = useAuthStore((s) => s.startImpersonation)
  const impersonate = useImpersonate()
  const [roleFilter, setRoleFilter] = React.useState<string>(ALL_ROLES)
  const [query, setQuery] = React.useState("")
  const { data: gymUsers, isLoading: usersLoading } = useGymUsers(
    gymId,
    roleFilter === ALL_ROLES ? undefined : (roleFilter as UserRole),
    1,
    100
  )

  const filteredUsers = (gymUsers?.items ?? []).filter((u) => {
    const q = query.trim().toLowerCase()
    if (!q) return true
    return (
      `${u.first_name} ${u.last_name}`.toLowerCase().includes(q) || u.email.toLowerCase().includes(q)
    )
  })

  const handleSimulate = (target: { id: string }) => {
    impersonate.mutate(target.id, {
      onSuccess: (result) => {
        startImpersonation(result.access_token, result.user)
        toast.success(`Viendo como ${result.user.first_name} ${result.user.last_name}`)
        router.push(roleHome(result.user.roles))
      },
      onError: (error) =>
        toast.error(error instanceof ApiError ? error.detail : "No se pudo simular al usuario"),
    })
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2">
        <CardTitle>Usuarios</CardTitle>
        <AddGymAdminDialog gymId={gymId} />
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <Tabs value={roleFilter} onValueChange={setRoleFilter}>
            <TabsList>
              <TabsTrigger value={ALL_ROLES}>Todos</TabsTrigger>
              {GYM_ROLES.map((role) => (
                <TabsTrigger key={role} value={role}>
                  {ROLE_LABELS[role]}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
          <div className="relative sm:w-64">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar por nombre o correo…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>

        {usersLoading ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-28 w-full" />
            ))}
          </div>
        ) : (
          <StaggerGroup className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filteredUsers.map((u) => (
              <StaggerItem key={u.id}>
                <EntityCard>
                  <div className="flex items-center gap-3">
                    <Avatar size="lg" className="shrink-0">
                      <AvatarFallback className="bg-primary/10 font-medium text-primary">
                        {initialsOf(u)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold leading-tight">
                        {u.first_name} {u.last_name}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">{u.email}</p>
                    </div>
                    <Badge className={activeBadgeClass(u.is_active)}>
                      {u.is_active ? "Activo" : "Inactivo"}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between gap-2 border-t pt-3">
                    <span className="text-xs text-muted-foreground">
                      {u.roles.map((r) => ROLE_LABELS[r]).join(" / ")} · {formatRelativeDate(u.created_at)}
                    </span>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={!u.is_active || impersonate.isPending}
                      title={u.is_active ? undefined : "No se puede simular a un usuario inactivo"}
                      onClick={() => handleSimulate(u)}
                    >
                      <Eye className="size-3.5" />
                      Simular
                    </Button>
                  </div>
                </EntityCard>
              </StaggerItem>
            ))}
            {filteredUsers.length === 0 && (
              <p className="text-sm text-muted-foreground sm:col-span-2 lg:col-span-3">
                No se encontraron usuarios.
              </p>
            )}
          </StaggerGroup>
        )}
      </CardContent>
    </Card>
  )
}
