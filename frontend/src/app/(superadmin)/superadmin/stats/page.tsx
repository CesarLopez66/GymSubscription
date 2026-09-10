"use client"

import {
  Activity,
  AlertTriangle,
  Banknote,
  Building2,
  CalendarCheck,
  CalendarClock,
  CheckCircle2,
  Clock,
  Tag,
  Users,
  XCircle,
} from "lucide-react"

import { GymFilter } from "@/components/shared/gym-filter"
import { FadeIn } from "@/components/shared/motion"
import { LoadingOverlay } from "@/components/shared/refetching-indicator"
import { StatCard } from "@/components/shared/stat-card"
import { useSuperAdminFilterStore } from "@/store/superadmin-filter-store"
import { formatCurrency } from "@/lib/currency"
import { PLAN_TIER_LABELS } from "@/lib/labels"
import type { SaaSPlanTier } from "@/lib/types"
import { useGyms } from "@/hooks/use-gyms"
import { useSuperAdminOverview } from "@/hooks/use-superadmin"

const PLAN_TIERS: SaaSPlanTier[] = ["FREE", "BASIC", "PRO", "ENTERPRISE"]

export default function SuperAdminStatsPage() {
  const gymId = useSuperAdminFilterStore((s) => s.gymId)
  const { data, isFetching: gymsFetching, isLoading: gymsLoading } = useGyms(1, 100)
  const {
    data: overview,
    isFetching: overviewFetching,
    isLoading: overviewLoading,
  } = useSuperAdminOverview(30, gymId)

  const gyms = (data?.items ?? []).filter((g) => !gymId || g.id === gymId)
  const activeCount = gyms.filter((g) => g.status === "ACTIVE").length
  const trialCount = gyms.filter((g) => g.status === "TRIAL").length
  const selectedGymName = gyms.length === 1 ? gyms[0].name : null

  const breakdown = overview?.gyms_breakdown ?? []
  const atRiskCount = breakdown.filter((g) => g.is_at_risk).length
  const branchesTotal = breakdown.reduce((sum, g) => sum + g.branches_total, 0)
  const expiringSubscriptions = breakdown.reduce((sum, g) => sum + g.expiring_subscriptions_7d, 0)
  const failedPayments = breakdown.reduce((sum, g) => sum + g.failed_payments_period, 0)

  const planCounts = PLAN_TIERS.reduce(
    (acc, tier) => {
      acc[tier] = gyms.filter((g) => g.plan_tier === tier).length
      return acc
    },
    {} as Record<SaaSPlanTier, number>
  )

  return (
    <div className="space-y-6">
      <LoadingOverlay
        show={(gymsFetching && !gymsLoading) || (overviewFetching && !overviewLoading)}
      />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Estadísticas</h1>
          <p className="text-sm text-muted-foreground">
            Números clave de {selectedGymName ?? "toda la plataforma"}
          </p>
        </div>
        <GymFilter />
      </div>

      {!selectedGymName && (
        <FadeIn>
          <section className="space-y-3">
            <h2 className="text-sm font-medium text-muted-foreground">Gimnasios</h2>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
              <StatCard label="Total de gimnasios" value={gyms.length} icon={Building2} delay={0} />
              <StatCard label="Activos" value={activeCount} icon={CheckCircle2} delay={0.05} />
              <StatCard label="En prueba" value={trialCount} icon={Clock} delay={0.1} />
              <StatCard label="Sucursales" value={branchesTotal} icon={Building2} delay={0.12} />
              <StatCard
                label="En riesgo"
                value={atRiskCount}
                icon={AlertTriangle}
                delay={0.14}
              />
            </div>
          </section>
        </FadeIn>
      )}

      <FadeIn delay={0.05}>
        <section className="space-y-3">
          <h2 className="text-sm font-medium text-muted-foreground">
            {selectedGymName ?? "Plataforma"}
          </h2>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-6">
            <StatCard
              label="Usuarios"
              value={overview?.users_total}
              icon={Users}
              delay={0.15}
            />
            <StatCard
              label="Ingresos totales"
              value={overview?.revenue_total}
              icon={Banknote}
              format={formatCurrency}
              delay={0.2}
            />
            <StatCard
              label="Suscripciones"
              value={overview?.active_subscriptions}
              icon={Activity}
              delay={0.25}
            />
            <StatCard
              label="Check-ins (30d)"
              value={overview?.checkins_last_30d}
              icon={CalendarCheck}
              delay={0.3}
            />
            <StatCard
              label="Por vencer (7d)"
              value={expiringSubscriptions}
              icon={CalendarClock}
              delay={0.35}
            />
            <StatCard
              label="Pagos fallidos"
              value={failedPayments}
              icon={XCircle}
              delay={0.4}
            />
          </div>
        </section>
      </FadeIn>

      {!selectedGymName && (
        <FadeIn delay={0.1}>
          <section className="space-y-3">
            <h2 className="text-sm font-medium text-muted-foreground">Planes contratados</h2>
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
              {PLAN_TIERS.map((tier, index) => (
                <StatCard
                  key={tier}
                  label={PLAN_TIER_LABELS[tier]}
                  value={planCounts[tier]}
                  icon={Tag}
                  delay={0.45 + index * 0.05}
                />
              ))}
            </div>
          </section>
        </FadeIn>
      )}
    </div>
  )
}
