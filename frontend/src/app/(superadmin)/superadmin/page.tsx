"use client"

import * as React from "react"
import Link from "next/link"
import { ChevronRight, Download, FileSpreadsheet, FileText } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { GymFilter } from "@/components/shared/gym-filter"
import { FadeIn } from "@/components/shared/motion"
import { LoadingOverlay } from "@/components/shared/refetching-indicator"
import { useSuperAdminFilterStore } from "@/store/superadmin-filter-store"
import { formatCurrency } from "@/lib/currency"
import { formatToday } from "@/lib/format"
import { GYM_STATUS_LABELS, PLAN_TIER_LABELS } from "@/lib/labels"
import { downloadPlatformReportCsv, downloadPlatformReportPdf } from "@/lib/platform-report"
import type { PlatformOverview, SaaSPlanTier } from "@/lib/types"
import { cn } from "@/lib/utils"
import { useSubscriptionPayments } from "@/hooks/use-gym-subscriptions"
import { useSuperAdminOverview } from "@/hooks/use-superadmin"
import { GymPerformanceTable } from "./gym-performance-table"
import { RevenueChart } from "./revenue-chart"

const RANGE_OPTIONS = [
  { value: "7", label: "7 días" },
  { value: "30", label: "30 días" },
  { value: "90", label: "90 días" },
  { value: "365", label: "1 año" },
]

const PLAN_TIERS: SaaSPlanTier[] = ["FREE", "BASIC", "PRO", "ENTERPRISE"]

const panelClass = "rounded-2xl bg-card/75 p-5 shadow-lg shadow-black/20 ring-1 ring-foreground/10 backdrop-blur-md"

export default function SuperAdminPage() {
  const [range, setRange] = React.useState("30")
  const gymId = useSuperAdminFilterStore((s) => s.gymId)
  const {
    data: overview,
    isFetching: overviewFetching,
    isLoading: overviewLoading,
  } = useSuperAdminOverview(Number(range), gymId)

  const breakdown = overview?.gyms_breakdown ?? []
  const selectedGym = gymId ? breakdown.find((g) => g.gym_id === gymId) : undefined
  const rangeLabel = RANGE_OPTIONS.find((o) => o.value === range)?.label ?? `${range} días`

  return (
    <div className="space-y-6">
      <LoadingOverlay show={overviewFetching && !overviewLoading} />

      <FadeIn>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-[26px] leading-tight font-semibold tracking-tight">
              {selectedGym ? selectedGym.gym_name : "Plataforma"}
            </h1>
            <p className="text-sm text-muted-foreground">
              {formatToday()} · últimos {rangeLabel === "1 año" ? "12 meses" : rangeLabel}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Tabs value={range} onValueChange={(v) => v && setRange(v)}>
              <TabsList className="h-9!" aria-label="Periodo">
                {RANGE_OPTIONS.map((opt) => (
                  <TabsTrigger key={opt.value} value={opt.value} className="px-3">
                    {opt.label}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
            <GymFilter />
            <ReportDialog overview={overview} />
          </div>
        </div>
      </FadeIn>

      {overviewLoading || !overview ? (
        <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-32 rounded-2xl" />
          ))}
        </div>
      ) : (
        <>
          <FadeIn delay={0.02}>
            <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
              <Kpi
                label="Ingresos de la plataforma"
                value={formatCurrency(overview.platform_revenue_period)}
                detail={`Suscripciones de gimnasios · ${rangeLabel}`}
              />
              <Kpi
                label="Gimnasios activos"
                value={String(overview.gyms_active)}
                suffix={`de ${overview.gyms_total}`}
                detail={[
                  overview.gyms_trial && `${overview.gyms_trial} en prueba`,
                  overview.gyms_suspended && `${overview.gyms_suspended} suspendido${overview.gyms_suspended === 1 ? "" : "s"}`,
                  overview.gyms_cancelled && `${overview.gyms_cancelled} cancelado${overview.gyms_cancelled === 1 ? "" : "s"}`,
                ]
                  .filter(Boolean)
                  .join(" · ") || "Todos al día"}
              />
              <Kpi
                label="Membresías activas"
                value={overview.active_subscriptions.toLocaleString("es-BO")}
                detail={`${overview.users_total.toLocaleString("es-BO")} usuarios en total`}
              />
              <Kpi
                label="Check-ins"
                value={overview.period_checkins.toLocaleString("es-BO")}
                detail={`En los últimos ${rangeLabel === "1 año" ? "12 meses" : rangeLabel}`}
              />
            </div>
          </FadeIn>

          <FadeIn delay={0.04}>
            <div className="flex flex-wrap gap-3">
              <section className={cn(panelClass, "min-w-0 flex-[2_1_480px] space-y-4")}>
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <h2 className="font-heading text-lg font-medium">Cobros de los gimnasios</h2>
                  <span className="text-[13px] text-muted-foreground">
                    Total {formatCurrency(overview.period_revenue)} · pagos de miembros completados
                  </span>
                </div>
                <RevenueChart data={overview.revenue_by_day} days={Number(range)} />
              </section>
              <AttentionPanel overview={overview} />
            </div>
          </FadeIn>

          <FadeIn delay={0.06}>
            <div className="flex flex-wrap gap-3">
              <GymStatusBar overview={overview} />
              {!selectedGym && <PlanTiers overview={overview} />}
            </div>
          </FadeIn>

          <FadeIn delay={0.08}>
            <section className={cn(panelClass, "p-0")}>
              <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
                <h2 className="font-heading text-lg font-medium">Desempeño por gimnasio</h2>
                {!selectedGym && breakdown.length > 0 && (
                  <Link href="/superadmin/gyms" className="text-[13px] font-medium text-primary hover:underline">
                    Ver los {overview.gyms_total} gimnasios
                  </Link>
                )}
              </div>
              <GymPerformanceTable overview={overview} />
            </section>
          </FadeIn>
        </>
      )}
    </div>
  )
}

