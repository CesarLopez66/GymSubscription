"use client"

import * as React from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { z } from "zod"
import { toast } from "sonner"
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip as RechartsTooltip } from "recharts"
import { Pencil, Sparkles } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { ApiError } from "@/lib/api-client"
import { FITNESS_GOAL_LABELS } from "@/lib/labels"
import type { NutritionPlan } from "@/lib/types"
import { useNutritionPlans, useUpdateNutritionPlan } from "@/hooks/use-nutrition"

const MACRO_COLORS = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)"]

const editSchema = z.object({
  calories: z.coerce.number().int().positive(),
  protein_g: z.coerce.number().int().nonnegative(),
  carbs_g: z.coerce.number().int().nonnegative(),
  fats_g: z.coerce.number().int().nonnegative(),
  water_ml: z.coerce.number().int().positive(),
})

type EditFormValues = z.infer<typeof editSchema>

function EditNutritionPlanDialog({ plan }: { plan: NutritionPlan }) {
  const [open, setOpen] = React.useState(false)
  const updatePlan = useUpdateNutritionPlan()

  const defaults: EditFormValues = {
    calories: plan.calories,
    protein_g: plan.protein_g,
    carbs_g: plan.carbs_g,
    fats_g: plan.fats_g,
    water_ml: plan.water_ml,
  }

  const form = useForm<z.input<typeof editSchema>, unknown, EditFormValues>({
    resolver: zodResolver(editSchema),
    defaultValues: defaults,
  })

  const onSubmit = (values: EditFormValues) => {
    updatePlan.mutate(
      { id: plan.id, input: values },
      {
        onSuccess: () => {
          toast.success("Plan actualizado")
          setOpen(false)
        },
        onError: (error) =>
          toast.error(error instanceof ApiError ? error.detail : "No se pudo actualizar el plan"),
      }
    )
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v)
        if (v) form.reset(defaults)
      }}
    >
      <DialogTrigger render={<Button variant="ghost" size="sm" />}>
        <Pencil className="size-3.5" />
        Editar
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Editar plan de nutrición</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4">
            <FormField
              control={form.control}
              name="calories"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Calorías (kcal/día)</FormLabel>
                  <FormControl>
                    <Input type="number" {...field} value={field.value as number} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid grid-cols-3 gap-3">
              <FormField
                control={form.control}
                name="protein_g"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs">Proteína (g)</FormLabel>
                    <FormControl>
                      <Input type="number" {...field} value={field.value as number} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="carbs_g"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs">Carbos (g)</FormLabel>
                    <FormControl>
                      <Input type="number" {...field} value={field.value as number} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="fats_g"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs">Grasas (g)</FormLabel>
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
              name="water_ml"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Agua (ml/día)</FormLabel>
                  <FormControl>
                    <Input type="number" {...field} value={field.value as number} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button type="submit" disabled={updatePlan.isPending}>
                {updatePlan.isPending ? "Guardando…" : "Guardar cambios"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}

export function MacrosPanel({ memberId }: { memberId: string }) {
  const { data: plans, isLoading } = useNutritionPlans(memberId)
  const updatePlan = useUpdateNutritionPlan()

  const activePlan = plans?.items.find((p) => p.is_active)
  const macroData = activePlan
    ? [
        { name: "Proteína", grams: activePlan.protein_g },
        { name: "Carbohidratos", grams: activePlan.carbs_g },
        { name: "Grasas", grams: activePlan.fats_g },
      ]
    : []

  return (
    <div className="space-y-6">
      {activePlan && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="size-4 text-primary" />
              {activePlan.calories} kcal/día
              <Badge variant="secondary">
                {activePlan.bmr_formula === "katch_mcardle" ? "Katch-McArdle" : "Mifflin-St Jeor"}
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
                <span className="font-medium">{activePlan.bmr} kcal</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">GET</span>
                <span className="font-medium">{activePlan.tdee} kcal</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Proteína</span>
                <span className="font-medium">{activePlan.protein_g} g</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Carbohidratos</span>
                <span className="font-medium">{activePlan.carbs_g} g</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Grasas</span>
                <span className="font-medium">{activePlan.fats_g} g</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Agua</span>
                <span className="font-medium">{(activePlan.water_ml / 1000).toFixed(1)} L</span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Historial</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {isLoading && <p className="text-sm text-muted-foreground">Cargando…</p>}
          {(plans?.items ?? []).map((p) => (
            <div
              key={p.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-md border p-2 text-sm"
            >
              <div className="flex items-center gap-2">
                <span>{new Date(p.created_at).toLocaleDateString()}</span>
                <span className="text-muted-foreground">{FITNESS_GOAL_LABELS[p.fitness_goal]}</span>
                <span className="font-medium">{p.calories} kcal</span>
                <Badge variant={p.is_active ? "default" : "secondary"}>
                  {p.is_active ? "Activo" : "Inactivo"}
                </Badge>
              </div>
              <div className="flex items-center gap-1">
                <EditNutritionPlanDialog plan={p} />
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={updatePlan.isPending}
                  onClick={() =>
                    updatePlan.mutate({ id: p.id, input: { is_active: !p.is_active } })
                  }
                >
                  {p.is_active ? "Desactivar" : "Reactivar"}
                </Button>
              </div>
            </div>
          ))}
          {!isLoading && (plans?.items?.length ?? 0) === 0 && (
            <p className="text-sm text-muted-foreground">
              Todavía no hay planes — se generará uno automáticamente en cuanto
              registres una evaluación física para este miembro.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
