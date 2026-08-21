"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { z } from "zod"
import { toast } from "sonner"

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
import { ApiError } from "@/lib/api-client"
import type { PaymentMethod, PaymentStatus, PaymentType } from "@/lib/types"
import { useCreatePayment, usePayments, useRevenueSummary } from "@/hooks/use-payments"
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
          toast.success("Payment recorded")
          form.reset({
            user_id: undefined,
            payment_type: "MEMBERSHIP",
            payment_method: "CARD",
            amount: 0,
            description: "",
          })
        },
        onError: (error) => {
          toast.error(error instanceof ApiError ? error.detail : "Could not record payment")
        },
      }
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Payments & POS</h1>
        <Card className="px-4 py-2">
          <p className="text-xs text-muted-foreground">Total revenue</p>
          <p className="text-xl font-semibold">
            {revenue ? formatCurrency(revenue.total_revenue) : "—"}
          </p>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Record a sale</CardTitle>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4">
                <FormField
                  control={form.control}
                  name="user_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Member (optional)</FormLabel>
                      <Select value={field.value} onValueChange={field.onChange}>
                        <FormControl>
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder="Walk-in / retail" />
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
                      <FormLabel>Type</FormLabel>
                      <Select value={field.value} onValueChange={field.onChange}>
                        <FormControl>
                          <SelectTrigger className="w-full">
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {PAYMENT_TYPES.map((t) => (
                            <SelectItem key={t} value={t}>
                              {t}
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
                      <FormLabel>Method</FormLabel>
                      <Select value={field.value} onValueChange={field.onChange}>
                        <FormControl>
                          <SelectTrigger className="w-full">
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {PAYMENT_METHODS.map((m) => (
                            <SelectItem key={m} value={m}>
                              {m}
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
                      <FormLabel>Amount (USD)</FormLabel>
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
                      <FormLabel>Description (optional)</FormLabel>
                      <FormControl>
                        <Input placeholder="Protein shake, annual renewal…" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button type="submit" disabled={createPayment.isPending}>
                  {createPayment.isPending ? "Recording…" : "Record payment"}
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent transactions</CardTitle>
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
                    <TableHead>Date</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Method</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(payments?.items ?? []).map((p) => (
                    <TableRow key={p.id}>
                      <TableCell className="text-muted-foreground">
                        {new Date(p.created_at).toLocaleDateString()}
                      </TableCell>
                      <TableCell>{p.payment_type}</TableCell>
                      <TableCell className="text-muted-foreground">{p.payment_method}</TableCell>
                      <TableCell className="font-medium">{formatCurrency(p.amount)}</TableCell>
                      <TableCell>
                        <Badge variant={statusVariant(p.status)}>{p.status}</Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                  {(payments?.items?.length ?? 0) === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-muted-foreground">
                        No transactions yet.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
