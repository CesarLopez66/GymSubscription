"use client"

import { Card } from "@/components/ui/card"
import { BranchFilter } from "@/components/shared/branch-filter"
import { AnimatedNumber, FadeIn } from "@/components/shared/motion"
import { useBranchFilterStore } from "@/store/branch-filter-store"
import { formatCurrency } from "@/lib/currency"
import { useRevenueSummary, usePayments } from "@/hooks/use-payments"
import { CreatePaymentForm } from "./create-payment-form"
import { PaymentQrCard } from "./payment-qr-card"
import { PendingClaimsCard } from "./pending-claims-card"
import { RecentPaymentsList } from "./recent-payments-list"

export default function PaymentsPage() {
  const branchId = useBranchFilterStore((s) => s.branchId)
  const { data: revenue } = useRevenueSummary(branchId)
  const { data: payments, isLoading } = usePayments(undefined, 1, 20, branchId)

  return (
    <div className="space-y-6">
      <FadeIn className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">Pagos y punto de venta</h1>
        <div className="flex items-center gap-3">
          <BranchFilter />
          <Card className="border-primary/30 bg-accent px-4 py-2">
            <p className="text-xs text-muted-foreground">
              Ingresos {branchId ? "de la sucursal" : "totales"}
            </p>
            <p className="text-xl font-semibold text-gradient-primary">
              {revenue ? (
                <AnimatedNumber value={revenue.total_revenue} format={(n) => formatCurrency(n)} />
              ) : (
                "—"
              )}
            </p>
          </Card>
        </div>
      </FadeIn>

      <PaymentQrCard />
      <PendingClaimsCard payments={payments?.items ?? []} />

      <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
        <CreatePaymentForm />
        <RecentPaymentsList payments={payments?.items ?? []} isLoading={isLoading} />
      </div>
    </div>
  )
}
