"use client"

import * as React from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { z } from "zod"
import { toast } from "sonner"
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip as RechartsTooltip } from "recharts"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { MemberPicker } from "@/components/shared/member-picker"
import { ApiError } from "@/lib/api-client"
import { ACTIVITY_LEVEL_LABELS, FITNESS_GOAL_LABELS } from "@/lib/labels"
import type { ActivityLevel, FitnessGoal, NutritionPlanGenerateResponse } from "@/lib/types"
import { useGenerateNutritionPlan, useNutritionPlans } from "@/hooks/use-nutrition"

const FITNESS_GOALS: FitnessGoal[] = ["FAT_LOSS", "MUSCLE_GAIN", "MAINTENANCE", "REHAB"]
const ACTIVITY_LEVELS: ActivityLevel[] = [
  "SEDENTARY",
  "LIGHT",
  "MODERATE",
  "ACTIVE",
  "VERY_ACTIVE",
]

const MACRO_COLORS = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)"]

const generateSchema = z.object({
  weight_kg: z.coerce.number().positive().max(500),
  height_cm: z.coerce.number().positive().max(300),
  age: z.coerce.number().int().positive().max(120),
  body_fat_percentage: z.coerce.number().min(3).max(60).optional(),
  activity_level: z.enum(["SEDENTARY", "LIGHT", "MODERATE", "ACTIVE", "VERY_ACTIVE"]),
  fitness_goal: z.enum(["FAT_LOSS", "MUSCLE_GAIN", "MAINTENANCE", "REHAB"]),
})

type GenerateFormValues = z.infer<typeof generateSchema>

export default function NutritionPrescriptorPage() {
  const [memberId, setMemberId] = React.useState("")
  const [result, setResult] = React.useState<NutritionPlanGenerateResponse | null>(null)
  const { data: plans } = useNutritionPlans(memberId || undefined)
  const generate = useGenerateNutritionPlan()

  const form = useForm<z.input<typeof generateSchema>, unknown, GenerateFormValues>({
    resolver: zodResolver(generateSchema),
    defaultValues: {
      weight_kg: 70,
      height_cm: 170,
      age: 30,
      activity_level: "MODERATE",
      fitness_goal: "MAINTENANCE",
    },
  })

  const onSubmit = (values: GenerateFormValues) => {
    if (!memberId) {
      toast.error("Selecciona un miembro primero")
      return
    }
    generate.mutate(
      { ...values, user_id: memberId },
      {
        onSuccess: (data) => {
          setResult(data)
          toast.success("Plan de nutrición generado")
        },
        onError: (error) =>
          toast.error(error instanceof ApiError ? error.detail : "No se pudo generar el plan"),
      }
    )
  }

  const macroData = result
    ? [
        { name: "Proteína", grams: result.protein_g },
        { name: "Carbohidratos", grams: result.carbs_g },
        { name: "Grasas", grams: result.fats_g },
      ]
    : []

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">Prescriptor de macros</h1>
      <MemberPicker value={memberId} onChange={setMemberId} />

      {memberId && (
        <div className="grid gap-6 lg:grid-cols-[380px_1fr]">
          <Card>
            <CardHeader>
              <CardTitle>Generar plan</CardTitle>
            </CardHeader>
            <CardContent>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4">
                  <div className="grid grid-cols-3 gap-3">
                    <FormField
                      control={form.control}
                      name="weight_kg"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs">Peso (kg)</FormLabel>
                          <FormControl>
                            <Input type="number" step="0.1" {...field} value={field.value as number} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="height_cm"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs">Estatura (cm)</FormLabel>
                          <FormControl>
                            <Input type="number" step="0.1" {...field} value={field.value as number} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="age"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs">Edad</FormLabel>
                          <FormControl>
                            <Input type="number" {...field} value={field.value as number} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  <FormField
                    control={form.control}
                    name="body_fat_percentage"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>
                          % de grasa corporal (opcional — activa el cálculo Katch-McArdle)
                        </FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            step="0.1"
                            {...field}
                            value={(field.value as number | undefined) ?? ""}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="activity_level"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Nivel de actividad</FormLabel>
                        <Select value={field.value} onValueChange={field.onChange}>
                          <FormControl>
                            <SelectTrigger className="w-full">
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {ACTIVITY_LEVELS.map((a) => (
                              <SelectItem key={a} value={a}>
                                {ACTIVITY_LEVEL_LABELS[a]}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="fitness_goal"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Objetivo</FormLabel>
                        <Select value={field.value} onValueChange={field.onChange}>
                          <FormControl>
                            <SelectTrigger className="w-full">
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {FITNESS_GOALS.map((g) => (
                              <SelectItem key={g} value={g}>
                                {FITNESS_GOAL_LABELS[g]}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <Button type="submit" disabled={generate.isPending}>
                    {generate.isPending ? "Calculando…" : "Generar plan"}
                  </Button>
                </form>
              </Form>
            </CardContent>
          </Card>

          <div className="space-y-6">
            {result && (
              <Card>
                <CardHeader>
                  <CardTitle>
                    {result.calories} kcal/día
                    <Badge variant="secondary" className="ml-2">
                      {result.bmr_formula === "katch_mcardle" ? "Katch-McArdle" : "Mifflin-St Jeor"}
                    </Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="grid gap-6 sm:grid-cols-2">
                  <div className="h-56">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={macroData}
                          dataKey="grams"
                          nameKey="name"
                          innerRadius={50}
                          outerRadius={80}
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
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">TMB</span>
                      <span className="font-medium">{result.bmr} kcal</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">GET</span>
                      <span className="font-medium">{result.tdee} kcal</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Proteína</span>
                      <span className="font-medium">{result.protein_g} g</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Carbohidratos</span>
                      <span className="font-medium">{result.carbs_g} g</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Grasas</span>
                      <span className="font-medium">{result.fats_g} g</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Agua</span>
                      <span className="font-medium">{(result.water_ml / 1000).toFixed(1)} L</span>
                    </div>
                  </div>
                  <div className="sm:col-span-2 rounded-md border bg-muted/30 p-3">
                    <p className="text-sm font-medium">
                      Plantilla sugerida: {result.recommended_workout_template.name} ·{" "}
                      {result.recommended_workout_template.sessions_per_week}x/semana
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {result.recommended_workout_template.description}
                    </p>
                  </div>
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader>
                <CardTitle>Historial</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {(plans?.items ?? []).map((p) => (
                  <div
                    key={p.id}
                    className="flex items-center justify-between rounded-md border p-2 text-sm"
                  >
                    <span>{new Date(p.created_at).toLocaleDateString()}</span>
                    <span className="text-muted-foreground">{FITNESS_GOAL_LABELS[p.fitness_goal]}</span>
                    <span className="font-medium">{p.calories} kcal</span>
                  </div>
                ))}
                {(plans?.items?.length ?? 0) === 0 && (
                  <p className="text-sm text-muted-foreground">
                    Todavía no se han generado planes.
                  </p>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
  )
}
