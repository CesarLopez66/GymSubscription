"use client"

import * as React from "react"
import { toast } from "sonner"
import { Dumbbell, Pencil, Plus, Trash2 } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { ConfirmDialog } from "@/components/shared/confirm-dialog"
import { EntityCard } from "@/components/shared/entity-card"
import { FadeIn, StaggerGroup, StaggerItem } from "@/components/shared/motion"
import { ApiError } from "@/lib/api-client"
import { muscleGroupBadgeClass } from "@/lib/badge-colors"
import type { Exercise } from "@/lib/types"
import { useDeleteExercise, useExercises } from "@/hooks/use-exercises"
import { useAuthStore } from "@/store/auth-store"
import { ExerciseFormDialog } from "./exercise-form-dialog"

export default function ExercisesPage() {
  const roles = useAuthStore((s) => s.user?.roles) ?? []
  const canManage = roles.includes("GYM_ADMIN") || roles.includes("TRAINER")

  const { data, isLoading } = useExercises()
  const deleteExercise = useDeleteExercise()
  const [formTarget, setFormTarget] = React.useState<Exercise | "new" | null>(null)
  const [deleteTarget, setDeleteTarget] = React.useState<Exercise | null>(null)

  const exercises = data?.items ?? []

  const handleDelete = () => {
    if (!deleteTarget) return
    deleteExercise.mutate(deleteTarget.id, {
      onSuccess: () => {
        toast.success(`${deleteTarget.name} eliminado`)
        setDeleteTarget(null)
      },
      onError: (error) => {
        toast.error(error instanceof ApiError ? error.detail : "No se pudo eliminar el ejercicio")
        setDeleteTarget(null)
      },
    })
  }

  return (
    <div className="space-y-6">
      <FadeIn className="flex items-center justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
            <Dumbbell className="size-5" />
            Ejercicios
          </h1>
          <p className="text-sm text-muted-foreground">
            Catálogo usado para armar rutinas de entrenamiento.
          </p>
        </div>
        {canManage && (
          <Button size="sm" onClick={() => setFormTarget("new")}>
            <Plus className="size-4" />
            Nuevo ejercicio
          </Button>
        )}
      </FadeIn>

      <FadeIn delay={0.05}>
        <Card>
          <CardContent>
            {isLoading ? (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {Array.from({ length: 6 }).map((_, i) => (
                  <Skeleton key={i} className="h-24 w-full" />
                ))}
              </div>
            ) : (
              <StaggerGroup className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {exercises.map((ex) => (
                  <StaggerItem key={ex.id}>
                    <EntityCard contentClassName="gap-2 p-3">
                      <div className="flex items-center justify-between gap-2">
                        <p className="truncate font-semibold">{ex.name}</p>
                        <Badge className={muscleGroupBadgeClass(ex.muscle_group)}>
                          {ex.muscle_group}
                        </Badge>
                      </div>
                      {ex.equipment && (
                        <p className="text-xs text-muted-foreground">{ex.equipment}</p>
                      )}
                      {canManage && (
                        <div className="flex justify-end gap-1 border-t pt-2">
                          <Button variant="ghost" size="sm" onClick={() => setFormTarget(ex)}>
                            <Pencil className="size-3.5" />
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => setDeleteTarget(ex)}>
                            <Trash2 className="size-3.5" />
                          </Button>
                        </div>
                      )}
                    </EntityCard>
                  </StaggerItem>
                ))}
                {exercises.length === 0 && (
                  <p className="text-sm text-muted-foreground sm:col-span-2 lg:col-span-3">
                    Todavía no hay ejercicios en el catálogo.
                  </p>
                )}
              </StaggerGroup>
            )}
          </CardContent>
        </Card>
      </FadeIn>

      {formTarget && (
        <ExerciseFormDialog
          exercise={formTarget === "new" ? undefined : formTarget}
          open={!!formTarget}
          onOpenChange={(open) => !open && setFormTarget(null)}
        />
      )}

      <ConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title={`Eliminar ${deleteTarget?.name ?? "ejercicio"}`}
        description="Esta acción no se puede deshacer. Si el ejercicio está asignado a algún plan de entrenamiento, no se podrá eliminar."
        confirmLabel="Eliminar"
        isPending={deleteExercise.isPending}
        onConfirm={handleDelete}
      />
    </div>
  )
}
