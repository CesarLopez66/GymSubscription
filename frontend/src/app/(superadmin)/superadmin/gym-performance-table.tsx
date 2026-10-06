"use client"

import { TrendingDown, TrendingUp } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { GYM_STATUS_BADGE_CLASSES, red } from "@/lib/badge-colors"
import { formatCurrency } from "@/lib/currency"
import { GYM_STATUS_LABELS, PLAN_TIER_LABELS } from "@/lib/labels"
import type { PlatformOverview } from "@/lib/types"

const MAX_ROWS = 8

// No Card wrapper — the dashboard section this renders inside already
// provides the container and the title. Only the columns the superadmin
// scans for are here; the per-role user counts live on each gym's page.
export function GymPerformanceTable({ overview }: { overview: PlatformOverview | undefined }) {
  const rows = (overview?.gyms_breakdown ?? [])
    .slice()
    .sort((a, b) => b.platform_revenue_period - a.platform_revenue_period)
    .slice(0, MAX_ROWS)

  if (rows.length === 0) {
    return <p className="px-5 pb-5 text-sm text-muted-foreground">Todavía no hay gimnasios registrados.</p>
  }

  return (
    <div className="overflow-x-auto">
      <Table className="min-w-190">
        <TableHeader>
          <TableRow className="text-xs tracking-wide uppercase">
            <TableHead className="pl-5">Gimnasio</TableHead>
            <TableHead>Plan</TableHead>
            <TableHead>Estado</TableHead>
            <TableHead className="text-right">Miembros</TableHead>
            <TableHead className="text-right">Membresías activas</TableHead>
            <TableHead className="text-right">Ingresos plataforma</TableHead>
            <TableHead className="pr-5 text-right">Check-ins</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody className="tabular-nums">
          {rows.map((g) => (
            <TableRow key={g.gym_id}>
              <TableCell className="py-3 pl-5 font-medium">
                <span className="flex items-center gap-2">
                  {g.gym_name}
                  {g.is_at_risk && <Badge className={red}>En riesgo</Badge>}
                </span>
              </TableCell>
              <TableCell>{PLAN_TIER_LABELS[g.plan_tier]}</TableCell>
              <TableCell>
                <Badge className={GYM_STATUS_BADGE_CLASSES[g.status]}>{GYM_STATUS_LABELS[g.status]}</Badge>
              </TableCell>
              <TableCell className="text-right">{g.users_by_role.MEMBER ?? 0}</TableCell>
              <TableCell className="text-right">{g.active_subscriptions}</TableCell>
              <TableCell className="text-right font-medium">{formatCurrency(g.platform_revenue_period)}</TableCell>
              <TableCell className="pr-5 text-right">
                <span className="inline-flex items-center gap-1.5">
                  {g.checkins_period.toLocaleString("es-BO")}
                  {g.checkins_trend_pct !== null &&
                    (g.checkins_trend_pct >= 0 ? (
                      <TrendingUp className="size-3.5 text-emerald-400" aria-label="En alza" />
                    ) : (
                      <TrendingDown className="size-3.5 text-red-400" aria-label="En baja" />
                    ))}
                </span>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
