"use client"

import * as React from "react"
import { Check } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { FadeIn } from "@/components/shared/motion"
import { MembershipGate } from "@/components/shared/membership-gate"
import { MUSCLE_LABELS } from "@/components/shared/muscle-map"
import { RestTimer } from "@/components/shared/rest-timer"
import { muscleGroupBadgeClass } from "@/lib/badge-colors"
import { DAY_LABELS_SHORT, FITNESS_GOAL_LABELS } from "@/lib/labels"
import type { DayOfWeek, WorkoutPlanItem } from "@/lib/types"
import { cn } from "@/lib/utils"
import { WEEK_ORDER, localDateKey, muscleSummary, todayDayOfWeek, trainingDayPosition } from "@/lib/week"
import { useCompletionsForDate, useSetItemCompletion, useWorkoutPlans } from "@/hooks/use-workouts"

export default function MemberRoutinePage() {
  const todayName = todayDayOfWeek()
  const [selectedDay, setSelectedDay] = React.useState<DayOfWeek>(todayName)

  const { data: workoutPlans } = useWorkoutPlans()
  const activePlan = workoutPlans?.items.find((p) => p.is_active)
  const dayItems = (activePlan?.items ?? [])
    .filter((item) => item.day_of_week === selectedDay)
    .sort((a, b) => a.order - b.order)

  const today = localDateKey(new Date())
  const isToday = selectedDay === todayName
  const { data: completedItemIds } = useCompletionsForDate(today)
  const setItemCompletion = useSetItemCompletion()
  const completedSet = new Set(completedItemIds ?? [])
  const doneCount = isToday ? dayItems.filter((i) => completedSet.has(i.id)).length : 0
  // The exercise to do next: the first one of today's list not yet checked off.
  const currentId = isToday ? dayItems.find((i) => !completedSet.has(i.id))?.id : undefined
  const position = activePlan ? trainingDayPosition(activePlan.items, selectedDay) : null

  const toggle = (item: WorkoutPlanItem, completed: boolean) =>
    setItemCompletion.mutate({ itemId: item.id, completed, date: today })

  return (
    <MembershipGate>
      <div className="space-y-4">
        <FadeIn>
          <div className="space-y-2.5 px-1">
            <div className="space-y-0.5">
              <p className="text-xs font-semibold tracking-wider text-primary uppercase">
                {position ? `Día ${position.index} de ${position.total}` : DAY_LABELS_SHORT[selectedDay]}
                {activePlan ? ` · ${FITNESS_GOAL_LABELS[activePlan.fitness_goal]}` : ""}
              </p>
              <h1 className="font-heading text-[30px] leading-9 font-semibold">
                {!activePlan ? "Tu rutina" : dayItems.length > 0 ? muscleSummary(dayItems) : "Día de descanso"}
              </h1>
            </div>
            {isToday && dayItems.length > 0 && (
              <div className="flex items-center gap-3">
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-secondary" aria-hidden="true">
                  <div
                    className="h-full rounded-full bg-primary transition-all"
                    style={{ width: `${(doneCount / dayItems.length) * 100}%` }}
                  />
                </div>
                <span className="text-[13px] text-muted-foreground tabular-nums">
                  {doneCount} de {dayItems.length} hechos
                </span>
              </div>
            )}
          </div>
        </FadeIn>

        <FadeIn delay={0.02}>
          <div role="tablist" aria-label="Día de la semana" className="grid grid-cols-7 gap-1 rounded-2xl bg-muted p-1">
            {WEEK_ORDER.map((day) => {
              const hasWork = activePlan?.items.some((i) => i.day_of_week === day)
              const selected = day === selectedDay
              return (
                <button
                  key={day}
                  type="button"
                  role="tab"
                  aria-selected={selected}
                  onClick={() => setSelectedDay(day)}
                  className={cn(
                    "relative flex h-11 flex-col items-center justify-center rounded-xl text-xs font-medium transition-colors",
                    selected ? "bg-card text-foreground ring-1 ring-input" : "text-muted-foreground hover:text-foreground",
                    day === todayName && !selected && "text-primary"
                  )}
                >
                  {DAY_LABELS_SHORT[day]}
                  {hasWork && <span className={cn("mt-0.5 size-1 rounded-full", selected ? "bg-primary" : "bg-foreground/30")} />}
                </button>
              )
            })}
          </div>
        </FadeIn>

        <FadeIn delay={0.04}>
          <div className="space-y-2.5">
            {!activePlan && (
              <p className="rounded-2xl bg-card/75 p-4 text-sm text-muted-foreground ring-1 ring-foreground/10">
                Todavía no tienes una rutina asignada. Tu entrenador la cargará después de tu evaluación.
              </p>
            )}
            {activePlan && dayItems.length === 0 && (
              <p className="rounded-2xl bg-card/75 p-4 text-sm text-muted-foreground ring-1 ring-foreground/10">
                Nada programado para este día. Aprovecha para descansar.
              </p>
            )}
            {dayItems.map((item, index) => {
              const done = isToday && completedSet.has(item.id)
              const muscle = (
                <Badge className={cn("shrink-0", muscleGroupBadgeClass(item.exercise.muscle_group))}>
                  {MUSCLE_LABELS[item.exercise.muscle_group] ?? item.exercise.muscle_group}
                </Badge>
              )

              if (item.id === currentId) {
                return (
                  <section
                    key={item.id}
                    className="space-y-3.5 rounded-2xl bg-card p-4 shadow-xl shadow-black/30 ring-[1.5px] ring-primary/70"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 space-y-1">
                        <p className="text-xs font-semibold tracking-wider text-primary uppercase">Ahora</p>
                        <p className="text-lg font-semibold">{item.exercise.name}</p>
                      </div>
                      {muscle}
                    </div>
                    <div className="grid auto-cols-fr grid-flow-col gap-2 text-center">
                      <Stat value={`${item.sets} × ${item.reps}`} label="series × reps" />
                      {item.rpe ? <Stat value={`RPE ${item.rpe}`} label="esfuerzo" /> : null}
                      {item.rest_seconds ? <Stat value={`${item.rest_seconds} s`} label="descanso" /> : null}
                    </div>
                    {(item.notes || item.exercise.description) && (
                      <p className="text-[13px] leading-snug text-muted-foreground">{item.notes ?? item.exercise.description}</p>
                    )}
                    <div className="flex gap-2">
                      {item.rest_seconds ? (
                        <RestTimer seconds={item.rest_seconds} className="h-12 flex-1 rounded-2xl text-[15px]" />
                      ) : null}
                      <Button
                        className="h-12 flex-[1.4] gap-2 rounded-2xl text-[15px] font-semibold"
                        disabled={setItemCompletion.isPending}
                        onClick={() => toggle(item, true)}
                      >
                        <Check className="size-4.5" strokeWidth={2.5} />
                        Marcar hecho
                      </Button>
                    </div>
                  </section>
                )
              }

              return (
                <div
                  key={item.id}
                  className={cn(
                    "flex items-center gap-3 rounded-2xl bg-card/75 px-3.5 py-3 ring-1 ring-foreground/10",
                    done && "bg-card/45 opacity-75 ring-foreground/6"
                  )}
                >
                  {isToday ? (
                    <button
                      type="button"
                      aria-label={done ? `Desmarcar ${item.exercise.name}` : `Marcar ${item.exercise.name} como hecho`}
                      aria-pressed={done}
                      onClick={() => toggle(item, !done)}
                      className={cn(
                        "grid size-7 shrink-0 place-items-center rounded-full text-xs",
                        done
                          ? "bg-emerald-500/20 text-emerald-400"
                          : "border-[1.5px] border-foreground/20 text-muted-foreground"
                      )}
                    >
                      {done ? <Check className="size-3.5" strokeWidth={3} /> : index + 1}
                    </button>
                  ) : (
                    <span className="grid size-7 shrink-0 place-items-center rounded-full border-[1.5px] border-foreground/20 text-xs text-muted-foreground">
                      {index + 1}
                    </span>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className={cn("truncate text-[15px] font-medium", done && "line-through decoration-muted-foreground")}>
                      {item.exercise.name}
                    </p>
                    <p className="text-[13px] text-muted-foreground">
                      {item.sets} × {item.reps}
                      {item.rpe ? ` · RPE ${item.rpe}` : ""}
                      {item.rest_seconds ? ` · ${item.rest_seconds} s de descanso` : ""}
                    </p>
                  </div>
                  {!done && muscle}
                </div>
              )
            })}
            {isToday && dayItems.length > 0 && doneCount === dayItems.length && (
              <p className="rounded-2xl bg-emerald-500/10 p-4 text-center text-sm font-medium text-emerald-400 ring-1 ring-emerald-500/30">
                Terminaste la rutina de hoy.
              </p>
            )}
          </div>
        </FadeIn>
      </div>
    </MembershipGate>
  )
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="rounded-xl bg-muted px-1 py-2.5">
      <p className="text-xl font-semibold tabular-nums">{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  )
}
