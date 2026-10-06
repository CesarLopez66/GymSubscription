"use client"

import * as React from "react"
import { toast } from "sonner"
import { Ban, CreditCard } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { EntityCard } from "@/components/shared/entity-card"
import { FadeIn, StaggerGroup, StaggerItem } from "@/components/shared/motion"
import { ApiError } from "@/lib/api-client"
import { SUBSCRIPTION_REQUEST_STATUS_BADGE_CLASSES } from "@/lib/badge-colors"
import { formatCurrency } from "@/lib/currency"
import { formatRelativeDate } from "@/lib/format"
import { PLAN_TIER_LABELS, SUBSCRIPTION_REQUEST_STATUS_LABELS } from "@/lib/labels"
import type { SubscriptionRequestStatus } from "@/lib/types"
import {
  useApproveSubscriptionPayment,
  useRejectSubscriptionPayment,
  useSubscriptionPayments,
} from "@/hooks/use-gym-subscriptions"

const ALL_STATUS = "ALL"
const STATUSES: SubscriptionRequestStatus[] = ["PENDING", "APPROVED", "REJECTED"]

export default function SuperAdminSubscriptionsPage() {
  const [statusFilter, setStatusFilter] = React.useState<string>("PENDING")
  const { data, isLoading } = useSubscriptionPayments(
    statusFilter === ALL_STATUS ? undefined : (statusFilter as SubscriptionRequestStatus),
    1,
    100
  )
  const approve = useApproveSubscriptionPayment()
  const reject = useRejectSubscriptionPayment()
  const [rejectTarget, setRejectTarget] = React.useState<string | null>(null)
  const [rejectReason, setRejectReason] = React.useState("")

  const requests = data?.items ?? []

  const handleApprove = (id: string) => {
    approve.mutate(id, {
      onSuccess: () => toast.success("Suscripción aprobada"),
      onError: (error) =>
        toast.error(error instanceof ApiError ? error.detail : "No se pudo aprobar"),
    })
  }

  const confirmReject = () => {
    if (!rejectTarget || !rejectReason.trim()) return
    reject.mutate(
      { id: rejectTarget, reason: rejectReason.trim() },
      {
        onSuccess: () => {
          toast.success("Solicitud rechazada")
          setRejectTarget(null)
          setRejectReason("")
        },
        onError: (error) =>
          toast.error(error instanceof ApiError ? error.detail : "No se pudo rechazar"),
      }
    )
  }

  return (
    <div className="space-y-6">
      <FadeIn>
        <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
          <CreditCard className="size-5" />
          Suscripciones
        </h1>
        <p className="text-sm text-muted-foreground">
          Comprobantes de pago que los gimnasios enviaron por su plan mensual.
        </p>
      </FadeIn>

      <FadeIn delay={0.05}>
        <Tabs value={statusFilter} onValueChange={(v) => v && setStatusFilter(v)}>
          <TabsList>
            <TabsTrigger value={ALL_STATUS}>Todas</TabsTrigger>
            {STATUSES.map((s) => (
              <TabsTrigger key={s} value={s}>
                {SUBSCRIPTION_REQUEST_STATUS_LABELS[s]}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </FadeIn>

      <FadeIn delay={0.1}>
        <Card>
          <CardContent>
            {isLoading ? (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-32 w-full" />
                ))}
              </div>
            ) : (
              <StaggerGroup className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {requests.map((r) => (
                  <StaggerItem key={r.id}>
                    <EntityCard>
                      <div className="flex items-center justify-between gap-2">
                        <p className="truncate font-semibold">{r.gym_name}</p>
                        <Badge className={SUBSCRIPTION_REQUEST_STATUS_BADGE_CLASSES[r.status]}>
                          {SUBSCRIPTION_REQUEST_STATUS_LABELS[r.status]}
                        </Badge>
                      </div>
                      <div className="flex items-center justify-between gap-2 text-sm">
                        <span>{PLAN_TIER_LABELS[r.requested_plan_tier]}</span>
                        <span className="font-medium">{formatCurrency(r.amount)}</span>
                      </div>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={r.proof_image}
                        alt="Comprobante de pago"
                        className="h-32 w-full rounded-md border object-contain bg-muted"
                      />
                      <span className="text-xs text-muted-foreground">
                        {formatRelativeDate(r.created_at)}
                      </span>
                      {r.rejection_reason && (
                        <p className="text-xs text-destructive">{r.rejection_reason}</p>
                      )}
                      {r.status === "PENDING" && (
                        <div className="flex justify-end gap-1 border-t pt-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            disabled={approve.isPending}
                            onClick={() => {
                              setRejectTarget(r.id)
                              setRejectReason("")
                            }}
                          >
                            <Ban className="size-3.5" />
                            Rechazar
                          </Button>
                          <Button size="sm" disabled={approve.isPending} onClick={() => handleApprove(r.id)}>
                            Aprobar
                          </Button>
                        </div>
                      )}
                    </EntityCard>
                  </StaggerItem>
                ))}
                {requests.length === 0 && (
                  <p className="text-sm text-muted-foreground sm:col-span-2 lg:col-span-3">
                    No hay solicitudes en este filtro.
                  </p>
                )}
              </StaggerGroup>
            )}
          </CardContent>
        </Card>
      </FadeIn>

      <Dialog open={rejectTarget !== null} onOpenChange={(open) => !open && setRejectTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rechazar solicitud de suscripción</DialogTitle>
          </DialogHeader>
          <Textarea
            autoFocus
            placeholder="Motivo (ej. el comprobante no corresponde al monto)"
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectTarget(null)}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              disabled={reject.isPending || !rejectReason.trim()}
              onClick={confirmReject}
            >
              {reject.isPending ? "Rechazando…" : "Rechazar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
