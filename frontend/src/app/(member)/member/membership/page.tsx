"use client"

import { IdCard, MessageCircle } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { FadeIn } from "@/components/shared/motion"
import { SUBSCRIPTION_STATUS_BADGE_CLASSES } from "@/lib/badge-colors"
import { SUBSCRIPTION_STATUS_LABELS } from "@/lib/labels"
import { isSubscriptionValid } from "@/lib/subscription-status"
import { useMyGym } from "@/hooks/use-gyms"
import { useMemberships } from "@/hooks/use-memberships"
import { useSubscriptions } from "@/hooks/use-subscriptions"

export default function MemberMembershipPage() {
  const { data: subscriptions, isLoading } = useSubscriptions()
  const { data: memberships } = useMemberships()
  const { data: myGym } = useMyGym()

  const items = [...(subscriptions?.items ?? [])].sort((a, b) =>
    b.start_date.localeCompare(a.start_date)
  )
  const activeSub = items.find((s) => isSubscriptionValid(s))
  const daysLeft = activeSub
    ? Math.ceil(
        (new Date(activeSub.end_date).getTime() - new Date().setHours(0, 0, 0, 0)) /
          (1000 * 60 * 60 * 24)
      )
    : null

  const membershipName = (membershipId: string) =>
    memberships?.items.find((m) => m.id === membershipId)?.name ?? "Plan"

  const whatsappHref = myGym?.contact_phone
    ? `https://wa.me/${myGym.contact_phone.replace(/[^0-9]/g, "")}`
    : null

  return (
    <div className="space-y-6">
      <FadeIn>
        <h1 className="flex items-center gap-2 text-lg font-semibold tracking-tight">
          <IdCard className="size-5 text-primary" />
          Tu membresía
        </h1>
      </FadeIn>

      <FadeIn delay={0.02}>
        <Card className={activeSub ? "border-primary/30 bg-gym-radial" : undefined}>
          <CardContent className="flex flex-col gap-4 pt-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs text-muted-foreground">
                  {activeSub ? membershipName(activeSub.membership_id) : "Estado"}
                </p>
                {activeSub && daysLeft !== null ? (
                  <p className="text-sm font-medium">
                    {daysLeft <= 0
                      ? "Vence hoy"
                      : `Vence en ${daysLeft} día(s) — ${new Date(activeSub.end_date).toLocaleDateString()}`}
                  </p>
                ) : (
                  <p className="text-sm font-medium text-destructive">Sin membresía activa</p>
                )}
              </div>
              {daysLeft !== null && daysLeft <= 3 && <Badge variant="destructive">Por vencer</Badge>}
            </div>
            {whatsappHref && (
              <Button
                variant="outline"
                size="sm"
                nativeButton={false}
                className="w-fit"
                render={<a href={whatsappHref} target="_blank" rel="noreferrer" />}
              >
                <MessageCircle className="size-4" />
                Contactar al gimnasio
              </Button>
            )}
          </CardContent>
        </Card>
      </FadeIn>

      <FadeIn delay={0.06}>
        <Card>
          <CardHeader>
            <CardTitle>Historial</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {isLoading && (
              <>
                <Skeleton className="h-14 w-full" />
                <Skeleton className="h-14 w-full" />
              </>
            )}
            {!isLoading && items.length === 0 && (
              <p className="text-sm text-muted-foreground">Todavía no tienes suscripciones registradas.</p>
            )}
            {items.map((sub) => (
              <div
                key={sub.id}
                className="flex items-center justify-between gap-3 rounded-md border p-3"
              >
                <div>
                  <p className="text-sm font-medium">{membershipName(sub.membership_id)}</p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(sub.start_date).toLocaleDateString()} — {new Date(sub.end_date).toLocaleDateString()}
                  </p>
                </div>
                <Badge className={SUBSCRIPTION_STATUS_BADGE_CLASSES[sub.status]}>
                  {SUBSCRIPTION_STATUS_LABELS[sub.status]}
                </Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      </FadeIn>
    </div>
  )
}
