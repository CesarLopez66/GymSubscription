"use client"

import * as React from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { useFieldArray, useForm } from "react-hook-form"
import { z } from "zod"
import { toast } from "sonner"
import { GripVertical, Plus, Trash2 } from "lucide-react"

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
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { FadeIn } from "@/components/shared/motion"
import { MemberPicker } from "@/components/shared/member-picker"
import { ApiError } from "@/lib/api-client"
import { DAY_LABELS_SHORT, FITNESS_GOAL_LABELS } from "@/lib/labels"
import type { DayOfWeek, FitnessGoal } from "@/lib/types"
import { useExercises } from "@/hooks/use-exercises"
import { useAssignWorkoutPlan, useWorkoutPlans } from "@/hooks/use-workouts"

const FITNESS_GOALS: FitnessGoal[] = ["FAT_LOSS", "MUSCLE_GAIN", "MAINTENANCE", "REHAB"]
const DAYS: DayOfWeek[] = [
  "MONDAY",
  "TUESDAY",
  "WEDNESDAY",
  "THURSDAY",
  "FRIDAY",
  "SATURDAY",
  "SUNDAY",
]

const itemSchema = z.object({
  exercise_id: z.string().min(1, "Elige un ejercicio"),
  day_of_week: z.enum(DAYS as [DayOfWeek, ...DayOfWeek[]]),
  sets: z.coerce.number().int().positive().max(50),
  reps: z.coerce.number().int().positive().max(200),
  rpe: z.coerce.number().min(1).max(10).optional(),
  rest_seconds: z.coerce.number().int().min(0).max(1800).optional(),
})

const planSchema = z.object({
  name: z.string().min(1),
  fitness_goal: z.enum(["FAT_LOSS", "MUSCLE_GAIN", "MAINTENANCE", "REHAB"]),
  start_date: z.string().min(1),
  items: z.array(itemSchema).min(1, "Agrega al menos un ejercicio"),
})

type PlanFormValues = z.infer<typeof planSchema>

