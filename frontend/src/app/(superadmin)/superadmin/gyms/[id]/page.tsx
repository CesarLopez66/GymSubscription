"use client"

import * as React from "react"
import Link from "next/link"
import { useParams, useRouter } from "next/navigation"
import { toast } from "sonner"
import {
  AlertTriangle,
  ArrowLeft,
  Banknote,
  Building2,
  CalendarCheck,
  Eye,
  Search,
  Users,
  Activity,
} from "lucide-react"

import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { EntityCard } from "@/components/shared/entity-card"
import { initialsOf } from "@/components/shared/member-picker"
import { FadeIn, StaggerGroup, StaggerItem } from "@/components/shared/motion"
import { StatCard } from "@/components/shared/stat-card"
import {
  activeBadgeClass,
  GYM_STATUS_BADGE_CLASSES,
  PAYMENT_STATUS_BADGE_CLASSES,
  riskBadgeClass,
} from "@/lib/badge-colors"
import { ApiError } from "@/lib/api-client"
import { formatCurrency } from "@/lib/currency"
import { formatRelativeDate } from "@/lib/format"
import {
  GYM_STATUS_LABELS,
  PAYMENT_STATUS_LABELS,
  PAYMENT_TYPE_LABELS,
  PLAN_TIER_LABELS,
  ROLE_LABELS,
} from "@/lib/labels"
import type { User, UserRole } from "@/lib/types"
import { roleHome } from "@/hooks/use-auth"
import { useGymAuditLog } from "@/hooks/use-gyms"
import { useGymUsers, useImpersonate, useSuperAdminGymDetail } from "@/hooks/use-superadmin"
import { useAuthStore } from "@/store/auth-store"

const AUDIT_ACTION_LABELS: Record<string, string> = {
  suspended: "Suspendido",
  reactivated: "Reactivado",
}

function auditActionLabel(action: string): string {
  if (AUDIT_ACTION_LABELS[action]) return AUDIT_ACTION_LABELS[action]
  if (action.startsWith("status_changed:")) return `Estado: ${action.split(":")[1]}`
  if (action.startsWith("plan_changed:")) return `Plan: ${action.split(":")[1]}`
  return action
}

const GYM_ROLES: UserRole[] = ["GYM_ADMIN", "TRAINER", "NUTRITIONIST", "MEMBER"]
const ALL_ROLES = "ALL"

