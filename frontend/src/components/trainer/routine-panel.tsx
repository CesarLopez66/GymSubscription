"use client"

import * as React from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { useFieldArray, useForm } from "react-hook-form"
import { z } from "zod"
import { toast } from "sonner"
import { GripVertical, Pencil, Plus, Sparkles, Trash2 } from "lucide-react"

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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { MuscleMap } from "@/components/shared/muscle-map"
import { ApiError } from "@/lib/api-client"
import { DAY_LABELS, DAY_LABELS_SHORT } from "@/lib/labels"
import { cn } from "@/lib/utils"
import type { DayOfWeek, Exercise, WorkoutPlan } from "@/lib/types"
import { useExercises } from "@/hooks/use-exercises"
import {
  useReplaceWorkoutPlanItems,
  useUpdateWorkoutPlan,
  useWorkoutAdherence,
  useWorkoutPlans,
  type WorkoutPlanItemInput,
} from "@/hooks/use-workouts"

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
})

const itemsFormSchema = z.object({
  items: z.array(itemSchema).min(1, "Agrega al menos un ejercicio"),
})

type ItemsFormValues = z.infer<typeof itemsFormSchema>

function EditWorkoutPlanDialog({
  plan,
  exercises,
}: {
  plan: WorkoutPlan
  exercises: Exercise[]
}) {
  const [open, setOpen] = React.useState(false)
  const replaceItems = useReplaceWorkoutPlanItems()
  const exerciseItems = exercises.map((ex) => ({ value: ex.id, label: ex.name }))

  const defaults: ItemsFormValues = {
    items: plan.items.map((item) => ({
      exercise_id: item.exercise_id,
      day_of_week: item.day_of_week,
      sets: item.sets,
      reps: item.reps,
    })),
  }

  const form = useForm<z.input<typeof itemsFormSchema>, unknown, ItemsFormValues>({
    resolver: zodResolver(itemsFormSchema),
    defaultValues: defaults,
  })

  const { fields, append, remove, move } = useFieldArray({
    control: form.control,
    name: "items",
  })

  const onSubmit = (values: ItemsFormValues) => {
    const items: WorkoutPlanItemInput[] = values.items.map((item, index) => ({
      ...item,
      order: index,
    }))
    replaceItems.mutate(
      { id: plan.id, items },
      {
        onSuccess: () => {
          toast.success("Rutina actualizada")
          setOpen(false)
        },
        onError: (error) =>
          toast.error(error instanceof ApiError ? error.detail : "No se pudo actualizar la rutina"),
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
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Editar {plan.name}</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4">
            <div className="space-y-3">
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
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                    <FormField
                      control={form.control}
                      name={`items.${index}.exercise_id`}
                      render={({ field }) => (
                        <FormItem className="col-span-2">
                          <FormLabel className="text-xs">Ejercicio</FormLabel>
                          <Select items={exerciseItems} value={field.value} onValueChange={field.onChange}>
                            <FormControl>
                              <SelectTrigger className="w-full">
                                <SelectValue placeholder="Elegir" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {exercises.map((ex) => (
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
                          <Select items={DAY_LABELS_SHORT} value={field.value} onValueChange={field.onChange}>
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
                    <div className="grid grid-cols-2 gap-2">
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
                            <FormLabel className="text-xs">Reps</FormLabel>
                            <FormControl>
                              <Input type="number" {...field} value={field.value as number} />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>
                  <Button type="button" variant="ghost" size="icon" onClick={() => remove(index)}>
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              ))}
              {form.formState.errors.items?.root && (
                <p className="text-sm text-destructive">{form.formState.errors.items.root.message}</p>
              )}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => append({ exercise_id: "", day_of_week: "MONDAY", sets: 3, reps: 10 })}
              >
                <Plus className="size-4" />
                Agregar ejercicio
              </Button>
            </div>
            <DialogFooter>
              <Button type="submit" disabled={replaceItems.isPending}>
                {replaceItems.isPending ? "Guardando…" : "Guardar cambios"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}

export function RoutinePanel({ memberId }: { memberId: string }) {
  const [selectedMuscle, setSelectedMuscle] = React.useState<string | null>(null)
  const { data: exercises } = useExercises()
  const { data: plans, isLoading } = useWorkoutPlans(memberId)
  const { data: adherence } = useWorkoutAdherence(memberId, 7)
  const updatePlan = useUpdateWorkoutPlan()

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Buscar por músculo</CardTitle>
        </CardHeader>
        <CardContent>
          <MuscleMap selected={selectedMuscle} onSelect={setSelectedMuscle} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle>Rutinas del miembro</CardTitle>
          {adherence && (
            <Badge variant={adherence.active_days === 0 ? "destructive" : "secondary"}>
              Activo {adherence.active_days}/{adherence.period_days} días esta semana
            </Badge>
          )}
        </CardHeader>
        <CardContent className="space-y-4">
          {isLoading && <p className="text-sm text-muted-foreground">Cargando…</p>}
          {(plans?.items ?? []).map((plan) => (
            <div key={plan.id} className="rounded-md border p-3">
              <div className="flex items-center justify-between gap-2">
                <p className="flex items-center gap-1.5 font-medium">
                  <Sparkles className="size-3.5 text-primary" />
                  {plan.name}
                </p>
                <div className="flex items-center gap-1">
                  <Badge variant={plan.is_active ? "default" : "secondary"}>
                    {plan.is_active ? "Activa" : "Inactiva"}
                  </Badge>
                  <EditWorkoutPlanDialog plan={plan} exercises={exercises?.items ?? []} />
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={updatePlan.isPending}
                    onClick={() =>
                      updatePlan.mutate({ id: plan.id, is_active: !plan.is_active })
                    }
                  >
                    {plan.is_active ? "Desactivar" : "Reactivar"}
                  </Button>
                </div>
              </div>
              <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {DAYS.map((day) => {
                  const dayItems = plan.items
                    .filter((item) => item.day_of_week === day)
                    .sort((a, b) => a.order - b.order)
                  if (dayItems.length === 0) return null
                  return (
                    <div key={day} className="rounded-md bg-muted/30 p-2.5">
                      <p className="mb-1.5 text-xs font-semibold text-primary">
                        {DAY_LABELS[day]}
                      </p>
                      <ul className="space-y-1">
                        {dayItems.map((item) => {
                          const matches =
                            !selectedMuscle || item.exercise.muscle_group === selectedMuscle
                          return (
                            <li
                              key={item.id}
                              className={cn(
                                "flex items-center justify-between gap-2 rounded px-1 py-0.5 text-xs transition-opacity",
                                selectedMuscle && matches && "bg-primary/10 ring-1 ring-primary/40",
                                selectedMuscle && !matches && "opacity-35"
                              )}
                            >
                              <span className="truncate">{item.exercise.name}</span>
                              <span className="shrink-0 font-medium text-muted-foreground">
                                {item.sets}×{item.reps}
                              </span>
                            </li>
                          )
                        })}
                      </ul>
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
          {!isLoading && (plans?.items?.length ?? 0) === 0 && (
            <p className="text-sm text-muted-foreground">
              Todavía no hay rutinas — se generará una automáticamente en cuanto registres
              una evaluación física para este miembro.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