function Kpi({ label, value, suffix, detail }: { label: string; value: string; suffix?: string; detail: string }) {
  return (
    <div className={cn(panelClass, "flex min-w-0 flex-col gap-2 p-4 sm:p-4.5")}>
      <span className="text-[13px] font-medium text-muted-foreground sm:text-sm">{label}</span>
      <span className="text-2xl leading-8 font-semibold tracking-tight tabular-nums sm:text-[30px] sm:leading-9">
        {value}
        {suffix && <span className="ml-1.5 text-base font-medium text-muted-foreground">{suffix}</span>}
      </span>
      <span className="text-[13px] text-muted-foreground">{detail}</span>
    </div>
  )
}

type Tone = "danger" | "warning" | "neutral"

const TONE_CLASSES: Record<Tone, { box: string; bar: string }> = {
  danger: { box: "bg-red-500/10", bar: "bg-red-400" },
  warning: { box: "bg-amber-500/10", bar: "bg-amber-400" },
  neutral: { box: "bg-foreground/3", bar: "bg-chart-5" },
}

function AttentionPanel({ overview }: { overview: PlatformOverview }) {
  const { data: pendingRequests } = useSubscriptionPayments("PENDING", 1, 1)
  const gyms = overview.gyms_breakdown
  const names = (list: typeof gyms) =>
    list.length <= 3 ? list.map((g) => g.gym_name).join(", ") : `${list.slice(0, 2).map((g) => g.gym_name).join(", ")} y ${list.length - 2} más`

  const suspended = gyms.filter((g) => g.status === "SUSPENDED")
  const trialExpired = gyms.filter((g) => g.is_trial_expired && g.status !== "SUSPENDED")
  const atRisk = gyms.filter((g) => g.is_at_risk && g.status !== "SUSPENDED")
  const failedPayments = gyms.reduce((sum, g) => sum + g.failed_payments_period, 0)
  const failedGyms = gyms.filter((g) => g.failed_payments_period > 0)
  const expiring = gyms.reduce((sum, g) => sum + g.expiring_subscriptions_7d, 0)
  const pendingCount = pendingRequests?.total ?? 0

  const items: { key: string; tone: Tone; title: string; detail: string; href: string }[] = []
  if (suspended.length)
    items.push({
      key: "suspended",
      tone: "danger",
      title: `${suspended.length} ${suspended.length === 1 ? "gimnasio suspendido" : "gimnasios suspendidos"}`,
      detail: names(suspended),
      href: "/superadmin/gyms",
    })
  if (trialExpired.length)
    items.push({
      key: "trial",
      tone: "danger",
      title: `${trialExpired.length} ${trialExpired.length === 1 ? "prueba vencida" : "pruebas vencidas"} sin pago`,
      detail: names(trialExpired),
      href: "/superadmin/gyms",
    })
  if (pendingCount)
    items.push({
      key: "requests",
      tone: "warning",
      title: `${pendingCount} ${pendingCount === 1 ? "solicitud de suscripción" : "solicitudes de suscripción"}`,
      detail: "Comprobantes esperando revisión",
      href: "/superadmin/subscriptions",
    })
  if (atRisk.length)
    items.push({
      key: "risk",
      tone: "warning",
      title: `${atRisk.length} ${atRisk.length === 1 ? "gimnasio en riesgo" : "gimnasios en riesgo"}`,
      detail: names(atRisk),
      href: "/superadmin/gyms",
    })
  if (failedPayments)
    items.push({
      key: "failed",
      tone: "neutral",
      title: `${failedPayments} ${failedPayments === 1 ? "pago fallido" : "pagos fallidos"}`,
      detail: `En ${failedGyms.length} ${failedGyms.length === 1 ? "gimnasio" : "gimnasios"}`,
      href: "/superadmin/gyms",
    })
  if (expiring)
    items.push({
      key: "expiring",
      tone: "neutral",
      title: `${expiring} ${expiring === 1 ? "membresía vence" : "membresías vencen"} en 7 días`,
      detail: "Miembros de todos los gimnasios",
      href: "/superadmin/gyms",
    })

  return (
    <section className={cn(panelClass, "min-w-0 flex-[1_1_320px] space-y-3")}>
      <div className="flex items-baseline justify-between">
        <h2 className="font-heading text-lg font-medium">Requiere atención</h2>
        <span className="text-[13px] text-muted-foreground">
          {items.length === 0 ? "Nada pendiente" : `${items.length} ${items.length === 1 ? "asunto" : "asuntos"}`}
        </span>
      </div>
      {items.length === 0 && (
        <p className="rounded-xl bg-emerald-500/10 p-3 text-sm text-emerald-400">
          Todos los gimnasios están al día.
        </p>
      )}
      <ul className="space-y-2">
        {items.map((item) => (
          <li key={item.key}>
            <Link
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-xl p-3 transition-colors hover:bg-foreground/5",
                TONE_CLASSES[item.tone].box
              )}
            >
              <span className={cn("h-9 w-1.5 shrink-0 rounded-full", TONE_CLASSES[item.tone].bar)} />
              <span className="min-w-0 flex-1">
                <span className="block font-medium">{item.title}</span>
                <span className="block truncate text-[13px] text-muted-foreground">{item.detail}</span>
              </span>
              <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}

function GymStatusBar({ overview }: { overview: PlatformOverview }) {
  const segments = [
    { label: GYM_STATUS_LABELS.ACTIVE, value: overview.gyms_active, color: "bg-emerald-400" },
    { label: GYM_STATUS_LABELS.TRIAL, value: overview.gyms_trial, color: "bg-amber-400" },
    { label: GYM_STATUS_LABELS.SUSPENDED, value: overview.gyms_suspended, color: "bg-red-400" },
    { label: GYM_STATUS_LABELS.CANCELLED, value: overview.gyms_cancelled, color: "bg-chart-5" },
  ]
  const total = segments.reduce((sum, s) => sum + s.value, 0)

  return (
    <section className={cn(panelClass, "min-w-0 flex-[1_1_360px] space-y-3.5")}>
      <h2 className="font-heading text-lg font-medium">Gimnasios por estado</h2>
      {total === 0 ? (
        <p className="text-sm text-muted-foreground">Todavía no hay gimnasios.</p>
      ) : (
        <>
          <div className="flex h-3 gap-0.75 overflow-hidden rounded-full" role="img" aria-label={segments.map((s) => `${s.label}: ${s.value}`).join(", ")}>
            {segments
              .filter((s) => s.value > 0)
              .map((s) => (
                <div key={s.label} className={s.color} style={{ flexGrow: s.value }} />
              ))}
          </div>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-2.5 text-[13px]">
            {segments.map((s) => (
              <div key={s.label} className="flex items-center gap-2">
                <span className={cn("size-2.5 rounded-[3px]", s.color)} />
                <dt>{s.label}</dt>
                <dd className="ml-auto font-semibold tabular-nums">{s.value}</dd>
              </div>
            ))}
          </dl>
        </>
      )}
    </section>
  )
}

function PlanTiers({ overview }: { overview: PlatformOverview }) {
  const counts = PLAN_TIERS.map((tier) => ({
    tier,
    count: overview.gyms_breakdown.filter((g) => g.plan_tier === tier).length,
  }))
  const top = Math.max(...counts.map((c) => c.count))

  return (
    <section className={cn(panelClass, "min-w-0 flex-[1_1_360px] space-y-3.5")}>
      <h2 className="font-heading text-lg font-medium">Planes contratados</h2>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {counts.map(({ tier, count }) => (
          <div
            key={tier}
            className={cn(
              "rounded-xl bg-muted p-3",
              count > 0 && count === top && "bg-primary/15 ring-1 ring-primary/40"
            )}
          >
            <div className="text-[13px] text-muted-foreground">{PLAN_TIER_LABELS[tier]}</div>
            <div className="text-[22px] font-semibold tabular-nums">{count}</div>
          </div>
        ))}
      </div>
    </section>
  )
}

function ReportDialog({ overview }: { overview: PlatformOverview | undefined }) {
  const [open, setOpen] = React.useState(false)
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="lg" disabled={!overview} />}>
        <Download className="size-4" />
        Descargar reporte
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Descargar reporte</DialogTitle>
          <DialogDescription>Elige el formato del archivo.</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button
            variant="outline"
            size="lg"
            className="h-12 flex-1"
            onClick={() => {
              if (!overview) return
              downloadPlatformReportPdf(overview)
              setOpen(false)
            }}
          >
            <FileText className="size-4 text-red-400" />
            PDF
          </Button>
          <Button
            variant="outline"
            size="lg"
            className="h-12 flex-1"
            onClick={() => {
              if (!overview) return
              downloadPlatformReportCsv(overview)
              setOpen(false)
            }}
          >
            <FileSpreadsheet className="size-4 text-emerald-400" />
            Excel
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