export default function WorkoutBuilderPage() {
  const [memberId, setMemberId] = React.useState("")
  const { data: exercises } = useExercises()
  const { data: plans } = useWorkoutPlans(memberId || undefined)
  const assignPlan = useAssignWorkoutPlan()

  const form = useForm<z.input<typeof planSchema>, unknown, PlanFormValues>({
    resolver: zodResolver(planSchema),
    defaultValues: {
      name: "",
      fitness_goal: "MUSCLE_GAIN",
      start_date: new Date().toISOString().slice(0, 10),
      items: [],
    },
  })

  const { fields, append, remove, move } = useFieldArray({
    control: form.control,
    name: "items",
  })

  const onSubmit = (values: PlanFormValues) => {
    if (!memberId) {
      toast.error("Selecciona un miembro primero")
      return
    }
    assignPlan.mutate(
      {
        user_id: memberId,
        name: values.name,
        fitness_goal: values.fitness_goal,
        start_date: values.start_date,
        items: values.items.map((item, index) => ({ ...item, order: index })),
      },
      {
        onSuccess: () => {
          toast.success(`${values.name} asignada`)
          form.reset({
            name: "",
            fitness_goal: "MUSCLE_GAIN",
            start_date: new Date().toISOString().slice(0, 10),
            items: [],
          })
        },
        onError: (error) =>
          toast.error(error instanceof ApiError ? error.detail : "No se pudo asignar la rutina"),
      }
    )
  }

  return (
    <div className="space-y-6">
      <FadeIn className="space-y-4">
      <h1 className="text-2xl font-semibold tracking-tight">Constructor de rutinas</h1>
      <MemberPicker value={memberId} onChange={setMemberId} />
      </FadeIn>

      {memberId && (
        <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
          <Card>
            <CardHeader>
              <CardTitle>Nueva rutina</CardTitle>
            </CardHeader>
            <CardContent>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4">
                  <div className="grid gap-4 sm:grid-cols-3">
                    <FormField
                      control={form.control}
                      name="name"
                      render={({ field }) => (
                        <FormItem className="sm:col-span-1">
                          <FormLabel>Nombre de la rutina</FormLabel>
                          <FormControl>
                            <Input placeholder="Empuje/Jalón/Pierna" {...field} />
                          </FormControl>
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
                    <FormField
                      control={form.control}
                      name="start_date"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Fecha de inicio</FormLabel>
                          <FormControl>
                            <Input type="date" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium">Ejercicios</p>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          append({
                            exercise_id: "",
                            day_of_week: "MONDAY",
                            sets: 3,
                            reps: 10,
                          })
                        }
                      >
                        <Plus className="size-4" />
                        Agregar ejercicio
                      </Button>
                    </div>

                    {fields.map((field, index) => (
                      <div
                        key={field.id}
                        className="grid grid-cols-[auto_1fr_auto] items-start gap-2 rounded-md border p-3"
                      >
                        <div className="flex flex-col gap-1 pt-2 text-muted-foreground">
                          <button
                            type="button"
                            onClick={() => index > 0 && move(index, index - 1)}
                            className="hover:text-foreground"
                            title="Mover arriba"
                          >
                            <GripVertical className="size-4" />
                          </button>
                        </div>
                        <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
                          <FormField
                            control={form.control}
                            name={`items.${index}.exercise_id`}
                            render={({ field }) => (
                              <FormItem className="col-span-2 sm:col-span-2">
                                <FormLabel className="text-xs">Ejercicio</FormLabel>
                                <Select value={field.value} onValueChange={field.onChange}>
                                  <FormControl>
                                    <SelectTrigger className="w-full">
                                      <SelectValue placeholder="Elegir" />
                                    </SelectTrigger>
                                  </FormControl>
                                  <SelectContent>
                                    {(exercises?.items ?? []).map((ex) => (
                                      <SelectItem key={ex.id} value={ex.id}>
                                        {ex.name}
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
                            name={`items.${index}.day_of_week`}
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="text-xs">Día</FormLabel>
                                <Select value={field.value} onValueChange={field.onChange}>
                                  <FormControl>
                                    <SelectTrigger className="w-full">
                                      <SelectValue />
                                    </SelectTrigger>
                                  </FormControl>
                                  <SelectContent>
                                    {DAYS.map((d) => (
                                      <SelectItem key={d} value={d}>
                                        {DAY_LABELS_SHORT[d]}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={form.control}
                            name={`items.${index}.sets`}
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="text-xs">Series</FormLabel>
                                <FormControl>
                                  <Input type="number" {...field} value={field.value as number} />
                                </FormControl>
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={form.control}
                            name={`items.${index}.reps`}
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="text-xs">Repeticiones</FormLabel>
                                <FormControl>
                                  <Input type="number" {...field} value={field.value as number} />
                                </FormControl>
                              </FormItem>
                            )}
                          />
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => remove(index)}
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </div>
                    ))}
                    {form.formState.errors.items?.root && (
                      <p className="text-sm text-destructive">
                        {form.formState.errors.items.root.message}
                      </p>
                    )}
                  </div>

                  <Button type="submit" disabled={assignPlan.isPending}>
                    {assignPlan.isPending ? "Asignando…" : "Asignar rutina"}
                  </Button>
                </form>
              </Form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Rutinas existentes</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {(plans?.items ?? []).map((plan) => (
                <div key={plan.id} className="rounded-md border p-3">
                  <div className="flex items-center justify-between">
                    <p className="font-medium">{plan.name}</p>
                    <Badge variant={plan.is_active ? "default" : "secondary"}>
                      {plan.is_active ? "Activa" : "Inactiva"}
                    </Badge>
                  </div>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs">Día</TableHead>
                        <TableHead className="text-xs">Ejercicio</TableHead>
                        <TableHead className="text-xs">Series×Reps</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {plan.items.map((item) => (
                        <TableRow key={item.id}>
                          <TableCell className="text-xs">
                            {DAY_LABELS_SHORT[item.day_of_week]}
                          </TableCell>
                          <TableCell className="text-xs">{item.exercise.name}</TableCell>
                          <TableCell className="text-xs">
                            {item.sets}×{item.reps}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ))}
              {(plans?.items?.length ?? 0) === 0 && (
                <p className="text-sm text-muted-foreground">Todavía no hay rutinas.</p>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
