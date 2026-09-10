"use client"

import * as React from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { z } from "zod"
import { toast } from "sonner"
import { Ban, QrCode, RotateCcw, Upload } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
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
import { BranchSelect } from "@/components/shared/branch-select"
import { ConfirmDialog } from "@/components/shared/confirm-dialog"
import { EntityCard } from "@/components/shared/entity-card"
import { MemberPicker } from "@/components/shared/member-picker"
import { AnimatedNumber, FadeIn, StaggerGroup, StaggerItem } from "@/components/shared/motion"
import { PlanPriceLabel } from "@/components/shared/plan-price-label"
import { ApiError } from "@/lib/api-client"
import { PAYMENT_STATUS_BADGE_CLASSES } from "@/lib/badge-colors"
import { formatCurrency } from "@/lib/currency"
import { formatRelativeDate } from "@/lib/format"
import { PAYMENT_METHOD_LABELS, PAYMENT_STATUS_LABELS, PAYMENT_TYPE_LABELS } from "@/lib/labels"
import { applicablePromotion, discountedPrice } from "@/lib/promotions"
import type { PaymentStatus, PaymentType } from "@/lib/types"
import {
  useApprovePayment,
  useCreatePayment,
  usePayments,
  useRejectPayment,
  useRevenueSummary,
  useUpdatePaymentStatus,
} from "@/hooks/use-payments"
import { useMyGym, useUpdatePaymentQr } from "@/hooks/use-gyms"
import { useMemberships } from "@/hooks/use-memberships"
import { usePromotions } from "@/hooks/use-promotions"
import { useUsers } from "@/hooks/use-users"

const PAYMENT_TYPES: PaymentType[] = ["MEMBERSHIP", "RETAIL", "OTHER"]
const MAX_QR_BYTES = 1_500_000

const paymentSchema = z.object({
  user_id: z.string().optional(),
  payment_type: z.enum(["MEMBERSHIP", "RETAIL", "OTHER"]),
  membership_id: z.string().optional(),
  amount: z.coerce.number().positive(),
  description: z.string().optional(),
})

type PaymentFormValues = z.infer<typeof paymentSchema>

