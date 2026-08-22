"use client"

import * as React from "react"
import { toast } from "sonner"
import { CreditCard } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { ApiError } from "@/lib/api-client"
import { SUBSCRIPTION_STATUS_LABELS } from "@/lib/labels"
import { useMemberships } from "@/hooks/use-memberships"
import { useCreateSubscription, useSubscriptions, useUpdateSubscription } from "@/hooks/use-subscriptions"

function statusVariant(status: string) {
  if (status === "ACTIVE") return "default"
  if (status === "PENDING") return "secondary"
  return "destructive"
}

export function SubscriptionDialog({
  userId,
  memberName,
}: {
  userId: string
  memberName: string
}) {
  const [open, setOpen] = React.useState(false)
  const [planId, setPlanId] = React.useState("")
  const { data: plans } = useMemberships()
  const { data: subs, isLoading } = useSubscriptions(userId)
  const createSub = useCreateSubscription()
  const updateSub = useUpdateSubscription()

  const activeSub = subs?.items.find((s) => s.status === "ACTIVE")
  const activePlan = plans?.items.find((p) => p.id === activeSub?.membership_id)

  const handleAssign = () => {
    if (!planId) {
      toast.error("Selecciona un plan primero")
      return
    }
    createSub.mutate(
      { user_id: userId, membership_id: planId },
      {
        onSuccess: () => {
          toast.success("Suscripción asignada")
          setPlanId("")
        },
        onError: (error) =>
          toast.error(error instanceof ApiError ? error.detail : "No se pudo asignar la suscripción"),
      }
    )
  }

  const handleCancel = (subscriptionId: string) => {
    updateSub.mutate(
      { id: subscriptionId, status: "CANCELLED" },
      {
        onSuccess: () => toast.success("Suscripción cancelada"),
        onError: (error) =>
          toast.error(error instanceof ApiError ? error.detail : "No se pudo cancelar"),
      }
    )
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="ghost" size="sm" />}>
        <CreditCard className="size-3.5" />
        Suscripción
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Suscripción de {memberName}</DialogTitle>
          <DialogDescription>Gestiona el plan de membresía de este miembro.</DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <Skeleton className="h-16 w-full" />
        ) : activeSub ? (
          <div className="space-y-3 rounded-md border p-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">{activePlan?.name ?? "Plan"}</p>
                <p className="text-xs text-muted-foreground">
                  Vence: {new Date(activeSub.end_date).toLocaleDateString()}
                </p>
              </div>
              <Badge variant={statusVariant(activeSub.status)}>
                {SUBSCRIPTION_STATUS_LABELS[activeSub.status]}
              </Badge>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="w-full"
              disabled={updateSub.isPending}
              onClick={() => handleCancel(activeSub.id)}
            >
              Cancelar suscripción
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Este miembro no tiene una suscripción activa.
            </p>
            <div className="flex gap-2">
              <Select value={planId} onValueChange={(v) => setPlanId(v ?? "")}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Elegir plan" />
                </SelectTrigger>
                <SelectContent>
                  {(plans?.items ?? [])
                    .filter((p) => p.is_active)
                    .map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name} — ${Number(p.price).toFixed(2)}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        )}

        {!activeSub && (
          <DialogFooter>
            <Button onClick={handleAssign} disabled={createSub.isPending || !planId}>
              {createSub.isPending ? "Asignando…" : "Asignar suscripción"}
            </Button>
          </DialogFooter>
        )}

        {subs && subs.items.length > 0 && (
          <div className="space-y-1 border-t pt-3">
            <p className="text-xs font-medium text-muted-foreground">Historial</p>
            {subs.items.map((s) => (
              <div key={s.id} className="flex items-center justify-between text-xs">
                <span>
                  {new Date(s.start_date).toLocaleDateString()} –{" "}
                  {new Date(s.end_date).toLocaleDateString()}
                </span>
                <Badge variant={statusVariant(s.status)} className="text-[10px]">
                  {SUBSCRIPTION_STATUS_LABELS[s.status]}
                </Badge>
              </div>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
