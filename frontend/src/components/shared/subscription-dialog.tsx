"use client"

import * as React from "react"
import { toast } from "sonner"
import { CreditCard, QrCode } from "lucide-react"

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
import { BranchSelect } from "@/components/shared/branch-select"
import { ConfirmDialog } from "@/components/shared/confirm-dialog"
import { PlanPriceLabel } from "@/components/shared/plan-price-label"
import { ApiError } from "@/lib/api-client"
import { formatCurrency } from "@/lib/currency"
import { SUBSCRIPTION_STATUS_LABELS } from "@/lib/labels"
import { applicablePromotion, discountedPrice } from "@/lib/promotions"
import { useMemberships } from "@/hooks/use-memberships"
import { useMyGym } from "@/hooks/use-gyms"
import { usePromotions } from "@/hooks/use-promotions"
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
  const [branchId, setBranchId] = React.useState<string | undefined>(undefined)
  const [confirmCancel, setConfirmCancel] = React.useState(false)
  const { data: plans } = useMemberships()
  const { data: promotions } = usePromotions(1, 100)
  const { data: myGym } = useMyGym()
  const { data: subs, isLoading } = useSubscriptions(userId)
  const createSub = useCreateSubscription()
  const updateSub = useUpdateSubscription()

  const activeSub = subs?.items.find((s) => s.status === "ACTIVE")
  const activePlan = plans?.items.find((p) => p.id === activeSub?.membership_id)

  // Pre-fills the plan picker with whatever the member is already on when
  // the dialog opens — renewing is then just confirming the amount and
  // hitting the button, instead of re-searching the same plan in the list.
  // `useSubscriptions(userId)` above runs unconditionally (not gated on
  // `open`), so `activeSub` is already loaded by the time this fires in the
  // near-totality of real opens.
  const handleOpenChange = (next: boolean) => {
    setOpen(next)
    if (next && activeSub) {
      setPlanId(activeSub.membership_id)
    }
  }

  const planItems = (plans?.items ?? [])
    .filter((p) => p.is_active)
    .map((p) => ({
      value: p.id,
      label: <PlanPriceLabel plan={p} promo={applicablePromotion(promotions?.items ?? [], p.id)} />,
    }))

  const selectedPlan = plans?.items.find((p) => p.id === planId)
  const selectedPromo = selectedPlan
    ? applicablePromotion(promotions?.items ?? [], selectedPlan.id)
    : undefined
  const amountToCharge = selectedPlan
    ? selectedPromo
      ? discountedPrice(Number(selectedPlan.price), selectedPromo)
      : Number(selectedPlan.price)
    : 0

  const handleAssign = () => {
    if (!selectedPlan) {
      toast.error("Selecciona un plan primero")
      return
    }
    createSub.mutate(
      {
        user_id: userId,
        membership_id: selectedPlan.id,
        branch_id: branchId,
        payment_amount: amountToCharge,
        payment_method: "QR",
      },
      {
        onSuccess: () => {
          toast.success(activeSub ? "Suscripción renovada" : "Pago registrado y suscripción asignada")
          setPlanId("")
          setBranchId(undefined)
        },
        onError: (error) =>
          toast.error(error instanceof ApiError ? error.detail : "No se pudo cobrar y asignar la suscripción"),
      }
    )
  }

  const handleCancel = (subscriptionId: string) => {
    updateSub.mutate(
      { id: subscriptionId, status: "CANCELLED" },
      {
        onSuccess: () => {
          toast.success("Suscripción cancelada")
          setConfirmCancel(false)
        },
        onError: (error) =>
          toast.error(error instanceof ApiError ? error.detail : "No se pudo cancelar"),
      }
    )
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
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
        ) : (
          <div className="space-y-3">
            {activeSub ? (
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
                  onClick={() => setConfirmCancel(true)}
                >
                  Cancelar suscripción
                </Button>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                Este miembro no tiene una suscripción activa.
              </p>
            )}

            <div className="space-y-3">
              {activeSub && (
                <p className="text-xs font-medium text-muted-foreground">
                  Renovar / cambiar de plan
                </p>
              )}
              <Select items={planItems} value={planId} onValueChange={(v) => setPlanId(v ?? "")}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Elegir plan" />
                </SelectTrigger>
                <SelectContent>
                  {planItems.map((item) => (
                    <SelectItem key={item.value} value={item.value}>
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <BranchSelect value={branchId} onChange={setBranchId} />

              {selectedPlan && (
                <div className="flex items-center gap-4 rounded-md border p-3">
                  {myGym?.payment_qr_image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={myGym.payment_qr_image}
                      alt="QR de cobro"
                      className="size-20 shrink-0 rounded-lg bg-white p-1.5 object-contain"
                    />
                  ) : (
                    <div className="flex size-20 shrink-0 items-center justify-center rounded-lg border border-dashed border-muted-foreground/40 text-muted-foreground">
                      <QrCode className="size-6" />
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-xs text-muted-foreground">Monto a cobrar</p>
                    <p className="text-lg font-semibold">{formatCurrency(amountToCharge)}</p>
                    {!myGym?.payment_qr_image && (
                      <p className="text-xs text-destructive">
                        Sube el QR de cobro del gimnasio en Pagos antes de continuar.
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        <DialogFooter>
          <Button
            onClick={handleAssign}
            disabled={createSub.isPending || !selectedPlan || !myGym?.payment_qr_image}
          >
            {createSub.isPending
              ? "Cobrando…"
              : activeSub
                ? "Renovar suscripción"
                : "Cobrar y asignar suscripción"}
          </Button>
        </DialogFooter>

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

      {activeSub && (
        <ConfirmDialog
          open={confirmCancel}
          onOpenChange={setConfirmCancel}
          title="Cancelar suscripción"
          description={`Esto revoca el acceso de ${memberName} al gimnasio de inmediato, desde su próximo check-in. ¿Confirmas la cancelación?`}
          confirmLabel="Cancelar suscripción"
          isPending={updateSub.isPending}
          onConfirm={() => handleCancel(activeSub.id)}
        />
      )}
    </Dialog>
  )
}
