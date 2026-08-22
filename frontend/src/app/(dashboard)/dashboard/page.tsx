"use client"

import { Banknote, ShieldAlert, Users, Dumbbell } from "lucide-react"

import { FadeIn } from "@/components/shared/motion"
import { StatCard } from "@/components/shared/stat-card"
import { useUsers } from "@/hooks/use-users"
import { useRevenueSummary } from "@/hooks/use-payments"
import { useCheckIns } from "@/hooks/use-checkins"

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value)
}

export default function DashboardOverviewPage() {
  const { data: members } = useUsers("MEMBER", 1, 1)
  const { data: trainers } = useUsers("TRAINER", 1, 1)
  const { data: revenue } = useRevenueSummary()
  const { data: checkIns } = useCheckIns(undefined)

  const deniedToday = (checkIns?.items ?? []).filter((c) => !c.access_granted).length

  return (
    <div className="space-y-6">
      <FadeIn>
        <h1 className="text-2xl font-semibold tracking-tight">Resumen</h1>
      </FadeIn>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Miembros" value={members?.total} icon={Users} delay={0} />
        <StatCard label="Entrenadores" value={trainers?.total} icon={Dumbbell} delay={0.05} />
        <StatCard
          label="Ingresos totales"
          value={revenue?.total_revenue}
          icon={Banknote}
          format={formatCurrency}
          delay={0.1}
        />
        <StatCard
          label="Check-ins denegados recientes"
          value={deniedToday}
          icon={ShieldAlert}
          delay={0.15}
        />
      </div>
    </div>
  )
}
