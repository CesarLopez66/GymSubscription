"use client"

import * as React from "react"
import { toast } from "sonner"
import { Ban } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { EntityCard } from "@/components/shared/entity-card"
import { FadeIn, StaggerGroup, StaggerItem } from "@/components/shared/motion"
import { ApiError } from "@/lib/api-client"
import { formatCurrency } from "@/lib/currency"
import { formatRelativeDate } from "@/lib/format"
import type { Payment } from "@/lib/types"
import { useApprovePayment, useRejectPayment } from "@/hooks/use-payments"
import { useUsers } from "@/hooks/use-users"

export function PendingClaimsCard({ payments }: { payments: Payment[] }) {
  const { data: members } = useUsers("MEMBER", 1, 100)
  const approvePayment = useApprovePayment()
  const rejectPayment = useRejectPayment()
  const [rejectTarget, setRejectTarget] = React.useState<string | null>(null)
  const [rejectReason, setRejectReason] = React.useState("")

  const memberName = (userId: string | null) => {
    if (!userId) return "—"
    const m = members?.items.find((u) => u.id === userId)
    return m ? `${m.first_name} ${m.last_name}` : userId.slice(0, 8)
  }

  const pendingClaims = payments.filter((p) => p.status === "PENDING" && p.membership_id)

  const handleApprove = (id: string) => {
    approvePayment.mutate(id, {
      onSuccess: () => toast.success("Pago aprobado — suscripción activada"),
      onError: (error) =>
        toast.error(error instanceof ApiError ? error.detail : "No se pudo aprobar el pago"),
    })
  }

  const confirmReject = () => {
    if (!rejectTarget || !rejectReason.trim()) return
    rejectPayment.mutate(
      { id: rejectTarget, reason: rejectReason.trim() },
      {
        onSuccess: () => {
          toast.success("Pago rechazado")
          setRejectTarget(null)
          setRejectReason("")
        },
        onError: (error) =>
          toast.error(error instanceof ApiError ? error.detail : "No se pudo rechazar el pago"),
      }
    )
  }

  if (pendingClaims.length === 0) return null

  return (
    <FadeIn delay={0.03}>
      <Card className="border-primary/30">
        <CardHeader>
          <CardTitle>Pendientes de aprobación ({pendingClaims.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <StaggerGroup className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {pendingClaims.map((p) => (
              <StaggerItem key={p.id}>
                <EntityCard contentClassName="gap-2 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium">{memberName(p.user_id)}</span>
                    <span className="font-medium">{formatCurrency(p.amount)}</span>
                  </div>
                  {p.proof_image && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={p.proof_image}
                      alt="Comprobante de pago"
                      className="h-32 w-full rounded-md border object-contain bg-muted"
                    />
                  )}
                  <span className="text-xs text-muted-foreground">
                    {formatRelativeDate(p.created_at)}
                  </span>
                  <div className="flex justify-end gap-1 border-t pt-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={approvePayment.isPending}
                      onClick={() => {
                        setRejectTarget(p.id)
                        setRejectReason("")
                      }}
                    >
                      <Ban className="size-3.5" />
                      Rechazar
                    </Button>
                    <Button
                      size="sm"
                      disabled={approvePayment.isPending}
                      onClick={() => handleApprove(p.id)}
                    >
                      Aprobar
                    </Button>
                  </div>
                </EntityCard>
              </StaggerItem>
            ))}
          </StaggerGroup>
        </CardContent>
      </Card>

      <Dialog open={rejectTarget !== null} onOpenChange={(open) => !open && setRejectTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rechazar comprobante</DialogTitle>
          </DialogHeader>
          <Textarea
            autoFocus
            placeholder="Motivo (ej. el comprobante no corresponde al monto, no se ve claro, etc.)"
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectTarget(null)}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              disabled={rejectPayment.isPending || !rejectReason.trim()}
              onClick={confirmReject}
            >
              {rejectPayment.isPending ? "Rechazando…" : "Rechazar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </FadeIn>
  )
}