export default function PaymentsPage() {
  const [refundTarget, setRefundTarget] = React.useState<string | null>(null)
  const [rejectTarget, setRejectTarget] = React.useState<string | null>(null)
  const [rejectReason, setRejectReason] = React.useState("")
  const [branchId, setBranchId] = React.useState<string | undefined>(undefined)
  const { data: payments, isLoading } = usePayments()
  const { data: revenue } = useRevenueSummary()
  const { data: myGym } = useMyGym()
  const { data: plans } = useMemberships()
  const { data: promotions } = usePromotions(1, 100)
  const { data: members } = useUsers("MEMBER", 1, 100)
  const createPayment = useCreatePayment()
  const updateStatus = useUpdatePaymentStatus()
  const updateQr = useUpdatePaymentQr()
  const approvePayment = useApprovePayment()
  const rejectPayment = useRejectPayment()
  const qrInputRef = React.useRef<HTMLInputElement>(null)

  const memberName = (userId: string | null) => {
    if (!userId) return "—"
    const m = members?.items.find((u) => u.id === userId)
    return m ? `${m.first_name} ${m.last_name}` : userId.slice(0, 8)
  }

  const pendingClaims = (payments?.items ?? []).filter(
    (p) => p.status === "PENDING" && p.membership_id
  )

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

  const form = useForm<z.input<typeof paymentSchema>, unknown, PaymentFormValues>({
    resolver: zodResolver(paymentSchema),
    defaultValues: {
      user_id: undefined,
      payment_type: "MEMBERSHIP",
      membership_id: undefined,
      amount: 0,
      description: "",
    },
  })

  const paymentType = form.watch("payment_type")
  const membershipId = form.watch("membership_id")
  const isMembership = paymentType === "MEMBERSHIP"

  const planItems = (plans?.items ?? [])
    .filter((p) => p.is_active)
    .map((p) => ({
      value: p.id,
      label: <PlanPriceLabel plan={p} promo={applicablePromotion(promotions?.items ?? [], p.id)} />,
    }))

  const selectedPlan = plans?.items.find((p) => p.id === membershipId)
  const selectedPromo = selectedPlan
    ? applicablePromotion(promotions?.items ?? [], selectedPlan.id)
    : undefined
  const planAmount = selectedPlan
    ? selectedPromo
      ? discountedPrice(Number(selectedPlan.price), selectedPromo)
      : Number(selectedPlan.price)
    : undefined

  React.useEffect(() => {
    if (isMembership && planAmount !== undefined) {
      form.setValue("amount", planAmount)
    }
  }, [isMembership, planAmount, form])

  React.useEffect(() => {
    if (!isMembership) {
      form.setValue("membership_id", undefined)
    }
  }, [isMembership, form])

  const onSubmit = (values: PaymentFormValues) => {
    if (isMembership) {
      if (!values.user_id) {
        toast.error("Selecciona un miembro para un pago de membresía")
        return
      }
      if (!values.membership_id) {
        toast.error("Selecciona el plan de membresía")
        return
      }
    }
    createPayment.mutate(
      { ...values, payment_method: "QR", user_id: values.user_id || undefined, branch_id: branchId },
      {
        onSuccess: () => {
          toast.success("Pago registrado")
          form.reset({
            user_id: undefined,
            payment_type: "MEMBERSHIP",
            membership_id: undefined,
            amount: 0,
            description: "",
          })
          setBranchId(undefined)
        },
        onError: (error) => {
          toast.error(error instanceof ApiError ? error.detail : "No se pudo registrar el pago")
        },
      }
    )
  }

  const handleQrFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ""
    if (!file) return
    if (!file.type.startsWith("image/")) {
      toast.error("Selecciona un archivo de imagen")
      return
    }
    if (file.size > MAX_QR_BYTES) {
      toast.error("La imagen es muy grande (máximo 1.5 MB)")
      return
    }
    const reader = new FileReader()
    reader.onload = () => {
      updateQr.mutate(reader.result as string, {
        onSuccess: () => toast.success("QR de cobro actualizado"),
        onError: (error) =>
          toast.error(error instanceof ApiError ? error.detail : "No se pudo subir el QR"),
      })
    }
    reader.readAsDataURL(file)
  }

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
    <div className="space-y-6">
      <FadeIn className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Pagos y punto de venta</h1>
        <Card className="border-primary/30 bg-accent px-4 py-2">
          <p className="text-xs text-muted-foreground">Ingresos totales</p>
          <p className="text-xl font-semibold text-gradient-primary">
            {revenue ? (
              <AnimatedNumber
                value={revenue.total_revenue}
                format={(n) => formatCurrency(n)}
              />
            ) : (
              "—"
            )}
          </p>
        </Card>
      </FadeIn>

      <FadeIn delay={0.02}>
        <Card className="overflow-hidden border-primary/30 bg-gym-radial">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <QrCode className="size-5" />
              QR de cobro del gimnasio
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col items-center gap-4 sm:flex-row sm:items-start">
            {myGym?.payment_qr_image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={myGym.payment_qr_image}
                alt="QR de cobro"
                className="size-40 rounded-xl bg-white p-3 object-contain shadow-lg shadow-primary/20"
              />
            ) : (
              <div className="flex size-40 shrink-0 items-center justify-center rounded-xl border border-dashed border-muted-foreground/40 p-3 text-center text-xs text-muted-foreground">
                Todavía no has subido un QR de cobro
              </div>
            )}
            <div className="flex flex-1 flex-col gap-2">
              <p className="text-sm text-muted-foreground">
                Los pagos ahora se cobran solo mostrando este código para que el miembro
                transfiera desde su banco o billetera digital. Súbelo una vez y muéstralo en
                cada venta; luego registra el pago aquí para llevar el control.
              </p>
              <input
                ref={qrInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleQrFile}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="w-fit"
                disabled={updateQr.isPending}
                onClick={() => qrInputRef.current?.click()}
              >
                <Upload className="size-4" />
                {updateQr.isPending ? "Subiendo…" : myGym?.payment_qr_image ? "Cambiar QR" : "Subir QR"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </FadeIn>

      {pendingClaims.length > 0 && (
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
        </FadeIn>
      )}

      <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
        <FadeIn delay={0.05}>
          <Card>
            <CardHeader>
              <CardTitle>Registrar una venta</CardTitle>
            </CardHeader>
            <CardContent>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4">
                  <FormField
                    control={form.control}
                    name="user_id"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{isMembership ? "Miembro" : "Miembro (opcional)"}</FormLabel>
                        <FormControl>
                          <MemberPicker
                            value={field.value ?? ""}
                            onChange={field.onChange}
                            placeholder="Venta directa / tienda"
                            clearable={!isMembership}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="payment_type"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Tipo</FormLabel>
                        <Select items={PAYMENT_TYPE_LABELS} value={field.value} onValueChange={field.onChange}>
                          <FormControl>
                            <SelectTrigger className="w-full">
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {PAYMENT_TYPES.map((t) => (
                              <SelectItem key={t} value={t}>
                                {PAYMENT_TYPE_LABELS[t]}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  {isMembership && (
                    <FormField
                      control={form.control}
                      name="membership_id"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Plan de membresía</FormLabel>
                          <Select items={planItems} value={field.value} onValueChange={field.onChange}>
                            <FormControl>
                              <SelectTrigger className="w-full">
                                <SelectValue placeholder="Elegir plan" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {planItems.map((item) => (
                                <SelectItem key={item.value} value={item.value}>
                                  {item.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}
                  <FormField
                    control={form.control}
                    name="amount"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Monto (Bs){isMembership && " · calculado según el plan"}</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            step="0.01"
                            {...field}
                            value={field.value as number}
                            readOnly={isMembership}
                            disabled={isMembership}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <BranchSelect value={branchId} onChange={setBranchId} />
                  <FormField
                    control={form.control}
                    name="description"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Descripción (opcional)</FormLabel>
                        <FormControl>
                          <Input placeholder="Batido de proteína, renovación anual…" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  {!myGym?.payment_qr_image && (
                    <p className="text-xs text-destructive">
                      Sube tu QR de cobro arriba antes de registrar pagos.
                    </p>
                  )}
                  <Button
                    type="submit"
                    disabled={createPayment.isPending || !myGym?.payment_qr_image}
                  >
                    {createPayment.isPending ? "Registrando…" : "Registrar pago"}
                  </Button>
                </form>
              </Form>
            </CardContent>
          </Card>
        </FadeIn>

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
                  {(payments?.items ?? []).map((p) => (
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
                                  onClick={() =>
                                    handleStatus(p.id, "COMPLETED", "Pago marcado como completado")
                                  }
                                >
                                  Completar
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  disabled={updateStatus.isPending}
                                  onClick={() =>
                                    handleStatus(p.id, "FAILED", "Pago marcado como cancelado")
                                  }
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
                  {(payments?.items?.length ?? 0) === 0 && (
                    <p className="text-sm text-muted-foreground sm:col-span-2">
                      Todavía no hay transacciones.
                    </p>
                  )}
                </StaggerGroup>
              )}
            </CardContent>
          </Card>
        </FadeIn>
      </div>

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
    </div>
  )
}
