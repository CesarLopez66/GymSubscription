"use client"

import * as React from "react"
import { Building2, Search } from "lucide-react"

import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { FadeIn, StaggerGroup, StaggerItem } from "@/components/shared/motion"
import { LoadingOverlay } from "@/components/shared/refetching-indicator"
import { GYM_STATUS_LABELS } from "@/lib/labels"
import type { GymStatus } from "@/lib/types"
import { useGyms } from "@/hooks/use-gyms"
import { useSuperAdminOverview } from "@/hooks/use-superadmin"
import { CreateGymDialog } from "./create-gym-dialog"
import { GymCard } from "./gym-card"

const ALL_STATUSES = "__all__"
const GYM_STATUSES: GymStatus[] = ["TRIAL", "ACTIVE", "SUSPENDED", "CANCELLED"]

export default function SuperAdminGymsPage() {
  const [search, setSearch] = React.useState("")
  const [statusFilter, setStatusFilter] = React.useState<string>(ALL_STATUSES)
  const { data, isLoading, isFetching } = useGyms(1, 100, {
    search: search.trim() || undefined,
    status: statusFilter === ALL_STATUSES ? undefined : (statusFilter as GymStatus),
  })
  // Per-gym usage/revenue snapshot (last 30 days) — the superadmin manages
  // paying tenants here, so each card needs more than contact info to act on.
  const { data: overview } = useSuperAdminOverview(30, null)
  const breakdownByGym = React.useMemo(
    () => new Map((overview?.gyms_breakdown ?? []).map((g) => [g.gym_id, g])),
    [overview]
  )

  const gyms = data?.items ?? []

  return (
    <div className="space-y-6">
      <LoadingOverlay show={isFetching && !isLoading} />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
            <Building2 className="size-5" />
            Gimnasios
          </h1>
          <p className="text-sm text-muted-foreground">
            {gyms.length} tenant{gyms.length === 1 ? "" : "s"} registrado{gyms.length === 1 ? "" : "s"} en la plataforma
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <CreateGymDialog />
        </div>
      </div>

      <FadeIn delay={0.02}>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1 sm:max-w-xs">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar por nombre o subdominio…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select
            items={{ [ALL_STATUSES]: "Todos los estados", ...GYM_STATUS_LABELS }}
            value={statusFilter}
            onValueChange={(v) => setStatusFilter(v ?? ALL_STATUSES)}
          >
            <SelectTrigger className="w-full sm:w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_STATUSES}>Todos los estados</SelectItem>
              {GYM_STATUSES.map((s) => (
                <SelectItem key={s} value={s}>
                  {GYM_STATUS_LABELS[s]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </FadeIn>

      <FadeIn delay={0.05}>
        <Card>
          <CardContent>
            {isLoading ? (
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-40 w-full" />
                ))}
              </div>
            ) : (
              <StaggerGroup className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {gyms.map((gym) => (
                  <StaggerItem key={gym.id}>
                    <GymCard gym={gym} breakdown={breakdownByGym.get(gym.id)} />
                  </StaggerItem>
                ))}
                {gyms.length === 0 && (
                  <p className="text-sm text-muted-foreground sm:col-span-2 lg:col-span-3 xl:col-span-4">
                    Todavía no hay gimnasios.
                  </p>
                )}
              </StaggerGroup>
            )}
          </CardContent>
        </Card>
      </FadeIn>
    </div>
  )
}
