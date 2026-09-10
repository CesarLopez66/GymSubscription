"use client"

import * as React from "react"
import { Dumbbell } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { FadeIn } from "@/components/shared/motion"
import { MembershipGate } from "@/components/shared/membership-gate"
import { MUSCLE_LABELS } from "@/components/shared/muscle-map"
import { RestTimer } from "@/components/shared/rest-timer"
import { muscleGroupBadgeClass } from "@/lib/badge-colors"
import { DAY_LABELS_SHORT } from "@/lib/labels"
import type { DayOfWeek } from "@/lib/types"
import { useCompletionsForDate, useSetItemCompletion, useWorkoutPlans } from "@/hooks/use-workouts"

const WEEK_ORDER: DayOfWeek[] = [
  "MONDAY",
  "TUESDAY",
  "WEDNESDAY",
  "THURSDAY",
  "FRIDAY",
  "SATURDAY",
  "SUNDAY",
]

// getDay() is 0-indexed from Sunday; map it onto our Monday-first week order.
const JS_DAY_TO_DAY_OF_WEEK: DayOfWeek[] = [
  "SUNDAY",
  "MONDAY",
  "TUESDAY",
  "WEDNESDAY",
  "THURSDAY",
  "FRIDAY",
  "SATURDAY",
]

function todayKey() {
  return new Date().toISOString().slice(0, 10)
}

export default function MemberRoutinePage() {
  const todayName = JS_DAY_TO_DAY_OF_WEEK[new Date().getDay()]
  const [selectedDay, setSelectedDay] = React.useState<DayOfWeek>(todayName)

  const { data: workoutPlans } = useWorkoutPlans()
  const activePlan = workoutPlans?.items.find((p) => p.is_active)
  const dayItems = (activePlan?.items ?? [])
    .filter((item) => item.day_of_week === selectedDay)
    .sort((a, b) => a.order - b.order)

  const today = todayKey()
  const isToday = selectedDay === todayName
  const { data: completedItemIds } = useCompletionsForDate(today)
  const setItemCompletion = useSetItemCompletion()
  const completedSet = new Set(completedItemIds ?? [])

  return (
    <MembershipGate>
    <div className="space-y-6">
      <FadeIn>
        <h1 className="flex items-center gap-2 text-lg font-semibold tracking-tight">
          <Dumbbell className="size-5 text-primary" />
          {activePlan?.name ?? "Tu rutina"}
        </h1>
      </FadeIn>

      <FadeIn delay={0.02}>
        <Tabs value={selectedDay} onValueChange={(v) => setSelectedDay(v as DayOfWeek)}>
          <TabsList className="grid! h-auto w-full grid-cols-7 gap-0.5 p-1">
            {WEEK_ORDER.map((day) => (
              <TabsTrigger key={day} value={day} className="px-0 text-[11px]">
                {DAY_LABELS_SHORT[day]}
              </TabsTrigger>
            ))}
          </TabsList>

          {WEEK_ORDER.map((day) => (
            <TabsContent key={day} value={day} className="mt-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">
                    {day === todayName ? "Hoy" : DAY_LABELS_SHORT[day]}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {!activePlan && (
                    <p className="text-sm text-muted-foreground">
                      Todavía no tienes una rutina asignada.
                    </p>
                  )}
                  {activePlan && dayItems.length === 0 && (
                    <p className="text-sm text-muted-foreground">
                      Día de descanso — nada programado.
                    </p>
                  )}
                  {dayItems.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-start justify-between gap-3 rounded-md border p-3"
                    >
                      <div className="flex items-start gap-3">
                        {isToday && (
                          <Checkbox
                            className="mt-0.5"
                            checked={completedSet.has(item.id)}
                            onCheckedChange={(checked) =>
                              setItemCompletion.mutate({
                                itemId: item.id,
                                completed: checked === true,
                                date: today,
                              })
                            }
                          />
                        )}
                        <div className="space-y-1">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <p
                              className={
                                isToday && completedSet.has(item.id)
                                  ? "text-sm font-medium text-muted-foreground line-through"
                                  : "text-sm font-medium"
                              }
                            >
                              {item.exercise.name}
                            </p>
                            <Badge className={muscleGroupBadgeClass(item.exercise.muscle_group)}>
                              {MUSCLE_LABELS[item.exercise.muscle_group] ?? item.exercise.muscle_group}
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {item.sets} × {item.reps}
                            {item.rpe ? ` @ RPE ${item.rpe}` : ""}
                          </p>
                          {item.exercise.description && (
                            <p className="max-w-sm text-xs text-muted-foreground">
                              {item.exercise.description}
                            </p>
                          )}
                        </div>
                      </div>
                      {isToday && item.rest_seconds ? <RestTimer seconds={item.rest_seconds} /> : null}
                    </div>
                  ))}
                </CardContent>
              </Card>
            </TabsContent>
          ))}
        </Tabs>
      </FadeIn>
    </div>
    </MembershipGate>
  )
}
