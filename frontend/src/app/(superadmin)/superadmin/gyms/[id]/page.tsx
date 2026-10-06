"use client"

import Link from "next/link"
import { useParams } from "next/navigation"
import { AlertTriangle, ArrowLeft, Banknote, Building2, CalendarCheck, Activity, Users } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { EntityCard } from "@/components/shared/entity-card"
import { FadeIn, StaggerGroup, StaggerItem } from "@/components/shared/motion"
import { StatCard } from "@/components/shared/stat-card"
import {
  activeBadgeClass,
  GYM_STATUS_BADGE_CLASSES,
  riskBadgeClass,
  SUBSCRIPTION_REQUEST_STATUS_BADGE_CLASSES,
} from "@/lib/badge-colors"
import { formatCurrency } from "@/lib/currency"
import { formatRelativeDate } from "@/lib/format"
import {
  GYM_STATUS_LABELS,
  PLAN_TIER_LABELS,
  ROLE_LABELS,
  SUBSCRIPTION_REQUEST_STATUS_LABELS,
} from "@/lib/labels"
import type { UserRole } from "@/lib/types"
import { useGymAuditLog } from "@/hooks/use-gyms"
import { useSuperAdminGymDetail } from "@/hooks/use-superadmin"
import { GymBrandColorsCard } from "./gym-brand-colors-card"
import { GymUsersCard } from "./gym-users-card"

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

export default function SuperAdminGymDetailPage() {
  const params = useParams<{ id: string }>()
  const { data, isLoading } = useSuperAdminGymDetail(params.id)
  const { data: auditLog } = useGymAuditLog(params.id)

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

      <FadeIn delay={0.1}>
        <GymBrandColorsCard gym={gym} />
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
        <GymUsersCard gymId={params.id} />
      </FadeIn>

      <FadeIn delay={0.25}>
        <Card>
          <CardHeader>
            <CardTitle>Suscripción a la plataforma</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap items-center gap-3">
              <Badge variant="secondary">{PLAN_TIER_LABELS[gym.plan_tier]}</Badge>
              {gym.subscription_ends_at && (
                <span className="text-sm text-muted-foreground">
                  Vence el {new Date(gym.subscription_ends_at).toLocaleDateString()}
                </span>
              )}
            </div>
            <StaggerGroup className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {data.subscription_payments.map((p) => (
                <StaggerItem key={p.id}>
                  <EntityCard contentClassName="gap-2 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium">{PLAN_TIER_LABELS[p.requested_plan_tier]}</span>
                      <Badge className={SUBSCRIPTION_REQUEST_STATUS_BADGE_CLASSES[p.status]}>
                        {SUBSCRIPTION_REQUEST_STATUS_LABELS[p.status]}
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                      <span>{formatCurrency(p.amount)}</span>
                      <span>{formatRelativeDate(p.created_at)}</span>
                    </div>
                    {p.rejection_reason && (
                      <p className="text-xs text-destructive">{p.rejection_reason}</p>
                    )}
                  </EntityCard>
                </StaggerItem>
              ))}
              {data.subscription_payments.length === 0 && (
                <p className="text-sm text-muted-foreground sm:col-span-2 lg:col-span-3">
                  Todavía no envió ninguna solicitud de suscripción.
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
                <span className="text-xs text-muted-foreground">{formatRelativeDate(log.created_at)}</span>
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
