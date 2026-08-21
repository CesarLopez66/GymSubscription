"use client"

import * as React from "react"
import { QRCodeSVG } from "qrcode.react"
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip as RechartsTooltip } from "recharts"

import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Progress } from "@/components/ui/progress"
import { RestTimer } from "@/components/shared/rest-timer"
import type { DayOfWeek } from "@/lib/types"
import { useNutritionPlans } from "@/hooks/use-nutrition"
import { useWorkoutPlans } from "@/hooks/use-workouts"
import { useAuthStore } from "@/store/auth-store"

const DAY_NAMES: DayOfWeek[] = [
  "SUNDAY",
  "MONDAY",
  "TUESDAY",
  "WEDNESDAY",
  "THURSDAY",
  "FRIDAY",
  "SATURDAY",
]

const MACRO_COLORS = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)"]

const MACRO_LABELS: Record<"protein" | "carbs" | "fats", string> = {
  protein: "Proteína",
  carbs: "Carbohidratos",
  fats: "Grasas",
}

function todayKey() {
  return new Date().toISOString().slice(0, 10)
}

function useLocalStorageState<T>(key: string, initial: T) {
  const [value, setValue] = React.useState<T>(initial)
  const [loaded, setLoaded] = React.useState(false)

  React.useEffect(() => {
    // Reading localStorage (an external system unavailable during SSR) is
    // exactly what this effect is for; deferring past the first render also
    // avoids a hydration mismatch.
    try {
      const raw = localStorage.getItem(key)
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (raw) setValue(JSON.parse(raw))
    } catch {
      // ignore malformed storage
    }
    setLoaded(true)
  }, [key])

  React.useEffect(() => {
    if (!loaded) return
    localStorage.setItem(key, JSON.stringify(value))
  }, [key, value, loaded])

  return [value, setValue] as const
}

export default function MemberDashboardPage() {
  const user = useAuthStore((s) => s.user)
  const { data: workoutPlans } = useWorkoutPlans()
  const { data: nutritionPlans } = useNutritionPlans()

  const todayName = DAY_NAMES[new Date().getDay()]
  const activePlan = workoutPlans?.items.find((p) => p.is_active)
  const todaysItems = (activePlan?.items ?? []).filter(
    (item) => item.day_of_week === todayName
  )

  const [completedSets, setCompletedSets] = useLocalStorageState<Record<string, boolean>>(
    `subgym:workout:${todayKey()}`,
    {}
  )

  const activeNutritionPlan = nutritionPlans?.items.find((p) => p.is_active)
  const [loggedGrams, setLoggedGrams] = useLocalStorageState<{
    protein: number
    carbs: number
    fats: number
  }>(`subgym:macros:${todayKey()}`, { protein: 0, carbs: 0, fats: 0 })

  const macroData = activeNutritionPlan
    ? [
        { name: "Proteína", grams: activeNutritionPlan.protein_g },
        { name: "Carbohidratos", grams: activeNutritionPlan.carbs_g },
        { name: "Grasas", grams: activeNutritionPlan.fats_g },
      ]
    : []

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="text-center">
          <CardTitle>Código QR de acceso</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col items-center gap-2">
          {user && <QRCodeSVG value={user.id} size={180} />}
          <p className="text-xs text-muted-foreground">
            Muestra esto en recepción para hacer check-in
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Rutina de hoy</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {!activePlan && (
            <p className="text-sm text-muted-foreground">
              Todavía no tienes una rutina asignada.
            </p>
          )}
          {activePlan && todaysItems.length === 0 && (
            <p className="text-sm text-muted-foreground">
              Día de descanso — nada programado hoy.
            </p>
          )}
          {todaysItems.map((item) => (
            <div key={item.id} className="flex items-center justify-between rounded-md border p-3">
              <div className="flex items-center gap-3">
                <Checkbox
                  checked={!!completedSets[item.id]}
                  onCheckedChange={(checked) =>
                    setCompletedSets((prev) => ({ ...prev, [item.id]: checked === true }))
                  }
                />
                <div>
                  <p
                    className={
                      completedSets[item.id]
                        ? "text-sm font-medium line-through text-muted-foreground"
                        : "text-sm font-medium"
                    }
                  >
                    {item.exercise.name}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {item.sets} × {item.reps}
                    {item.rpe ? ` @ RPE ${item.rpe}` : ""}
                  </p>
                </div>
              </div>
              {item.rest_seconds ? <RestTimer seconds={item.rest_seconds} /> : null}
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>
            Nutrición de hoy
            {activeNutritionPlan && (
              <Badge variant="secondary" className="ml-2">
                Meta: {activeNutritionPlan.calories} kcal
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {!activeNutritionPlan && (
            <p className="text-sm text-muted-foreground">
              Todavía no tienes un plan de nutrición activo.
            </p>
          )}
          {activeNutritionPlan && (
            <>
              <div className="h-40">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={macroData}
                      dataKey="grams"
                      nameKey="name"
                      innerRadius={35}
                      outerRadius={60}
                      paddingAngle={2}
                    >
                      {macroData.map((_, index) => (
                        <Cell key={index} fill={MACRO_COLORS[index % MACRO_COLORS.length]} />
                      ))}
                    </Pie>
                    <RechartsTooltip formatter={(value) => `${value} g`} />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              <div className="space-y-3">
                {(
                  [
                    ["protein", activeNutritionPlan.protein_g] as const,
                    ["carbs", activeNutritionPlan.carbs_g] as const,
                    ["fats", activeNutritionPlan.fats_g] as const,
                  ]
                ).map(([key, target]) => (
                  <div key={key} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <Label>{MACRO_LABELS[key]}</Label>
                      <span className="text-muted-foreground">
                        {loggedGrams[key]} / {target} g
                      </span>
                    </div>
                    <Progress value={Math.min(100, (loggedGrams[key] / target) * 100)} />
                    <Input
                      type="number"
                      className="mt-1 h-8"
                      value={loggedGrams[key]}
                      onChange={(e) =>
                        setLoggedGrams((prev) => ({
                          ...prev,
                          [key]: Number(e.target.value) || 0,
                        }))
                      }
                    />
                  </div>
                ))}
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
