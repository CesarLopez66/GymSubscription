"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { z } from "zod"
import { toast } from "sonner"
import { motion } from "framer-motion"
import { Ban, RotateCcw } from "lucide-react"

import { Badge } from "@/components/ui/badge"
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
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { AnimatedNumber, FadeIn } from "@/components/shared/motion"
import { ApiError } from "@/lib/api-client"
import { PAYMENT_METHOD_LABELS, PAYMENT_STATUS_LABELS, PAYMENT_TYPE_LABELS } from "@/lib/labels"
import type { PaymentMethod, PaymentStatus, PaymentType } from "@/lib/types"
import { useCreatePayment, usePayments, useRevenueSummary, useUpdatePaymentStatus } from "@/hooks/use-payments"
import { useUsers } from "@/hooks/use-users"

const PAYMENT_TYPES: PaymentType[] = ["MEMBERSHIP", "RETAIL", "OTHER"]
const PAYMENT_METHODS: PaymentMethod[] = ["CASH", "CARD", "TRANSFER", "OTHER"]

const paymentSchema = z.object({
  user_id: z.string().optional(),
  payment_type: z.enum(["MEMBERSHIP", "RETAIL", "OTHER"]),
  payment_method: z.enum(["CASH", "CARD", "TRANSFER", "OTHER"]),
  amount: z.coerce.number().positive(),
  description: z.string().optional(),
})

type PaymentFormValues = z.infer<typeof paymentSchema>

function statusVariant(status: PaymentStatus) {
  if (status === "COMPLETED") return "default"
  if (status === "PENDING") return "secondary"
  return "destructive"
}

function formatCurrency(value: number | string) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(
    Number(value)
  )
}

export default function PaymentsPage() {
  const { data: payments, isLoading } = usePayments()
  const { data: revenue } = useRevenueSummary()
  const { data: members } = useUsers("MEMBER", 1, 200)
  const createPayment = useCreatePayment()
  const updateStatus = useUpdatePaymentStatus()

  const form = useForm<z.input<typeof paymentSchema>, unknown, PaymentFormValues>({
    resolver: zodResolver(paymentSchema),
    defaultValues: {
      user_id: undefined,
      payment_type: "MEMBERSHIP",
      payment_method: "CARD",
      amount: 0,
      description: "",
    },
  })

  const onSubmit = (values: PaymentFormValues) => {
    createPayment.mutate(
      { ...values, user_id: values.user_id || undefined },
      {
        onSuccess: () => {
          toast.success("Pago registrado")
          form.reset({
            user_id: undefined,
            payment_type: "MEMBERSHIP",
            payment_method: "CARD",
            amount: 0,
            description: "",
          })
        },
        onError: (error) => {
          toast.error(error instanceof ApiError ? error.detail : "No se pudo registrar el pago")
        },
      }
    )
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
                        <FormLabel>Miembro (opcional)</FormLabel>
                        <Select value={field.value} onValueChange={field.onChange}>
                          <FormControl>
                            <SelectTrigger className="w-full">
                              <SelectValue placeholder="Venta directa / tienda" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {(members?.items ?? []).map((m) => (
                              <SelectItem key={m.id} value={m.id}>
                                {m.first_name} {m.last_name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
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
                        <Select value={field.value} onValueChange={field.onChange}>
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
                  <FormField
                    control={form.control}
                    name="payment_method"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Método</FormLabel>
                        <Select value={field.value} onValueChange={field.onChange}>
                          <FormControl>
                            <SelectTrigger className="w-full">
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {PAYMENT_METHODS.map((m) => (
                              <SelectItem key={m} value={m}>
                                {PAYMENT_METHOD_LABELS[m]}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="amount"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Monto (USD)</FormLabel>
                        <FormControl>
                          <Input type="number" step="0.01" {...field} value={field.value as number} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
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
                  <Button type="submit" disabled={createPayment.isPending}>
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
                <div className="space-y-2">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Skeleton key={i} className="h-10 w-full" />
                  ))}
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Fecha</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Método</TableHead>
                      <TableHead>Monto</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead className="text-right">Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(payments?.items ?? []).map((p, i) => (
                      <motion.tr
                        key={p.id}
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.25, delay: Math.min(i * 0.03, 0.3) }}
                        className="border-b transition-colors hover:bg-muted/50"
                      >
                        <TableCell className="text-muted-foreground">
                          {new Date(p.created_at).toLocaleDateString()}
                        </TableCell>
                        <TableCell>{PAYMENT_TYPE_LABELS[p.payment_type]}</TableCell>
                        <TableCell className="text-muted-foreground">
                          {PAYMENT_METHOD_LABELS[p.payment_method]}
                        </TableCell>
                        <TableCell className="font-medium">{formatCurrency(p.amount)}</TableCell>
                        <TableCell>
                          <Badge variant={statusVariant(p.status)}>
                            {PAYMENT_STATUS_LABELS[p.status]}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          {p.status === "COMPLETED" && (
                            <Button
                              variant="ghost"
                              size="sm"
                              disabled={updateStatus.isPending}
                              onClick={() => handleStatus(p.id, "REFUNDED", "Pago reembolsado")}
                            >
                              <RotateCcw className="size-3.5" />
                              Reembolsar
                            </Button>
                          )}
                          {p.status === "PENDING" && (
                            <div className="flex justify-end gap-1">
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
                            </div>
                          )}
                        </TableCell>
                      </motion.tr>
                    ))}
                    {(payments?.items?.length ?? 0) === 0 && (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center text-muted-foreground">
                          Todavía no hay transacciones.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </FadeIn>
      </div>
    </div>
  )
}
