"use client"

import * as React from "react"
import {
  Bar,
  BarChart,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from "recharts"
import {
  AlertTriangle,
  Banknote,
  Building2,
  CalendarCheck,
  FileSpreadsheet,
  FileText,
  Receipt,
  TrendingDown,
  TrendingUp,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { GymFilter } from "@/components/shared/gym-filter"
import { FadeIn } from "@/components/shared/motion"
import { PageHero } from "@/components/shared/page-hero"
import { LoadingOverlay } from "@/components/shared/refetching-indicator"
import { StatCard } from "@/components/shared/stat-card"
import { useAuthStore } from "@/store/auth-store"
import { useSuperAdminFilterStore } from "@/store/superadmin-filter-store"
import { GYM_STATUS_BADGE_CLASSES, riskBadgeClass } from "@/lib/badge-colors"
import { formatCurrency } from "@/lib/currency"
import { GYM_STATUS_LABELS, PLAN_TIER_LABELS, ROLE_LABELS } from "@/lib/labels"
import { downloadPlatformReportCsv, downloadPlatformReportPdf } from "@/lib/platform-report"
import type { UserRole } from "@/lib/types"
import { useSuperAdminOverview } from "@/hooks/use-superadmin"

const CHART_COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
]

const RANGE_OPTIONS = [
  { value: "7", label: "7 días" },
  { value: "30", label: "30 días" },
  { value: "90", label: "90 días" },
  { value: "365", label: "1 año" },
]

// SUPERADMIN is intentionally excluded: it's never tied to a gym_id, so it
// never appears in a per-gym breakdown.
const GYM_ROLE_ORDER: UserRole[] = ["GYM_ADMIN", "TRAINER", "NUTRITIONIST", "MEMBER"]

export default function SuperAdminPage() {
  const user = useAuthStore((s) => s.user)
  const [range, setRange] = React.useState("30")
  const gymId = useSuperAdminFilterStore((s) => s.gymId)
  const {
    data: overview,
    isFetching: overviewFetching,
    isLoading: overviewLoading,
  } = useSuperAdminOverview(Number(range), gymId)

  const gymStatusData = overview
    ? [
        { name: GYM_STATUS_LABELS.ACTIVE, value: overview.gyms_active },
        { name: GYM_STATUS_LABELS.TRIAL, value: overview.gyms_trial },
        { name: GYM_STATUS_LABELS.SUSPENDED, value: overview.gyms_suspended },
        { name: GYM_STATUS_LABELS.CANCELLED, value: overview.gyms_cancelled },
      ].filter((d) => d.value > 0)
    : []

  // Users by role, per gym — replaces a single platform-wide bar with one
  // stacked bar per tenant, since every metric on this page needs to be
  // traceable back to a specific paying gym.
  const usersByGymData = (overview?.gyms_breakdown ?? []).map((g) => ({
    gym: g.gym_name,
    ...g.users_by_role,
  }))

  // revenue_by_day comes as (date, gym) rows — pivot into one row per date
  // with a column per gym, so each tenant gets its own series on the chart
  // instead of a single blended platform total.
  const gymNames = React.useMemo(
    () => Array.from(new Set((overview?.revenue_by_day ?? []).map((d) => d.gym_name))),
    [overview]
  )
  const revenueByDayData = React.useMemo(() => {
    const byDate = new Map<string, Record<string, number | string>>()
    for (const d of overview?.revenue_by_day ?? []) {
      const row =
        byDate.get(d.date) ??
        ({
          date: new Date(d.date).toLocaleDateString("es-BO", { day: "2-digit", month: "2-digit" }),
        } as Record<string, number | string>)
      row[d.gym_name] = d.amount
      byDate.set(d.date, row)
    }
    // A gym with no revenue on a given day is simply absent from that row —
    // left as `undefined`, a stacked Area treats it as a break in the line
    // instead of zero, so the chart shows floating disconnected segments
    // rather than a continuous (flat-at-zero) area. Zero-fill every gym for
    // every date before handing the data to recharts.
    const rows = Array.from(byDate.values())
    for (const row of rows) {
      for (const name of gymNames) {
        if (!(name in row)) row[name] = 0
      }
    }
    return rows
  }, [overview, gymNames])

  // Payments (and therefore revenue_by_day points) land unevenly across a
  // wide range — recharts' automatic label-fitting on a sparse categorical
  // axis picks an arbitrary-looking subset of ticks otherwise (a run of
  // close dates, then a big unlabeled stretch). A fixed step keeps at most
  // ~7 evenly-spaced labels no matter how the underlying dates are spread.
  const xAxisInterval = Math.max(0, Math.ceil(revenueByDayData.length / 7) - 1)

  const gymsBreakdown = overview?.gyms_breakdown ?? []

  return (
    <div className="space-y-6">
      <LoadingOverlay show={overviewFetching && !overviewLoading} />
      <PageHero
        title={`Hola, ${user?.first_name ?? "Super admin"} 👋`}
        subtitle="Vista general de la plataforma"
      />

      <FadeIn>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <GymFilter />
            <Tabs value={range} onValueChange={(v) => v && setRange(v)}>
              <TabsList>
                {RANGE_OPTIONS.map((opt) => (
                  <TabsTrigger key={opt.value} value={opt.value}>
                    {opt.label}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={!overview}
              onClick={() => overview && downloadPlatformReportPdf(overview)}
            >
              <FileText className="size-4" />
              Descargar PDF
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={!overview}
              onClick={() => overview && downloadPlatformReportCsv(overview)}
            >
              <FileSpreadsheet className="size-4" />
              Descargar Excel
            </Button>
          </div>
        </div>
      </FadeIn>

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard
          label="Ingresos"
          value={overview?.period_revenue}
          icon={Banknote}
          format={formatCurrency}
          delay={0}
        />
        <StatCard
          label="Pagos completados"
          value={overview?.period_payments_count}
          icon={Receipt}
          delay={0.05}
        />
        <StatCard
          label="Check-ins"
          value={overview?.period_checkins}
          icon={CalendarCheck}
          delay={0.1}
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <FadeIn delay={0.05} className="xl:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Ingresos por gimnasio ({range === "365" ? "1 año" : `${range} días`})</CardTitle>
            </CardHeader>
            <CardContent>
              {revenueByDayData.length > 0 ? (
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={revenueByDayData} margin={{ left: 4, right: 4 }}>
                      <XAxis
                        dataKey="date"
                        tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                        axisLine={false}
                        tickLine={false}
                        interval={xAxisInterval}
                      />
                      <YAxis
                        tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                        width={40}
                        axisLine={false}
                        tickLine={false}
                      />
                      <RechartsTooltip formatter={(value) => formatCurrency(Number(value))} cursor={{ fill: "var(--muted)", opacity: 0.3 }} />
                      <Legend wrapperStyle={{ fontSize: 12 }} />
                      {gymNames.map((name, index) => (
                        <Bar
                          key={name}
                          dataKey={name}
                          name={name}
                          fill={CHART_COLORS[index % CHART_COLORS.length]}
                          radius={[3, 3, 0, 0]}
                          maxBarSize={28}
                        />
                      ))}
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Todavía no hay ingresos en este período.</p>
              )}
            </CardContent>
          </Card>
        </FadeIn>

        <FadeIn delay={0.1}>
          <Card>
            <CardHeader>
              <CardTitle>Gimnasios por estado</CardTitle>
            </CardHeader>
            <CardContent>
              {gymStatusData.length > 0 ? (
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={gymStatusData}
                        dataKey="value"
                        nameKey="name"
                        innerRadius={60}
                        outerRadius={100}
                        paddingAngle={2}
                      >
                        {gymStatusData.map((_, index) => (
                          <Cell key={index} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                        ))}
                      </Pie>
                      <RechartsTooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Todavía no hay gimnasios.</p>
              )}
            </CardContent>
          </Card>
        </FadeIn>

        <FadeIn delay={0.15} className="xl:col-span-3">
          <Card>
            <CardHeader>
              <CardTitle>Usuarios por gimnasio</CardTitle>
            </CardHeader>
            <CardContent>
              {usersByGymData.length > 0 ? (
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={usersByGymData} margin={{ left: 4, right: 4 }}>
                      <XAxis
                        dataKey="gym"
                        tick={{ fontSize: 12, fill: "var(--muted-foreground)" }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <YAxis
                        allowDecimals={false}
                        tick={{ fontSize: 12, fill: "var(--muted-foreground)" }}
                        width={30}
                        axisLine={false}
                        tickLine={false}
                      />
                      <RechartsTooltip />
                      {GYM_ROLE_ORDER.map((role, index) => (
                        <Bar
                          key={role}
                          dataKey={role}
                          name={ROLE_LABELS[role]}
                          stackId="users"
                          fill={CHART_COLORS[index % CHART_COLORS.length]}
                          radius={index === GYM_ROLE_ORDER.length - 1 ? [6, 6, 0, 0] : undefined}
                          maxBarSize={80}
                        />
                      ))}
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Todavía no hay usuarios registrados.</p>
              )}
            </CardContent>
          </Card>
        </FadeIn>
      </div>

      <FadeIn delay={0.2}>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="size-4" />
              Desempeño por gimnasio ({range === "365" ? "1 año" : `${range} días`})
            </CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            {gymsBreakdown.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Gimnasio</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>Plan</TableHead>
                    <TableHead className="text-right">Usuarios</TableHead>
                    {GYM_ROLE_ORDER.map((role) => (
                      <TableHead key={role} className="text-right">
                        {ROLE_LABELS[role]}
                      </TableHead>
                    ))}
                    <TableHead className="text-right">Suscripciones activas</TableHead>
                    <TableHead className="text-right">Ingresos</TableHead>
                    <TableHead className="text-right">Pagos</TableHead>
                    <TableHead className="text-right">Check-ins</TableHead>
                    <TableHead className="text-right">Sucursales</TableHead>
                    <TableHead>Riesgo</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {gymsBreakdown
                    .slice()
                    .sort((a, b) => b.revenue_period - a.revenue_period)
                    .map((g) => (
                      <TableRow key={g.gym_id} className={g.is_at_risk ? "bg-destructive/5" : undefined}>
                        <TableCell className="font-medium">{g.gym_name}</TableCell>
                        <TableCell>
                          <Badge className={GYM_STATUS_BADGE_CLASSES[g.status]}>
                            {GYM_STATUS_LABELS[g.status]}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary">{PLAN_TIER_LABELS[g.plan_tier]}</Badge>
                        </TableCell>
                        <TableCell className="text-right">{g.users_total}</TableCell>
                        {GYM_ROLE_ORDER.map((role) => (
                          <TableCell key={role} className="text-right text-muted-foreground">
                            {g.users_by_role[role] ?? 0}
                          </TableCell>
                        ))}
                        <TableCell className="text-right">{g.active_subscriptions}</TableCell>
                        <TableCell className="text-right font-medium">
                          {formatCurrency(g.revenue_period)}
                        </TableCell>
                        <TableCell className="text-right">{g.payments_count_period}</TableCell>
                        <TableCell className="text-right">
                          <span className="inline-flex items-center gap-1">
                            {g.checkins_period}
                            {g.checkins_trend_pct !== null &&
                              (g.checkins_trend_pct >= 0 ? (
                                <TrendingUp className="size-3 text-emerald-400" />
                              ) : (
                                <TrendingDown className="size-3 text-red-400" />
                              ))}
                          </span>
                        </TableCell>
                        <TableCell className="text-right">{g.branches_total}</TableCell>
                        <TableCell>
                          <Badge className={riskBadgeClass(g.is_at_risk)}>
                            {g.is_at_risk ? (
                              <span className="inline-flex items-center gap-1">
                                <AlertTriangle className="size-3" />
                                En riesgo
                              </span>
                            ) : (
                              "Saludable"
                            )}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                </TableBody>
              </Table>
            ) : (
              <p className="text-sm text-muted-foreground">Todavía no hay gimnasios registrados.</p>
            )}
          </CardContent>
        </Card>
      </FadeIn>
    </div>
  )
}
