import { jsPDF } from "jspdf"
import autoTable from "jspdf-autotable"

import { formatCurrency } from "@/lib/currency"
import { GYM_STATUS_LABELS, PLAN_TIER_LABELS, ROLE_LABELS } from "@/lib/labels"
import type { PlatformOverview, UserRole } from "@/lib/types"

function reportFilename(ext: string) {
  return `reporte-plataforma-${new Date().toISOString().slice(0, 10)}.${ext}`
}

function summaryRows(overview: PlatformOverview): [string, string][] {
  return [
    ["Gimnasios totales", String(overview.gyms_total)],
    ["Gimnasios activos", String(overview.gyms_active)],
    ["Gimnasios en prueba", String(overview.gyms_trial)],
    ["Gimnasios suspendidos", String(overview.gyms_suspended)],
    ["Gimnasios cancelados", String(overview.gyms_cancelled)],
    ["Usuarios totales", String(overview.users_total)],
    ["Ingresos totales (histórico)", formatCurrency(overview.revenue_total)],
    ["Suscripciones activas", String(overview.active_subscriptions)],
    [`Ingresos (últimos ${overview.period_days} días)`, formatCurrency(overview.period_revenue)],
    [`Pagos completados (últimos ${overview.period_days} días)`, String(overview.period_payments_count)],
    [`Check-ins (últimos ${overview.period_days} días)`, String(overview.period_checkins)],
    ["Gimnasios en riesgo", String(overview.gyms_breakdown.filter((g) => g.is_at_risk).length)],
  ]
}

// SUPERADMIN is never tied to a gym_id, so it never shows up in a per-gym
// breakdown — no platform-wide "users by role" total is included anymore
// since every other number in this report is scoped to one gym.
const GYM_ROLE_ORDER: UserRole[] = ["GYM_ADMIN", "TRAINER", "NUTRITIONIST", "MEMBER"]

// One row per registered gym — the platform is billing per tenant, so the
// report's core value is this breakdown, not a platform aggregate.
function gymsBreakdownRows(overview: PlatformOverview): (string | number)[][] {
  return overview.gyms_breakdown
    .slice()
    .sort((a, b) => b.revenue_period - a.revenue_period)
    .map((g) => [
      g.gym_name,
      GYM_STATUS_LABELS[g.status],
      PLAN_TIER_LABELS[g.plan_tier],
      g.users_total,
      ...GYM_ROLE_ORDER.map((role) => g.users_by_role[role] ?? 0),
      g.active_subscriptions,
      formatCurrency(g.revenue_period),
      g.payments_count_period,
      g.checkins_period,
      g.branches_total,
      g.is_at_risk ? "En riesgo" : "Saludable",
    ])
}

const GYMS_BREAKDOWN_HEADER = [
  "Gimnasio",
  "Estado",
  "Plan",
  "Usuarios",
  ...GYM_ROLE_ORDER.map((role) => ROLE_LABELS[role]),
  "Suscripciones activas",
  "Ingresos",
  "Pagos",
  "Check-ins",
  "Sucursales",
  "Salud",
]

export function downloadPlatformReportPdf(overview: PlatformOverview) {
  const doc = new jsPDF()

  doc.setFontSize(16)
  doc.text("GymOps Ai — Reporte de plataforma", 14, 18)
  doc.setFontSize(10)
  doc.setTextColor(120)
  doc.text(
    `Generado el ${new Date().toLocaleString("es-BO")} · Período: últimos ${overview.period_days} días`,
    14,
    25
  )
  doc.setTextColor(0)

  autoTable(doc, {
    startY: 32,
    head: [["Métrica", "Valor"]],
    body: summaryRows(overview),
    styles: { fontSize: 9 },
    headStyles: { fillColor: [99, 102, 241] },
  })

  if (overview.gyms_breakdown.length > 0) {
    autoTable(doc, {
      head: [GYMS_BREAKDOWN_HEADER],
      body: gymsBreakdownRows(overview),
      styles: { fontSize: 8 },
      headStyles: { fillColor: [99, 102, 241] },
    })
  }

  if (overview.revenue_by_day.length > 0) {
    autoTable(doc, {
      head: [["Fecha", "Gimnasio", "Ingresos"]],
      body: overview.revenue_by_day.map((d) => [d.date, d.gym_name, formatCurrency(d.amount)]),
      styles: { fontSize: 9 },
      headStyles: { fillColor: [99, 102, 241] },
    })
  }

  doc.save(reportFilename("pdf"))
}

// Excel opens .csv natively; generating one client-side (instead of pulling
// in a full xlsx-writer library) avoids depending on a package with
// unpatched prototype-pollution/ReDoS advisories for what both apps treat
// as an equivalent "open in a spreadsheet" export.
function csvCell(value: string | number): string {
  const str = String(value)
  return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str
}

function csvSection(title: string, header: string[], rows: (string | number)[][]): string {
  return [title, header.join(","), ...rows.map((r) => r.map(csvCell).join(","))].join("\r\n")
}

export function downloadPlatformReportCsv(overview: PlatformOverview) {
  const sections = [
    csvSection(`Resumen (últimos ${overview.period_days} días)`, ["Métrica", "Valor"], summaryRows(overview)),
    csvSection("Desempeño por gimnasio", GYMS_BREAKDOWN_HEADER, gymsBreakdownRows(overview)),
    csvSection(
      "Ingresos por día y gimnasio",
      ["Fecha", "Gimnasio", "Ingresos"],
      overview.revenue_by_day.map((d) => [d.date, d.gym_name, d.amount.toFixed(2)])
    ),
  ]
  const csv = sections.join("\r\n\r\n")
  // Leading BOM so Excel detects UTF-8 instead of mangling accented labels.
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" })
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.download = reportFilename("csv")
  link.click()
  URL.revokeObjectURL(url)
}
