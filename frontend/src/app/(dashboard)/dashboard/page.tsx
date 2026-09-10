"use client"

import {
  Bar,
  BarChart,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from "recharts"
import { Activity, Banknote, CalendarClock, Dumbbell, ScanLine, Tag, Users } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { EntityCard } from "@/components/shared/entity-card"
import { FadeIn, StaggerGroup, StaggerItem } from "@/components/shared/motion"
import { PageHero } from "@/components/shared/page-hero"
import { StatCard } from "@/components/shared/stat-card"
import { useAuthStore } from "@/store/auth-store"
import { PAYMENT_STATUS_BADGE_CLASSES, urgencyBadgeClass } from "@/lib/badge-colors"
import { formatCurrency } from "@/lib/currency"
import { daysUntil, formatRelativeDate, formatRelativeFutureDate } from "@/lib/format"
import { PAYMENT_STATUS_LABELS, PAYMENT_TYPE_LABELS } from "@/lib/labels"
import { useUsers } from "@/hooks/use-users"
import { useDailyRevenue, usePayments, useRevenueSummary } from "@/hooks/use-payments"
import { useCheckIns } from "@/hooks/use-checkins"
import { useSubscriptions } from "@/hooks/use-subscriptions"
import { useMemberships } from "@/hooks/use-memberships"
import { usePromotions } from "@/hooks/use-promotions"

const CHART_COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
]

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10)
}

