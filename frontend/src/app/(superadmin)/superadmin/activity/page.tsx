"use client"

import * as React from "react"
import { CalendarIcon, Receipt, X } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Card, CardContent } from "@/components/ui/card"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { EntityCard } from "@/components/shared/entity-card"
import { GymFilter } from "@/components/shared/gym-filter"
import { FadeIn, StaggerGroup, StaggerItem } from "@/components/shared/motion"
import { LoadingOverlay } from "@/components/shared/refetching-indicator"
import { useSuperAdminFilterStore } from "@/store/superadmin-filter-store"
import { PAYMENT_STATUS_BADGE_CLASSES } from "@/lib/badge-colors"
import { formatCurrency } from "@/lib/currency"
import { PAYMENT_STATUS_LABELS, PAYMENT_TYPE_LABELS } from "@/lib/labels"
import { useSuperAdminOverview } from "@/hooks/use-superadmin"

const RANGE_OPTIONS = [
  { value: "7", label: "7 días" },
  { value: "30", label: "30 días" },
  { value: "90", label: "90 días" },
  { value: "365", label: "1 año" },
]

function toIsoDate(d: Date): string {
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

export default function SuperAdminPaymentsHistoryPage() {
  const [range, setRange] = React.useState("30")
  const [selectedDate, setSelectedDate] = React.useState<Date | undefined>(undefined)
  const [calendarOpen, setCalendarOpen] = React.useState(false)
  const gymId = useSuperAdminFilterStore((s) => s.gymId)
  const paymentsDate = selectedDate ? toIsoDate(selectedDate) : null
  const {
    data: overview,
    isFetching: overviewFetching,
    isLoading: overviewLoading,
  } = useSuperAdminOverview(Number(range), gymId, paymentsDate)
  const payments = overview?.recent_payments ?? []

  return (
    <div className="space-y-6">
      <LoadingOverlay show={overviewFetching && !overviewLoading} />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
            <Receipt className="size-5" />
            Historial de pagos
          </h1>
          <p className="text-sm text-muted-foreground">
            {selectedDate
              ? `Pagos del ${selectedDate.toLocaleDateString("es-BO", { day: "numeric", month: "long", year: "numeric" })}`
              : `Últimos ${payments.length} pagos ${gymId ? "de este gimnasio" : "registrados en toda la plataforma"}`}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Tabs
            value={range}
            onValueChange={(v) => v && setRange(v)}
            className={selectedDate ? "pointer-events-none opacity-40" : undefined}
          >
            <TabsList>
              {RANGE_OPTIONS.map((opt) => (
                <TabsTrigger key={opt.value} value={opt.value}>
                  {opt.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>

          <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
            <PopoverTrigger
              render={
                <Button variant={selectedDate ? "secondary" : "outline"} size="sm" />
              }
            >
              <CalendarIcon className="size-4" />
              {selectedDate
                ? selectedDate.toLocaleDateString("es-BO", { day: "2-digit", month: "short" })
                : "Elegir fecha"}
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0">
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={(d) => {
                  setSelectedDate(d)
                  setCalendarOpen(false)
                }}
                disabled={{ after: new Date() }}
              />
            </PopoverContent>
          </Popover>
          {selectedDate && (
            <Button variant="ghost" size="sm" onClick={() => setSelectedDate(undefined)}>
              <X className="size-4" />
              Quitar fecha
            </Button>
          )}

          <GymFilter />
        </div>
      </div>

      <FadeIn delay={0.05}>
        <Card>
          <CardContent>
            <StaggerGroup className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {payments.map((p) => (
                <StaggerItem key={p.id}>
                  <EntityCard contentClassName="gap-2.5 p-4">
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate font-medium">{p.gym_name}</span>
                      <Badge className={PAYMENT_STATUS_BADGE_CLASSES[p.status]}>
                        {PAYMENT_STATUS_LABELS[p.status]}
                      </Badge>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {PAYMENT_TYPE_LABELS[p.payment_type]}
                    </span>
                    <p className="text-2xl font-semibold">{formatCurrency(Number(p.amount))}</p>
                  </EntityCard>
                </StaggerItem>
              ))}
              {payments.length === 0 && (
                <p className="text-sm text-muted-foreground sm:col-span-2 lg:col-span-3 xl:col-span-4">
                  {selectedDate ? "No hay pagos en esta fecha." : "Todavía no hay actividad en este período."}
                </p>
              )}
            </StaggerGroup>
          </CardContent>
        </Card>
      </FadeIn>
    </div>
  )
}
