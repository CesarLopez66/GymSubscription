"use client"

import * as React from "react"
import Link from "next/link"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { z } from "zod"
import { toast } from "sonner"
import {
  AlertTriangle,
  Banknote,
  Building2,
  CalendarDays,
  CreditCard,
  Eye,
  MapPin,
  Plus,
  Search,
  Users,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
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
import { Skeleton } from "@/components/ui/skeleton"
import { Textarea } from "@/components/ui/textarea"
import { EntityCard } from "@/components/shared/entity-card"
import { FadeIn, StaggerGroup, StaggerItem } from "@/components/shared/motion"
import { LoadingOverlay } from "@/components/shared/refetching-indicator"
import { ApiError } from "@/lib/api-client"
import { GYM_STATUS_BADGE_CLASSES, riskBadgeClass } from "@/lib/badge-colors"
import { formatCurrency } from "@/lib/currency"
import { formatRelativeDate } from "@/lib/format"
import { GYM_STATUS_LABELS, PLAN_TIER_LABELS } from "@/lib/labels"
import type { Gym, GymStatus, SaaSPlanTier } from "@/lib/types"
import { useCreateGym, useGyms, useReactivateGym, useSuspendGym, useUpdateGym } from "@/hooks/use-gyms"
import { useSuperAdminOverview } from "@/hooks/use-superadmin"

const ALL_STATUSES = "__all__"
const GYM_STATUSES: GymStatus[] = ["TRIAL", "ACTIVE", "SUSPENDED", "CANCELLED"]

const gymSchema = z.object({
  name: z.string().min(2),
  subdomain: z
    .string()
    .min(2)
    .regex(/^[a-z0-9-]+$/, "Solo minúsculas, números y guiones"),
  contact_email: z.string().email(),
  contact_phone: z.string().optional(),
  address: z.string().optional(),
  plan_tier: z.enum(["FREE", "BASIC", "PRO", "ENTERPRISE"]),
})

type GymFormValues = z.infer<typeof gymSchema>

const PLAN_TIERS: SaaSPlanTier[] = ["FREE", "BASIC", "PRO", "ENTERPRISE"]

export default function SuperAdminGymsPage() {
  const [open, setOpen] = React.useState(false)
  const [suspendTarget, setSuspendTarget] = React.useState<Gym | null>(null)
  const [suspendReason, setSuspendReason] = React.useState("")
  const [search, setSearch] = React.useState("")
  const [statusFilter, setStatusFilter] = React.useState<string>(ALL_STATUSES)
  const { data, isLoading, isFetching } = useGyms(1, 100, {
    search: search.trim() || undefined,
    status: statusFilter === ALL_STATUSES ? undefined : (statusFilter as GymStatus),
  })
  const createGym = useCreateGym()
  const updateGym = useUpdateGym()
  const suspendGym = useSuspendGym()
  const reactivateGym = useReactivateGym()
  // Per-gym usage/revenue snapshot (last 30 days) — the superadmin manages
  // paying tenants here, so each card needs more than contact info to act on.
  const { data: overview } = useSuperAdminOverview(30, null)
  const breakdownByGym = React.useMemo(
    () => new Map((overview?.gyms_breakdown ?? []).map((g) => [g.gym_id, g])),
    [overview]
  )

  const confirmSuspend = () => {
    if (!suspendTarget || !suspendReason.trim()) return
    suspendGym.mutate(
      { id: suspendTarget.id, reason: suspendReason.trim() },
      {
        onSuccess: () => {
          toast.success(`${suspendTarget.name} suspendido`)
          setSuspendTarget(null)
          setSuspendReason("")
        },
        onError: (error) =>
          toast.error(error instanceof ApiError ? error.detail : "No se pudo suspender"),
      }
    )
  }

  const handleReactivate = (gym: Gym) => {
    reactivateGym.mutate(gym.id, {
      onSuccess: () => toast.success(`${gym.name} reactivado`),
      onError: (error) =>
        toast.error(error instanceof ApiError ? error.detail : "No se pudo reactivar"),
    })
  }

  const form = useForm<GymFormValues>({
    resolver: zodResolver(gymSchema),
    defaultValues: {
      name: "",
      subdomain: "",
      contact_email: "",
      contact_phone: "",
      address: "",
      plan_tier: "FREE",
    },
  })

  const onSubmit = (values: GymFormValues) => {
    createGym.mutate(values, {
      onSuccess: () => {
        toast.success(`${values.name} creado`)
        form.reset()
        setOpen(false)
      },
      onError: (error) => {
        toast.error(error instanceof ApiError ? error.detail : "No se pudo crear el gimnasio")
      },
    })
  }

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
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger render={<Button size="sm" />}>
              <Plus className="size-4" />
              Nuevo gimnasio
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Crear gimnasio</DialogTitle>
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
                          <Input placeholder="Acme Fitness" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="subdomain"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Subdominio</FormLabel>
                        <FormControl>
                          <Input placeholder="acme" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="contact_email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Correo de contacto</FormLabel>
                        <FormControl>
                          <Input type="email" placeholder="owner@acme.com" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="contact_phone"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Teléfono de contacto</FormLabel>
                        <FormControl>
                          <Input placeholder="Opcional" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="plan_tier"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Plan</FormLabel>
                        <Select items={PLAN_TIER_LABELS} value={field.value} onValueChange={field.onChange}>
                          <FormControl>
                            <SelectTrigger className="w-full">
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {PLAN_TIERS.map((tier) => (
                              <SelectItem key={tier} value={tier}>
                                {PLAN_TIER_LABELS[tier]}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <DialogFooter>
                    <Button type="submit" disabled={createGym.isPending}>
                      {createGym.isPending ? "Creando…" : "Crear gimnasio"}
                    </Button>
                  </DialogFooter>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
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
              {gyms.map((gym) => {
                const breakdown = breakdownByGym.get(gym.id)
                return (
                  <StaggerItem key={gym.id}>
                    <EntityCard>
                      <div className="flex items-center justify-between gap-2">
                        <p className="truncate font-semibold">{gym.name}</p>
                        <Button
                          variant="ghost"
                          size="sm"
                          nativeButton={false}
                          render={<Link href={`/superadmin/gyms/${gym.id}`} />}
                        >
                          <Eye className="size-3.5" />
                          Ver
                        </Button>
                      </div>
                      <div className="space-y-0.5 text-xs text-muted-foreground">
                        <p>{gym.subdomain}</p>
                        <p className="truncate">{gym.contact_email}</p>
                      </div>

                      <div className="flex flex-wrap items-center gap-1.5">
                        <Badge className={GYM_STATUS_BADGE_CLASSES[gym.status]}>
                          {GYM_STATUS_LABELS[gym.status]}
                        </Badge>
                        <Badge variant="secondary">{PLAN_TIER_LABELS[gym.plan_tier]}</Badge>
                        {breakdown?.is_trial_expired && (
                          <Badge className={riskBadgeClass(true)}>
                            <AlertTriangle className="size-3" />
                            Trial vencido
                          </Badge>
                        )}
                        {breakdown?.is_at_risk && !breakdown?.is_trial_expired && (
                          <Badge className={riskBadgeClass(true)}>
                            <AlertTriangle className="size-3" />
                            En riesgo
                          </Badge>
                        )}
                      </div>

                      <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 border-t pt-3 text-xs">
                        <div
                          className="flex items-center gap-1.5 text-muted-foreground"
                          title="Usuarios totales"
                        >
                          <Users className="size-3.5 shrink-0" />
                          <span className="ml-auto font-medium text-foreground">
                            {breakdown?.users_total ?? "—"}
                          </span>
                        </div>
                        <div
                          className="flex items-center gap-1.5 text-muted-foreground"
                          title="Sucursales"
                        >
                          <MapPin className="size-3.5 shrink-0" />
                          <span className="ml-auto font-medium text-foreground">
                            {breakdown?.branches_total ?? "—"}
                          </span>
                        </div>
                        <div
                          className="flex items-center gap-1.5 text-muted-foreground"
                          title="Suscripciones activas"
                        >
                          <CreditCard className="size-3.5 shrink-0" />
                          <span className="ml-auto font-medium text-foreground">
                            {breakdown?.active_subscriptions ?? "—"}
                          </span>
                        </div>
                        <div
                          className="flex items-center gap-1.5 text-muted-foreground"
                          title="Ingresos (últimos 30 días)"
                        >
                          <Banknote className="size-3.5 shrink-0" />
                          <span className="ml-auto font-medium text-foreground">
                            {breakdown ? formatCurrency(breakdown.revenue_period) : "—"}
                          </span>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2 border-t pt-3">
                        {gym.status === "SUSPENDED" ? (
                          <Button
                            variant="outline"
                            size="sm"
                            className="w-full"
                            disabled={reactivateGym.isPending}
                            onClick={() => handleReactivate(gym)}
                          >
                            Reactivar
                          </Button>
                        ) : (
                          <Button
                            variant="outline"
                            size="sm"
                            className="w-full"
                            onClick={() => {
                              setSuspendTarget(gym)
                              setSuspendReason("")
                            }}
                          >
                            Suspender
                          </Button>
                        )}
                        <Select
                          items={PLAN_TIER_LABELS}
                          value={gym.plan_tier}
                          onValueChange={(plan_tier) =>
                            updateGym.mutate(
                              { id: gym.id, input: { plan_tier: plan_tier as SaaSPlanTier } },
                              {
                                onError: (error) =>
                                  toast.error(
                                    error instanceof ApiError
                                      ? error.detail
                                      : "No se pudo actualizar"
                                  ),
                              }
                            )
                          }
                        >
                          <SelectTrigger size="sm" className="w-full">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {PLAN_TIERS.map((tier) => (
                              <SelectItem key={tier} value={tier}>
                                {PLAN_TIER_LABELS[tier]}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                        <CalendarDays className="size-3 shrink-0" />
                        Cliente desde {formatRelativeDate(gym.created_at)}
                      </p>
                    </EntityCard>
                  </StaggerItem>
                )
              })}
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

      <Dialog open={suspendTarget !== null} onOpenChange={(open) => !open && setSuspendTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Suspender {suspendTarget?.name}</DialogTitle>
          </DialogHeader>
          <Textarea
            autoFocus
            placeholder="Motivo (ej. pago de suscripción SaaS vencido)"
            value={suspendReason}
            onChange={(e) => setSuspendReason(e.target.value)}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setSuspendTarget(null)}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              disabled={suspendGym.isPending || !suspendReason.trim()}
              onClick={confirmSuspend}
            >
              {suspendGym.isPending ? "Suspendiendo…" : "Suspender"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
