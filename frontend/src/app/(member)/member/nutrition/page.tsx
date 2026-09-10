"use client"

import { Apple } from "lucide-react"
import {
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
} from "recharts"

import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Progress } from "@/components/ui/progress"
import { FadeIn } from "@/components/shared/motion"
import { MembershipGate } from "@/components/shared/membership-gate"
import { useNutritionLog, useNutritionPlans, useUpsertNutritionLog } from "@/hooks/use-nutrition"

const MACRO_COLORS = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)"]

const MACRO_LABELS: Record<"protein" | "carbs" | "fats", string> = {
  protein: "Proteína",
  carbs: "Carbohidratos",
  fats: "Grasas",
}

function todayKey() {
  return new Date().toISOString().slice(0, 10)
}

export default function MemberNutritionPage() {
  const { data: nutritionPlans } = useNutritionPlans()
  const activeNutritionPlan = nutritionPlans?.items.find((p) => p.is_active)

  const today = todayKey()
  const { data: nutritionLog } = useNutritionLog(today)
  const upsertLog = useUpsertNutritionLog()
  const loggedGrams = {
    protein: nutritionLog?.protein_g ?? 0,
    carbs: nutritionLog?.carbs_g ?? 0,
    fats: nutritionLog?.fats_g ?? 0,
  }
  const setLoggedGrams = (updater: (prev: typeof loggedGrams) => typeof loggedGrams) => {
    const next = updater(loggedGrams)
    upsertLog.mutate({
      protein_g: next.protein,
      carbs_g: next.carbs,
      fats_g: next.fats,
      log_date: today,
    })
  }

  const macroData = activeNutritionPlan
    ? [
        { name: "Proteína", grams: activeNutritionPlan.protein_g },
        { name: "Carbohidratos", grams: activeNutritionPlan.carbs_g },
        { name: "Grasas", grams: activeNutritionPlan.fats_g },
      ]
    : []

  return (
    <MembershipGate>
    <div className="space-y-6">
      <FadeIn>
        <h1 className="flex items-center gap-2 text-lg font-semibold tracking-tight">
          <Apple className="size-5 text-primary" />
          Nutrición de hoy
        </h1>
      </FadeIn>

      <FadeIn delay={0.02}>
        <Card>
          <CardHeader>
            <CardTitle>
              Plan actual
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
      </FadeIn>
    </div>
    </MembershipGate>
  )
}
