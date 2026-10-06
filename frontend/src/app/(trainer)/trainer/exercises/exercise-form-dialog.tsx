"use client"

import * as React from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { z } from "zod"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
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
import { Textarea } from "@/components/ui/textarea"
import { ApiError } from "@/lib/api-client"
import type { Exercise } from "@/lib/types"
import { useCreateExercise, useUpdateExercise } from "@/hooks/use-exercises"

// Common set the muscle map / badge colors already know how to color
// (components/shared/muscle-map.tsx, lib/badge-colors.ts) — the field
// itself stays free text server-side, this is just a convenience list.
const MUSCLE_GROUPS = ["Chest", "Back", "Shoulders", "Arms", "Core", "Legs", "Cardio"]
const MUSCLE_GROUP_ITEMS = Object.fromEntries(MUSCLE_GROUPS.map((g) => [g, g]))

const exerciseSchema = z.object({
  name: z.string().min(1),
  muscle_group: z.string().min(1, "Selecciona un grupo muscular"),
  equipment: z.string().optional(),
  description: z.string().optional(),
  video_url: z.string().optional(),
})

type ExerciseFormValues = z.infer<typeof exerciseSchema>

export function ExerciseFormDialog({
  exercise,
  open,
  onOpenChange,
}: {
  exercise?: Exercise
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const isEditing = !!exercise
  const createExercise = useCreateExercise()
  const updateExercise = useUpdateExercise()
  const isPending = createExercise.isPending || updateExercise.isPending

  const form = useForm<ExerciseFormValues>({
    resolver: zodResolver(exerciseSchema),
    defaultValues: {
      name: exercise?.name ?? "",
      muscle_group: exercise?.muscle_group ?? "",
      equipment: exercise?.equipment ?? "",
      description: exercise?.description ?? "",
      video_url: exercise?.video_url ?? "",
    },
  })

  React.useEffect(() => {
    if (open) {
      form.reset({
        name: exercise?.name ?? "",
        muscle_group: exercise?.muscle_group ?? "",
        equipment: exercise?.equipment ?? "",
        description: exercise?.description ?? "",
        video_url: exercise?.video_url ?? "",
      })
    }
  }, [open, exercise, form])

  const onSubmit = (values: ExerciseFormValues) => {
    const onSuccess = () => {
      toast.success(isEditing ? "Ejercicio actualizado" : "Ejercicio creado")
      onOpenChange(false)
    }
    const onError = (error: unknown) =>
      toast.error(error instanceof ApiError ? error.detail : "No se pudo guardar el ejercicio")

    if (isEditing) {
      updateExercise.mutate({ id: exercise.id, input: values }, { onSuccess, onError })
    } else {
      createExercise.mutate(values, { onSuccess, onError })
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEditing ? "Editar ejercicio" : "Nuevo ejercicio"}</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nombre</FormLabel>
                  <FormControl>
                    <Input placeholder="Press de banca" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="muscle_group"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Grupo muscular</FormLabel>
                  <Select items={MUSCLE_GROUP_ITEMS} value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Elegir grupo" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {MUSCLE_GROUPS.map((g) => (
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
            <FormField
              control={form.control}
              name="equipment"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Equipo (opcional)</FormLabel>
                  <FormControl>
                    <Input placeholder="Barra, mancuernas…" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Descripción (opcional)</FormLabel>
                  <FormControl>
                    <Textarea placeholder="Indicaciones de técnica…" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="video_url"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Video (opcional)</FormLabel>
                  <FormControl>
                    <Input placeholder="https://…" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button type="submit" disabled={isPending}>
                {isPending ? "Guardando…" : isEditing ? "Guardar cambios" : "Crear ejercicio"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