export default function SuperAdminGymDetailPage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const startImpersonation = useAuthStore((s) => s.startImpersonation)
  const impersonate = useImpersonate()
  const [roleFilter, setRoleFilter] = React.useState<string>(ALL_ROLES)
  const [query, setQuery] = React.useState("")
  const { data, isLoading } = useSuperAdminGymDetail(params.id)
  const { data: auditLog } = useGymAuditLog(params.id)
  const { data: gymUsers, isLoading: usersLoading } = useGymUsers(
    params.id,
    roleFilter === ALL_ROLES ? undefined : (roleFilter as UserRole),
    1,
    100
  )

  const filteredUsers = (gymUsers?.items ?? []).filter((u) => {
    const q = query.trim().toLowerCase()
    if (!q) return true
    return (
      `${u.first_name} ${u.last_name}`.toLowerCase().includes(q) ||
      u.email.toLowerCase().includes(q)
    )
  })

  const handleSimulate = (target: User) => {
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

  if (isLoading || !data) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  const { gym } = data
  const roleEntries = (Object.entries(data.users_by_role) as [UserRole, number][]).filter(
    ([, count]) => count > 0
  )

  return (
    <div className="space-y-6">
      <FadeIn>
        <Button variant="ghost" size="sm" nativeButton={false} render={<Link href="/superadmin/gyms" />}>
          <ArrowLeft className="size-3.5" />
          Volver
        </Button>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold tracking-tight">{gym.name}</h1>
          <Badge className={GYM_STATUS_BADGE_CLASSES[gym.status]}>{GYM_STATUS_LABELS[gym.status]}</Badge>
          <Badge variant="secondary">{PLAN_TIER_LABELS[gym.plan_tier]}</Badge>
          {gym.status === "TRIAL" && gym.trial_ends_at && new Date(gym.trial_ends_at) < new Date() && (
            <Badge className={riskBadgeClass(true)}>
              <AlertTriangle className="size-3" />
              Trial vencido el {new Date(gym.trial_ends_at).toLocaleDateString()}
            </Badge>
          )}
        </div>
        <p className="text-sm text-muted-foreground">
          {gym.subdomain} · {gym.contact_email}
        </p>
      </FadeIn>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <StatCard label="Usuarios totales" value={data.users_total} icon={Users} delay={0} />
        <StatCard
          label="Ingresos"
          value={data.revenue_total}
          icon={Banknote}
          format={formatCurrency}
          delay={0.05}
        />
        <StatCard
          label="Suscripciones activas"
          value={data.active_subscriptions}
          icon={Activity}
          delay={0.1}
        />
        <StatCard
          label="Check-ins (últimos 30 días)"
          value={data.checkins_last_30d}
          icon={CalendarCheck}
          delay={0.15}
        />
        <StatCard label="Sucursales" value={data.branches_total} icon={Building2} delay={0.2} />
      </div>

      <FadeIn delay={0.18}>
        <Card>
          <CardHeader>
            <CardTitle>Usuarios por rol</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {roleEntries.map(([role, count]) => (
              <Badge key={role} variant="outline" className="gap-1.5">
                {ROLE_LABELS[role]}
                <span className="font-semibold">{count}</span>
              </Badge>
            ))}
          </CardContent>
        </Card>
      </FadeIn>

      {data.branches.length > 0 && (
        <FadeIn delay={0.19}>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="size-4" />
                Sucursales ({data.branches_total})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <StaggerGroup className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {data.branches.map((b) => (
                  <StaggerItem key={b.id}>
                    <EntityCard contentClassName="gap-2 p-3">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium">{b.name}</span>
                        <Badge className={activeBadgeClass(b.is_active)}>
                          {b.is_active ? "Activa" : "Inactiva"}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {b.address ?? "Sin dirección registrada"}
                      </p>
                    </EntityCard>
                  </StaggerItem>
                ))}
              </StaggerGroup>
            </CardContent>
          </Card>
        </FadeIn>
      )}

      <FadeIn delay={0.2}>
        <Card>
          <CardHeader>
            <CardTitle>Usuarios</CardTitle>
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
                          {u.roles.map((r) => ROLE_LABELS[r]).join(" / ")} ·{" "}
                          {formatRelativeDate(u.created_at)}
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
      </FadeIn>

      <FadeIn delay={0.25}>
        <Card>
          <CardHeader>
            <CardTitle>Pagos recientes</CardTitle>
          </CardHeader>
          <CardContent>
            <StaggerGroup className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {data.recent_payments.map((p) => (
                <StaggerItem key={p.id}>
                  <EntityCard contentClassName="gap-2 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium">{formatCurrency(Number(p.amount))}</span>
                      <Badge className={PAYMENT_STATUS_BADGE_CLASSES[p.status]}>
                        {PAYMENT_STATUS_LABELS[p.status]}
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                      <span>{PAYMENT_TYPE_LABELS[p.payment_type]}</span>
                      <span>{formatRelativeDate(p.created_at)}</span>
                    </div>
                  </EntityCard>
                </StaggerItem>
              ))}
              {data.recent_payments.length === 0 && (
                <p className="text-sm text-muted-foreground sm:col-span-2 lg:col-span-3">
                  Todavía no hay pagos.
                </p>
              )}
            </StaggerGroup>
          </CardContent>
        </Card>
      </FadeIn>

      <FadeIn delay={0.3}>
        <Card>
          <CardHeader>
            <CardTitle>Historial</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {(auditLog?.items ?? []).map((log) => (
              <div key={log.id} className="flex items-center justify-between gap-2 border-b pb-2 text-sm last:border-0">
                <div>
                  <p className="font-medium">{auditActionLabel(log.action)}</p>
                  {log.reason && <p className="text-xs text-muted-foreground">{log.reason}</p>}
                </div>
                <span className="text-xs text-muted-foreground">
                  {formatRelativeDate(log.created_at)}
                </span>
              </div>
            ))}
            {(auditLog?.items?.length ?? 0) === 0 && (
              <p className="text-sm text-muted-foreground">Sin eventos registrados.</p>
            )}
          </CardContent>
        </Card>
      </FadeIn>
    </div>
  )
}
