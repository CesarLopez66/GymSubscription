"use client"

import * as React from "react"
import { MessageCircle, RefreshCw } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { ExpiredNotice, MemberPaymentSteps } from "@/components/shared/membership-gate"
import { FadeIn } from "@/components/shared/motion"
import { SUBSCRIPTION_STATUS_BADGE_CLASSES } from "@/lib/badge-colors"
import { formatCurrency } from "@/lib/currency"
import { daysUntil, formatDate, formatDateRange } from "@/lib/format"
import { SUBSCRIPTION_STATUS_LABELS } from "@/lib/labels"
import { isSubscriptionValid, mostRecentSubscription } from "@/lib/subscription-status"
import { cn } from "@/lib/utils"
import { useMyGym } from "@/hooks/use-gyms"
import { useMemberships } from "@/hooks/use-memberships"
import { useSubscriptions } from "@/hooks/use-subscriptions"

export default function MemberMembershipPage() {
  const { data: subscriptions, isLoading } = useSubscriptions()
  const { data: memberships } = useMemberships()
  const { data: myGym } = useMyGym()
  const [renewing, setRenewing] = React.useState(false)

  const items = [...(subscriptions?.items ?? [])].sort((a, b) => b.start_date.localeCompare(a.start_date))
  const activeSub = items.find((s) => isSubscriptionValid(s))
  const plan = (membershipId: string) => memberships?.items.find((m) => m.id === membershipId)

  const whatsappHref = myGym?.contact_phone
    ? `https://wa.me/${myGym.contact_phone.replace(/[^0-9]/g, "")}`
    : null

  return (
    <div className="space-y-4">
      <FadeIn>
        <h1 className="px-1 text-2xl font-semibold tracking-tight">Tu membresía</h1>
      </FadeIn>

      {isLoading ? (
        <Skeleton className="h-52 w-full rounded-3xl" />
      ) : activeSub ? (
        <FadeIn delay={0.02}>
          <ActivePass
            gymName={myGym?.name}
            planName={plan(activeSub.membership_id)?.name}
            planPrice={plan(activeSub.membership_id)?.price}
            startDate={activeSub.start_date}
            endDate={activeSub.end_date}
          />
        </FadeIn>
      ) : (
        <FadeIn delay={0.02}>
          <ExpiredNotice endDate={mostRecentSubscription(items)?.end_date} />
        </FadeIn>
      )}

      {!isLoading && (
        <FadeIn delay={0.04}>
          {activeSub && !renewing ? (
            <div className="flex gap-2">
              <Button className="h-12 flex-1 gap-2 rounded-2xl text-[15px] font-semibold" onClick={() => setRenewing(true)}>
                <RefreshCw className="size-4.5" />
                Renovar
              </Button>
              {whatsappHref && (
                <Button
                  variant="outline"
                  className="h-12 flex-1 gap-2 rounded-2xl text-[15px]"
                  nativeButton={false}
                  render={<a href={whatsappHref} target="_blank" rel="noreferrer" />}
                >
                  <MessageCircle className="size-4.5" />
                  Escribir al gimnasio
                </Button>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {activeSub && (
                <div className="flex items-center justify-between px-1">
                  <h2 className="font-heading text-lg font-medium">Renovar membresía</h2>
                  <Button variant="ghost" size="sm" onClick={() => setRenewing(false)}>
                    Cancelar
                  </Button>
                </div>
              )}
              <MemberPaymentSteps />
            </div>
          )}
        </FadeIn>
      )}

      <FadeIn delay={0.06}>
        <section className="space-y-2.5">
          <h2 className="px-1 font-heading text-lg font-medium">Historial</h2>
          {isLoading ? (
            <Skeleton className="h-32 w-full rounded-2xl" />
          ) : items.length === 0 ? (
            <p className="px-1 text-sm text-muted-foreground">Todavía no tienes membresías registradas.</p>
          ) : (
            <ul className="divide-y divide-foreground/6 overflow-hidden rounded-2xl bg-card/75 ring-1 ring-foreground/10">
              {items.map((sub) => {
                const p = plan(sub.membership_id)
                return (
                  <li key={sub.id} className="flex items-center justify-between gap-3 px-4 py-3.5">
                    <div className="min-w-0">
                      <p className="truncate font-medium">{p?.name ?? "Plan"}</p>
                      <p className="text-[13px] text-muted-foreground tabular-nums">
                        {formatDateRange(sub.start_date, sub.end_date)}
                        {p ? ` · ${formatCurrency(p.price)}` : ""}
                      </p>
                    </div>
                    <Badge className={cn("shrink-0", SUBSCRIPTION_STATUS_BADGE_CLASSES[sub.status])}>
                      {SUBSCRIPTION_STATUS_LABELS[sub.status]}
                    </Badge>
                  </li>
                )
              })}
            </ul>
          )}
        </section>
      </FadeIn>
    </div>
  )
}

function ActivePass({
  gymName,
  planName,
  planPrice,
  startDate,
  endDate,
}: {
  gymName?: string
  planName?: string
  planPrice?: string
  startDate: string
  endDate: string
}) {
  const daysLeft = Math.max(daysUntil(endDate), 0)
  const totalDays = Math.max(daysUntil(endDate) - daysUntil(startDate), 1)
  const remaining = Math.min(Math.max(daysLeft / totalDays, 0), 1)
  const expiring = daysLeft <= 7

  return (
    <section className="space-y-4.5 rounded-3xl bg-[radial-gradient(90%_80%_at_100%_0%,oklch(0.62_0.2_300/0.35),transparent_65%),linear-gradient(135deg,color-mix(in_oklch,var(--primary)_55%,var(--background)),color-mix(in_oklch,var(--primary)_18%,var(--background)))] p-5 shadow-xl shadow-black/35 ring-1 ring-foreground/12">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          {gymName && (
            <p className="truncate text-xs font-semibold tracking-wider text-foreground/75 uppercase">{gymName}</p>
          )}
          <p className="font-heading text-[28px] leading-tight font-semibold">{planName ?? "Tu plan"}</p>
        </div>
        <span
          className={cn(
            "inline-flex h-6 shrink-0 items-center gap-1.5 rounded-full bg-background/55 px-2.5 text-xs font-semibold",
            expiring ? "text-amber-400" : "text-emerald-400"
          )}
        >
          <span className={cn("size-1.5 rounded-full", expiring ? "bg-amber-400" : "bg-emerald-400")} />
          {expiring ? "Por vencer" : "Activa"}
        </span>
      </div>
      <div className="flex items-end justify-between gap-3">
        <p className="flex items-baseline gap-2">
          <span className="text-[56px] leading-none font-semibold tracking-tighter tabular-nums">{daysLeft}</span>
          <span className="text-[15px] text-foreground/80">
            {daysLeft === 1 ? "día restante" : "días restantes"}
          </span>
        </p>
        {planPrice && (
          <p className="text-right text-[13px] leading-snug text-foreground/80">
            Precio del plan
            <br />
            <span className="font-semibold text-foreground tabular-nums">{formatCurrency(planPrice)}</span>
          </p>
        )}
      </div>
      <div className="space-y-2">
        <div className="h-1.5 overflow-hidden rounded-full bg-background/50" aria-hidden="true">
          <div className="h-full rounded-full bg-foreground" style={{ width: `${Math.round(remaining * 100)}%` }} />
        </div>
        <div className="flex justify-between text-[13px] text-foreground/80 tabular-nums">
          <span>{formatDate(startDate)}</span>
          <span>{formatDate(endDate)}</span>
        </div>
      </div>
    </section>
  )
}
