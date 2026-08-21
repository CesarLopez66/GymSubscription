"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
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
      <h1 className="text-2xl font-semibold tracking-tight">Overview</h1>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Members</CardTitle>
          </CardHeader>
          <CardContent className="text-3xl font-semibold">{members?.total ?? "—"}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Trainers</CardTitle>
          </CardHeader>
          <CardContent className="text-3xl font-semibold">{trainers?.total ?? "—"}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total revenue
            </CardTitle>
          </CardHeader>
          <CardContent className="text-3xl font-semibold">
            {revenue ? formatCurrency(revenue.total_revenue) : "—"}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Recent denied check-ins
            </CardTitle>
          </CardHeader>
          <CardContent className="text-3xl font-semibold">{deniedToday}</CardContent>
        </Card>
      </div>
    </div>
  )
}
