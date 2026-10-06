"use client"

import * as React from "react"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { BranchFilter } from "@/components/shared/branch-filter"
import { FadeIn, StaggerGroup, StaggerItem } from "@/components/shared/motion"
import { useAuthStore } from "@/store/auth-store"
import { useBranchFilterStore } from "@/store/branch-filter-store"
import { ROLE_LABELS } from "@/lib/labels"
import { assignableStaffRoles } from "@/lib/role-permissions"
import type { UserRole } from "@/lib/types"
import { useUsers } from "@/hooks/use-users"
import { AddPersonDialog } from "./add-person-dialog"
import { PersonCard } from "./person-card"

export default function MembersPage() {
  const [section, setSection] = React.useState<"staff" | "clients">("staff")
  const [staffRoleFilter, setStaffRoleFilter] = React.useState<UserRole>("TRAINER")
  const branchId = useBranchFilterStore((s) => s.branchId)
  const viewerRoles = useAuthStore((s) => s.user?.roles ?? [])
  const staffRoles = React.useMemo(() => assignableStaffRoles(viewerRoles), [viewerRoles])
  const roleFilter = section === "clients" ? "MEMBER" : staffRoleFilter
  const { data, isLoading } = useUsers(roleFilter, 1, 100, branchId)

  const users = data?.items ?? []

  return (
    <div className="space-y-6">
      <FadeIn className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">Personas</h1>
        <div className="flex items-center gap-2">
          <BranchFilter />
          <AddPersonDialog section={section} />
        </div>
      </FadeIn>

      <FadeIn delay={0.05} className="space-y-3">
        <Tabs value={section} onValueChange={(v) => setSection(v as "staff" | "clients")}>
          <TabsList>
            <TabsTrigger value="staff">Personal</TabsTrigger>
            <TabsTrigger value="clients">Clientes</TabsTrigger>
          </TabsList>
        </Tabs>
        {section === "staff" && (
          <Tabs value={staffRoleFilter} onValueChange={(v) => setStaffRoleFilter(v as UserRole)}>
            <TabsList>
              {staffRoles.map((role) => (
                <TabsTrigger key={role} value={role}>
                  {ROLE_LABELS[role]}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        )}
      </FadeIn>

      <FadeIn delay={0.1}>
        <Card>
          <CardHeader>
            <CardTitle>
              {section === "clients" ? "Clientes" : ROLE_LABELS[staffRoleFilter]}{" "}
              <span className="text-muted-foreground">({data?.total ?? 0})</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {Array.from({ length: 6 }).map((_, i) => (
                  <Skeleton key={i} className="h-28 w-full" />
                ))}
              </div>
            ) : (
              <StaggerGroup className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {users.map((u) => (
                  <StaggerItem key={u.id}>
                    <PersonCard user={u} section={section} />
                  </StaggerItem>
                ))}
                {users.length === 0 && (
                  <p className="text-sm text-muted-foreground sm:col-span-2 lg:col-span-3">
                    Todavía no hay nadie aquí.
                  </p>
                )}
              </StaggerGroup>
            )}
          </CardContent>
        </Card>
      </FadeIn>
    </div>
  )
}
