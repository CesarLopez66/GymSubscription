"use client"

import * as React from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { z } from "zod"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
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
import { BranchSelect } from "@/components/shared/branch-select"
import { FadeIn } from "@/components/shared/motion"
import { MemberPicker } from "@/components/shared/member-picker"
import { PlanPriceLabel } from "@/components/shared/plan-price-label"
import { ApiError } from "@/lib/api-client"
import { PAYMENT_TYPE_LABELS } from "@/lib/labels"
import { applicablePromotion, discountedPrice } from "@/lib/promotions"
import type { PaymentType } from "@/lib/types"
import { useCreatePayment } from "@/hooks/use-payments"
import { useMyGym } from "@/hooks/use-gyms"
import { useMemberships } from "@/hooks/use-memberships"
import { usePromotions } from "@/hooks/use-promotions"

const PAYMENT_TYPES: PaymentType[] = ["MEMBERSHIP", "RETAIL", "OTHER"]

const paymentSchema = z.object({
  user_id: z.string().optional(),
  payment_type: z.enum(["MEMBERSHIP", "RETAIL", "OTHER"]),
  membership_id: z.string().optional(),
  amount: z.coerce.number().positive(),
  description: z.string().optional(),
})

type PaymentFormValues = z.infer<typeof paymentSchema>

export function CreatePaymentForm() {
  const { data: myGym } = useMyGym()
  const { data: plans } = useMemberships()
  const { data: promotions } = usePromotions(1, 100)
  const createPayment = useCreatePayment()
  const [branchId, setBranchId] = React.useState<string | undefined>(undefined)

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

  return (
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
              <Button type="submit" disabled={createPayment.isPending || !myGym?.payment_qr_image}>
                {createPayment.isPending ? "Registrando…" : "Registrar pago"}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </FadeIn>
  )
}