export default function DashboardOverviewPage() {
  const user = useAuthStore((s) => s.user)
  const { data: members } = useUsers("MEMBER", 1, 1)
  const { data: trainers } = useUsers("TRAINER", 1, 1)
  const { data: nutritionists } = useUsers("NUTRITIONIST", 1, 1)
  const { data: revenue } = useRevenueSummary()
  const { data: dailyRevenue } = useDailyRevenue(30)
  const { data: payments } = usePayments(undefined, 1, 100)
  const { data: checkIns } = useCheckIns(undefined, { pageSize: 100 })
  const { data: subscriptions } = useSubscriptions(undefined, 1, 100)
  const { data: plans } = useMemberships()
  const { data: promotions } = usePromotions(1, 100)

  const today = isoDate(new Date())
  const activeSubs = (subscriptions?.items ?? []).filter((s) => s.status === "ACTIVE")
  const expiringSoon = activeSubs
    .filter((s) => {
      const d = daysUntil(s.end_date)
      return d >= 0 && d <= 7
    })
    .sort((a, b) => a.end_date.localeCompare(b.end_date))

  const checkInsToday = (checkIns?.items ?? []).filter((c) => c.timestamp.slice(0, 10) === today).length

  const promotionsLive = (promotions?.items ?? []).filter(
    (p) => p.is_active && p.start_date <= today && p.end_date >= today
  ).length

  const planNameById = new Map((plans?.items ?? []).map((p) => [p.id, p.name]))
  const planDistribution = (plans?.items ?? [])
    .map((plan) => ({
      name: plan.name,
      count: activeSubs.filter((s) => s.membership_id === plan.id).length,
    }))
    .filter((row) => row.count > 0)

  // Daily revenue for the last 30 days, aggregated server-side (GROUP BY
  // day over every COMPLETED payment) — no longer built by paging through
  // a fixed-size client-side payments list, which under-counted once a gym
  // did more than 100 transactions in the window.
  const revenueChartData = (dailyRevenue ?? []).map((d) => ({
    date: d.date,
    label: new Date(d.date).toLocaleDateString("es-BO", { day: "2-digit", month: "2-digit" }),
    total: d.total,
  }))

  const recentPayments = (payments?.items ?? []).slice(0, 5)

  return (
    <div className="space-y-6">
      <PageHero title={`Hola, ${user?.first_name ?? "Admin"} 👋`} />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Miembros" value={members?.total} icon={Users} delay={0} />
        <StatCard label="Entrenadores" value={trainers?.total} icon={Dumbbell} delay={0.03} />
        <StatCard label="Nutricionistas" value={nutritionists?.total} icon={Users} delay={0.06} />
        <StatCard
          label="Ingresos totales"
          value={revenue?.total_revenue}
          icon={Banknote}
          format={formatCurrency}
          delay={0.09}
        />
        <StatCard
          label="Suscripciones activas"
          value={activeSubs.length}
          icon={Activity}
          delay={0.12}
        />
        <StatCard
          label="Por vencer (7 días)"
          value={expiringSoon.length}
          icon={CalendarClock}
          delay={0.15}
        />
        <StatCard label="Check-ins hoy" value={checkInsToday} icon={ScanLine} delay={0.18} />
        <StatCard label="Promociones vigentes" value={promotionsLive} icon={Tag} delay={0.21} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <FadeIn delay={0.24}>
          <Card>
            <CardHeader>
              <CardTitle>Ingresos — últimos 30 días</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={revenueChartData} margin={{ left: 4, right: 4 }}>
                    <XAxis
                      dataKey="label"
                      tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
                      interval={4}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
                      width={40}
                      axisLine={false}
                      tickLine={false}
                      tickFormatter={(v) => formatCurrency(Number(v))}
                    />
                    <RechartsTooltip formatter={(value) => formatCurrency(Number(value))} />
                    <Bar dataKey="total" fill="var(--chart-1)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </FadeIn>

        <FadeIn delay={0.27}>
          <Card>
            <CardHeader>
              <CardTitle>Suscripciones activas por plan</CardTitle>
            </CardHeader>
            <CardContent>
              {planDistribution.length === 0 ? (
                <p className="text-sm text-muted-foreground">Todavía no hay suscripciones activas.</p>
              ) : (
                <div className="flex items-center gap-4">
                  <div className="h-48 flex-1">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={planDistribution}
                          dataKey="count"
                          nameKey="name"
                          innerRadius={40}
                          outerRadius={70}
                          paddingAngle={2}
                        >
                          {planDistribution.map((_, i) => (
                            <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                          ))}
                        </Pie>
                        <RechartsTooltip formatter={(value) => `${Number(value)} miembro(s)`} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <ul className="flex flex-col gap-1.5 text-sm">
                    {planDistribution.map((row, i) => (
                      <li key={row.name} className="flex items-center gap-2">
                        <span
                          className="size-2.5 shrink-0 rounded-full"
                          style={{ backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }}
                        />
                        <span className="text-muted-foreground">{row.name}</span>
                        <span className="font-medium">{row.count}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </CardContent>
          </Card>
        </FadeIn>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <FadeIn delay={0.3}>
          <Card>
            <CardHeader>
              <CardTitle>Suscripciones por vencer pronto</CardTitle>
            </CardHeader>
            <CardContent>
              <StaggerGroup className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {expiringSoon.map((s) => (
                  <StaggerItem key={s.id}>
                    <EntityCard alert={daysUntil(s.end_date) <= 2} contentClassName="gap-2 p-3">
                      <p className="truncate font-medium">
                        {planNameById.get(s.membership_id) ?? "Plan"}
                      </p>
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs text-muted-foreground">
                          Vence {formatRelativeFutureDate(s.end_date)}
                        </span>
                        <Badge className={urgencyBadgeClass(daysUntil(s.end_date))}>
                          {daysUntil(s.end_date)} día(s)
                        </Badge>
                      </div>
                    </EntityCard>
                  </StaggerItem>
                ))}
                {expiringSoon.length === 0 && (
                  <p className="text-sm text-muted-foreground sm:col-span-2">
                    Ninguna suscripción vence en los próximos 7 días.
                  </p>
                )}
              </StaggerGroup>
            </CardContent>
          </Card>
        </FadeIn>

        <FadeIn delay={0.33}>
          <Card>
            <CardHeader>
              <CardTitle>Pagos recientes</CardTitle>
            </CardHeader>
            <CardContent>
              <StaggerGroup className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {recentPayments.map((p) => (
                  <StaggerItem key={p.id}>
                    <EntityCard contentClassName="gap-2 p-3">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium">{formatCurrency(p.amount)}</span>
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
                {recentPayments.length === 0 && (
                  <p className="text-sm text-muted-foreground sm:col-span-2">Todavía no hay pagos.</p>
                )}
              </StaggerGroup>
            </CardContent>
          </Card>
        </FadeIn>
      </div>
    </div>
  )
}
