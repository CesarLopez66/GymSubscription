"use client"

import * as React from "react"
import { Flame, ScanLine, TrendingDown, TrendingUp } from "lucide-react"
import { Line, LineChart, ResponsiveContainer, Tooltip as RechartsTooltip, XAxis, YAxis } from "recharts"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { FadeIn } from "@/components/shared/motion"
import { MembershipGate } from "@/components/shared/membership-gate"
import { useCheckIns } from "@/hooks/use-checkins"
import { useEvaluations } from "@/hooks/use-evaluations"

export default function MemberStatsPage() {
  const { data: evaluations } = useEvaluations(undefined, 1, 50)
  const { data: myCheckIns } = useCheckIns(undefined, { pageSize: 90 })

  const streak = React.useMemo(() => {
    const grantedDays = new Set(
      (myCheckIns?.items ?? [])
        .filter((c) => c.access_granted)
        .map((c) => c.timestamp.slice(0, 10))
    )
    const cursor = new Date()
    if (!grantedDays.has(cursor.toISOString().slice(0, 10))) {
      cursor.setDate(cursor.getDate() - 1)
    }
    let count = 0
    while (grantedDays.has(cursor.toISOString().slice(0, 10))) {
      count++
      cursor.setDate(cursor.getDate() - 1)
    }
    return count
  }, [myCheckIns])

  const now = new Date()
  const sessionsThisMonth = (myCheckIns?.items ?? []).filter((c) => {
    const d = new Date(c.timestamp)
    return c.access_granted && d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
  }).length

  const progressData = [...(evaluations?.items ?? [])]
    .sort((a, b) => a.evaluated_at.localeCompare(b.evaluated_at))
    .map((ev) => ({
      date: new Date(ev.evaluated_at).toLocaleDateString("es-BO", { day: "2-digit", month: "2-digit" }),
      weight: Number(ev.weight_kg),
      bodyFat: ev.body_fat_percentage != null ? Number(ev.body_fat_percentage) : null,
    }))

  const first = progressData[0]
  const last = progressData[progressData.length - 1]
  const weightChange = first && last ? Number((last.weight - first.weight).toFixed(1)) : null

  return (
    <MembershipGate>
    <div className="space-y-6">
      <FadeIn>
        <h1 className="flex items-center gap-2 text-lg font-semibold tracking-tight">
          <TrendingUp className="size-5 text-primary" />
          Tu progreso
        </h1>
      </FadeIn>

      <FadeIn delay={0.02}>
        <div className="grid grid-cols-2 gap-3">
          <Card>
            <CardContent className="flex flex-col items-center gap-1 py-4 text-center">
              <Flame className="size-5 text-orange-400" />
              <p className="text-xl font-semibold">{streak}</p>
              <p className="text-xs text-muted-foreground">Días seguidos</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex flex-col items-center gap-1 py-4 text-center">
              <ScanLine className="size-5 text-primary" />
              <p className="text-xl font-semibold">{sessionsThisMonth}</p>
              <p className="text-xs text-muted-foreground">Visitas este mes</p>
            </CardContent>
          </Card>
        </div>
      </FadeIn>

      {weightChange !== null && (
        <FadeIn delay={0.04}>
          <Card>
            <CardContent className="flex items-center justify-between py-4">
              <div>
                <p className="text-xs text-muted-foreground">Cambio de peso</p>
                <p className="text-sm font-medium">Desde tu primera evaluación</p>
              </div>
              <div className="flex items-center gap-1 text-lg font-semibold">
                {weightChange <= 0 ? (
                  <TrendingDown className="size-4 text-emerald-400" />
                ) : (
                  <TrendingUp className="size-4 text-orange-400" />
                )}
                {weightChange > 0 ? "+" : ""}
                {weightChange} kg
              </div>
            </CardContent>
          </Card>
        </FadeIn>
      )}

      <FadeIn delay={0.06}>
        <Card>
          <CardHeader>
            <CardTitle>Peso y % de grasa</CardTitle>
          </CardHeader>
          <CardContent>
            {progressData.length > 1 ? (
              <div className="h-52">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={progressData} margin={{ left: 4, right: 4 }}>
                    <XAxis
                      dataKey="date"
                      tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
                      width={30}
                      axisLine={false}
                      tickLine={false}
                    />
                    <RechartsTooltip />
                    <Line
                      type="monotone"
                      dataKey="weight"
                      name="Peso (kg)"
                      stroke="var(--chart-1)"
                      strokeWidth={2}
                      dot={false}
                    />
                    <Line
                      type="monotone"
                      dataKey="bodyFat"
                      name="% grasa"
                      stroke="var(--chart-2)"
                      strokeWidth={2}
                      dot={false}
                      connectNulls
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                Necesitas al menos 2 evaluaciones físicas registradas para ver tu progreso.
              </p>
            )}
          </CardContent>
        </Card>
      </FadeIn>
    </div>
    </MembershipGate>
  )
}
