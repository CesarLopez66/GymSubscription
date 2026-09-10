"use client"

import * as React from "react"
import { CalendarClock, ChevronLeft, ChevronRight, Search } from "lucide-react"

import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { EntityCard } from "@/components/shared/entity-card"
import { FadeIn, StaggerGroup, StaggerItem } from "@/components/shared/motion"
import { PageHero } from "@/components/shared/page-hero"
import { initialsOf } from "@/components/shared/member-picker"
import { EvaluationPanel } from "@/components/trainer/evaluation-panel"
import { RoutinePanel } from "@/components/trainer/routine-panel"
import { MacrosPanel } from "@/components/trainer/macros-panel"
import { FITNESS_GOAL_BADGE_CLASSES } from "@/lib/badge-colors"
import { daysSince, formatRelativeDate } from "@/lib/format"
import { FITNESS_GOAL_LABELS } from "@/lib/labels"
import { useEvaluations } from "@/hooks/use-evaluations"
import { useUsers } from "@/hooks/use-users"
import { useAuthStore } from "@/store/auth-store"
import type { FitnessGoal, User } from "@/lib/types"

const STALE_DAYS = 30

export default function TrainerClientsPage() {
  const [selectedMember, setSelectedMember] = React.useState<User | null>(null)
  const [query, setQuery] = React.useState("")
  const roles = useAuthStore((s) => s.user?.roles ?? [])
  // A nutritionist-only staff member just prescribes macros — the
  // routine-editing tab is trainer/admin territory and would just clutter
  // their view. Someone holding TRAINER (or GYM_ADMIN) alongside NUTRITIONIST
  // still gets it — multiple roles means seeing every screen those roles
  // grant, not the most restrictive one.
  const showRoutineTab = roles.includes("TRAINER") || roles.includes("GYM_ADMIN")
  const { data: members, isLoading } = useUsers("MEMBER", 1, 100)
  // Gym-wide, most-recent-first — enough to read off each member's latest
  // evaluation date without an extra request per card.
  const { data: recentEvaluations } = useEvaluations(undefined, 1, 100)

  const lastEvaluationByMember = React.useMemo(() => {
    const map = new Map<string, { evaluated_at: string; fitness_goal: FitnessGoal }>()
    for (const ev of recentEvaluations?.items ?? []) {
      if (!map.has(ev.user_id)) {
        map.set(ev.user_id, { evaluated_at: ev.evaluated_at, fitness_goal: ev.fitness_goal })
      }
    }
    return map
  }, [recentEvaluations])

  const filtered = (members?.items ?? []).filter((m) => {
    const q = query.trim().toLowerCase()
    if (!q) return true
    return (
      `${m.first_name} ${m.last_name}`.toLowerCase().includes(q) ||
      m.email.toLowerCase().includes(q)
    )
  })

  if (selectedMember) {
    return (
      <div className="space-y-6">
        <FadeIn className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => setSelectedMember(null)}>
            <ChevronLeft className="size-4" />
            Clientes
          </Button>
          <div className="flex items-center gap-2.5">
            <Avatar size="lg">
              <AvatarFallback className="bg-primary/10 font-medium text-primary">
                {initialsOf(selectedMember)}
              </AvatarFallback>
            </Avatar>
            <div>
              <p className="font-semibold leading-tight">
                {selectedMember.first_name} {selectedMember.last_name}
              </p>
              <p className="text-xs text-muted-foreground">{selectedMember.email}</p>
            </div>
          </div>
        </FadeIn>

        <Tabs defaultValue="evaluate">
          <TabsList>
            <TabsTrigger value="evaluate">Evaluar</TabsTrigger>
            {showRoutineTab && <TabsTrigger value="routine">Rutina</TabsTrigger>}
            <TabsTrigger value="macros">Macros</TabsTrigger>
          </TabsList>
          <TabsContent value="evaluate">
            <EvaluationPanel memberId={selectedMember.id} />
          </TabsContent>
          {showRoutineTab && (
            <TabsContent value="routine">
              <RoutinePanel memberId={selectedMember.id} />
            </TabsContent>
          )}
          <TabsContent value="macros">
            <MacrosPanel memberId={selectedMember.id} />
          </TabsContent>
        </Tabs>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <PageHero
        title="Clientes"
        subtitle="Selecciona un miembro para evaluarlo, revisar su rutina o ajustar sus macros."
      />

      <FadeIn delay={0.05} className="relative max-w-sm">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Buscar por nombre o correo…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="pl-9"
        />
      </FadeIn>

      <StaggerGroup className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.map((member) => {
          const lastEval = lastEvaluationByMember.get(member.id)
          const stale = lastEval ? daysSince(lastEval.evaluated_at) >= STALE_DAYS : true
          return (
            <StaggerItem key={member.id}>
              <EntityCard interactive alert={stale} onClick={() => setSelectedMember(member)}>
                <div className="flex items-center gap-3">
                  <Avatar size="lg" className="shrink-0">
                    <AvatarFallback className="bg-primary/10 font-medium text-primary">
                      {initialsOf(member)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold leading-tight">
                      {member.first_name} {member.last_name}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">{member.email}</p>
                  </div>
                  <ChevronRight className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                </div>

                <div className="flex items-center justify-between gap-2 border-t pt-3">
                  <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <CalendarClock className="size-3.5 shrink-0" />
                    {lastEval ? formatRelativeDate(lastEval.evaluated_at) : "Sin evaluaciones"}
                  </span>
                  {lastEval && (
                    <Badge className={FITNESS_GOAL_BADGE_CLASSES[lastEval.fitness_goal]}>
                      {FITNESS_GOAL_LABELS[lastEval.fitness_goal]}
                    </Badge>
                  )}
                </div>

                {stale && (
                  <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center bg-background/70 backdrop-blur-[1px]">
                    <span className="-rotate-12 text-2xl font-black tracking-wide whitespace-nowrap text-destructive uppercase drop-shadow-sm select-none">
                      {lastEval ? "Vencida" : "Sin evaluar"}
                    </span>
                  </div>
                )}
              </EntityCard>
            </StaggerItem>
          )
        })}
      </StaggerGroup>

      {!isLoading && filtered.length === 0 && (
        <p className="text-sm text-muted-foreground">No se encontraron miembros.</p>
      )}
    </div>
  )
}
