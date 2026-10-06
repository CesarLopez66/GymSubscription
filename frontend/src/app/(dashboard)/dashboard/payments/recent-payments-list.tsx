"use client"

import * as React from "react"
import { toast } from "sonner"
import { Ban, RotateCcw } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { ConfirmDialog } from "@/components/shared/confirm-dialog"
import { EntityCard } from "@/components/shared/entity-card"
import { FadeIn, StaggerGroup, StaggerItem } from "@/components/shared/motion"
import { ApiError } from "@/lib/api-client"
import { PAYMENT_STATUS_BADGE_CLASSES } from "@/lib/badge-colors"
import { formatCurrency } from "@/lib/currency"
import { formatRelativeDate } from "@/lib/format"
import { PAYMENT_METHOD_LABELS, PAYMENT_STATUS_LABELS, PAYMENT_TYPE_LABELS } from "@/lib/labels"
import type { Payment, PaymentStatus } from "@/lib/types"
import { useUpdatePaymentStatus } from "@/hooks/use-payments"

export function RecentPaymentsList({ payments, isLoading }: { payments: Payment[]; isLoading: boolean }) {
  const updateStatus = useUpdatePaymentStatus()
  const [refundTarget, setRefundTarget] = React.useState<string | null>(null)

  const handleStatus = (id: string, status: PaymentStatus, successMsg: string) => {
    updateStatus.mutate(
      { id, status },
      {
        onSuccess: () => toast.success(successMsg),
        onError: (error) =>
          toast.error(error instanceof ApiError ? error.detail : "No se pudo actualizar el pago"),
      }
    )
  }

  return (
    <FadeIn delay={0.1}>
      <Card>
        <CardHeader>
          <CardTitle>Transacciones recientes</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-24 w-full" />
              ))}
            </div>
          ) : (
            <StaggerGroup className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {payments.map((p) => (
                <StaggerItem key={p.id}>
                  <EntityCard contentClassName="gap-2 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium">{formatCurrency(p.amount)}</span>
                      <Badge className={PAYMENT_STATUS_BADGE_CLASSES[p.status]}>
                        {PAYMENT_STATUS_LABELS[p.status]}
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                      <span>
                        {PAYMENT_TYPE_LABELS[p.payment_type]} · {PAYMENT_METHOD_LABELS[p.payment_method]}
                      </span>
                      <span>{formatRelativeDate(p.created_at)}</span>
                    </div>
                    {(p.status === "COMPLETED" || p.status === "PENDING") && (
                      <div className="flex justify-end gap-1 border-t pt-2">
                        {p.status === "COMPLETED" && (
                          <Button
                            variant="ghost"
                            size="sm"
                            disabled={updateStatus.isPending}
                            onClick={() => setRefundTarget(p.id)}
                          >
                            <RotateCcw className="size-3.5" />
                            Reembolsar
                          </Button>
                        )}
                        {p.status === "PENDING" && !p.membership_id && (
                          <>
                            <Button
                              variant="ghost"
                              size="sm"
                              disabled={updateStatus.isPending}
                              onClick={() => handleStatus(p.id, "COMPLETED", "Pago marcado como completado")}
                            >
                              Completar
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              disabled={updateStatus.isPending}
                              onClick={() => handleStatus(p.id, "FAILED", "Pago marcado como cancelado")}
                            >
                              <Ban className="size-3.5" />
                              Cancelar
                            </Button>
                          </>
                        )}
                        {p.status === "PENDING" && p.membership_id && (
                          <span className="text-xs text-muted-foreground">
                            Ver en &quot;Pendientes de aprobación&quot; arriba
                          </span>
                        )}
                      </div>
                    )}
                  </EntityCard>
                </StaggerItem>
              ))}
              {payments.length === 0 && (
                <p className="text-sm text-muted-foreground sm:col-span-2">
                  Todavía no hay transacciones.
                </p>
              )}
            </StaggerGroup>
          )}
        </CardContent>
      </Card>

      <ConfirmDialog
        open={refundTarget !== null}
        onOpenChange={(open) => !open && setRefundTarget(null)}
        title="Reembolsar pago"
        description="Esta acción marca el pago como reembolsado y no se puede deshacer desde aquí. ¿Confirmas el reembolso?"
        confirmLabel="Reembolsar"
        isPending={updateStatus.isPending}
        onConfirm={() => {
          if (!refundTarget) return
          handleStatus(refundTarget, "REFUNDED", "Pago reembolsado")
          setRefundTarget(null)
        }}
      />
    </FadeIn>
  )
}
