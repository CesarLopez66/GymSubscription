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
      toast.error("Select a member first")
      return
    }
    generate.mutate(
      { ...values, user_id: memberId },
      {
        onSuccess: (data) => {
          setResult(data)
          toast.success("Nutrition plan generated")
        },
        onError: (error) =>
          toast.error(error instanceof ApiError ? error.detail : "Could not generate plan"),
      }
    )
  }

  const macroData = result
    ? [
        { name: "Protein", grams: result.protein_g },
        { name: "Carbs", grams: result.carbs_g },
        { name: "Fats", grams: result.fats_g },
      ]
    : []

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">Macro prescriptor</h1>
      <MemberPicker value={memberId} onChange={setMemberId} />

      {memberId && (
        <div className="grid gap-6 lg:grid-cols-[380px_1fr]">
          <Card>
            <CardHeader>
              <CardTitle>Generate plan</CardTitle>
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
                          <FormLabel className="text-xs">Weight (kg)</FormLabel>
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
                          <FormLabel className="text-xs">Height (cm)</FormLabel>
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
                          <FormLabel className="text-xs">Age</FormLabel>
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
                          Body fat % (optional — enables Katch-McArdle BMR)
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
                        <FormLabel>Activity level</FormLabel>
                        <Select value={field.value} onValueChange={field.onChange}>
                          <FormControl>
                            <SelectTrigger className="w-full">
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {ACTIVITY_LEVELS.map((a) => (
                              <SelectItem key={a} value={a}>
                                {a}
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
                        <FormLabel>Fitness goal</FormLabel>
                        <Select value={field.value} onValueChange={field.onChange}>
                          <FormControl>
                            <SelectTrigger className="w-full">
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {FITNESS_GOALS.map((g) => (
                              <SelectItem key={g} value={g}>
                                {g}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <Button type="submit" disabled={generate.isPending}>
                    {generate.isPending ? "Calculating…" : "Generate plan"}
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
                    {result.calories} kcal/day
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
                      <span className="text-muted-foreground">BMR</span>
                      <span className="font-medium">{result.bmr} kcal</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">TDEE</span>
                      <span className="font-medium">{result.tdee} kcal</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Protein</span>
                      <span className="font-medium">{result.protein_g} g</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Carbs</span>
                      <span className="font-medium">{result.carbs_g} g</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Fats</span>
                      <span className="font-medium">{result.fats_g} g</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Water</span>
                      <span className="font-medium">{(result.water_ml / 1000).toFixed(1)} L</span>
                    </div>
                  </div>
                  <div className="sm:col-span-2 rounded-md border bg-muted/30 p-3">
                    <p className="text-sm font-medium">
                      Suggested template: {result.recommended_workout_template.name} ·{" "}
                      {result.recommended_workout_template.sessions_per_week}x/week
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
                <CardTitle>History</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {(plans?.items ?? []).map((p) => (
                  <div
                    key={p.id}
                    className="flex items-center justify-between rounded-md border p-2 text-sm"
                  >
                    <span>{new Date(p.created_at).toLocaleDateString()}</span>
                    <span className="text-muted-foreground">{p.fitness_goal}</span>
                    <span className="font-medium">{p.calories} kcal</span>
                  </div>
                ))}
                {(plans?.items?.length ?? 0) === 0 && (
                  <p className="text-sm text-muted-foreground">No plans generated yet.</p>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
  )
}
