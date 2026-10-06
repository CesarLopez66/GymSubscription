"use client"

import * as React from "react"
import Link from "next/link"
import { toast } from "sonner"
import { AlertTriangle, Banknote, CalendarDays, CreditCard, Eye, MapPin, Users } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { EntityCard } from "@/components/shared/entity-card"
import { ApiError } from "@/lib/api-client"
import { GYM_STATUS_BADGE_CLASSES, riskBadgeClass } from "@/lib/badge-colors"
import { formatCurrency } from "@/lib/currency"
import { formatRelativeDate } from "@/lib/format"
import { GYM_STATUS_LABELS, PLAN_TIER_LABELS } from "@/lib/labels"
import type { Gym, GymBreakdown, SaaSPlanTier } from "@/lib/types"
import { useReactivateGym, useSuspendGym, useUpdateGym } from "@/hooks/use-gyms"

const PLAN_TIERS: SaaSPlanTier[] = ["FREE", "BASIC", "PRO", "ENTERPRISE"]

export function GymCard({ gym, breakdown }: { gym: Gym; breakdown: GymBreakdown | undefined }) {
  const updateGym = useUpdateGym()
  const suspendGym = useSuspendGym()
  const reactivateGym = useReactivateGym()
  const [suspendOpen, setSuspendOpen] = React.useState(false)
  const [suspendReason, setSuspendReason] = React.useState("")

  const handleReactivate = () => {
    reactivateGym.mutate(gym.id, {
      onSuccess: () => toast.success(`${gym.name} reactivado`),
      onError: (error) => toast.error(error instanceof ApiError ? error.detail : "No se pudo reactivar"),
    })
  }

  const confirmSuspend = () => {
    if (!suspendReason.trim()) return
    suspendGym.mutate(
      { id: gym.id, reason: suspendReason.trim() },
      {
        onSuccess: () => {
          toast.success(`${gym.name} suspendido`)
          setSuspendOpen(false)
          setSuspendReason("")
        },
        onError: (error) => toast.error(error instanceof ApiError ? error.detail : "No se pudo suspender"),
      }
    )
  }

  return (
    <>
      <EntityCard>
        <div className="flex items-center justify-between gap-2">
          <p className="truncate font-semibold">{gym.name}</p>
          <Button variant="ghost" size="sm" nativeButton={false} render={<Link href={`/superadmin/gyms/${gym.id}`} />}>
            <Eye className="size-3.5" />
            Ver
          </Button>
        </div>
        <div className="space-y-0.5 text-xs text-muted-foreground">
          <p>{gym.subdomain}</p>
          <p className="truncate">{gym.contact_email}</p>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <Badge className={GYM_STATUS_BADGE_CLASSES[gym.status]}>{GYM_STATUS_LABELS[gym.status]}</Badge>
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
          <div className="flex items-center gap-1.5 text-muted-foreground" title="Usuarios totales">
            <Users className="size-3.5 shrink-0" />
            <span className="ml-auto font-medium text-foreground">{breakdown?.users_total ?? "—"}</span>
          </div>
          <div className="flex items-center gap-1.5 text-muted-foreground" title="Sucursales">
            <MapPin className="size-3.5 shrink-0" />
            <span className="ml-auto font-medium text-foreground">{breakdown?.branches_total ?? "—"}</span>
          </div>
          <div className="flex items-center gap-1.5 text-muted-foreground" title="Suscripciones activas">
            <CreditCard className="size-3.5 shrink-0" />
            <span className="ml-auto font-medium text-foreground">
              {breakdown?.active_subscriptions ?? "—"}
            </span>
          </div>
          <div className="flex items-center gap-1.5 text-muted-foreground" title="Ingresos (últimos 30 días)">
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
              onClick={handleReactivate}
            >
              Reactivar
            </Button>
          ) : (
            <Button
              variant="outline"
              size="sm"
              className="w-full"
              onClick={() => {
                setSuspendReason("")
                setSuspendOpen(true)
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
                    toast.error(error instanceof ApiError ? error.detail : "No se pudo actualizar"),
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

      <Dialog open={suspendOpen} onOpenChange={setSuspendOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Suspender {gym.name}</DialogTitle>
          </DialogHeader>
          <Textarea
            autoFocus
            placeholder="Motivo (ej. pago de suscripción SaaS vencido)"
            value={suspendReason}
            onChange={(e) => setSuspendReason(e.target.value)}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setSuspendOpen(false)}>
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
    </>
  )
}
