"use client"

import * as React from "react"
import { toast } from "sonner"
import { CalendarClock, CreditCard, Upload } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { EntityCard } from "@/components/shared/entity-card"
import { FadeIn, StaggerGroup, StaggerItem } from "@/components/shared/motion"
import { ApiError } from "@/lib/api-client"
import { GYM_STATUS_BADGE_CLASSES, SUBSCRIPTION_REQUEST_STATUS_BADGE_CLASSES } from "@/lib/badge-colors"
import { formatRelativeDate } from "@/lib/format"
import { GYM_STATUS_LABELS, PLAN_TIER_LABELS, SUBSCRIPTION_REQUEST_STATUS_LABELS } from "@/lib/labels"
import type { SaaSPlanTier } from "@/lib/types"
import { useMyGym } from "@/hooks/use-gyms"
import { useSubmitSubscriptionPayment, useSubscriptionPayments } from "@/hooks/use-gym-subscriptions"

const MAX_PROOF_BYTES = 1_500_000
// FREE has no payment, ENTERPRISE is arranged directly with the platform —
// these are the only two tiers a gym can request for itself.
const SELF_SERVICE_PLANS: SaaSPlanTier[] = ["BASIC", "PRO"]

export default function GymSubscriptionPage() {
  const { data: gym } = useMyGym()
  const { data: history, isLoading } = useSubscriptionPayments()
  const submitPayment = useSubmitSubscriptionPayment()
  const fileInputRef = React.useRef<HTMLInputElement>(null)
  const [selectedPlan, setSelectedPlan] = React.useState<SaaSPlanTier | "">("")

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ""
    if (!file || !selectedPlan) {
      if (!selectedPlan) toast.error("Elige primero el plan que quieres pedir")
      return
    }
    if (!file.type.startsWith("image/")) {
      toast.error("Selecciona un archivo de imagen")
      return
    }
    if (file.size > MAX_PROOF_BYTES) {
      toast.error("La imagen es muy grande (máximo 1.5 MB)")
      return
    }
    const reader = new FileReader()
    reader.onload = () => {
      submitPayment.mutate(
        { requested_plan_tier: selectedPlan, proof_image: reader.result as string },
        {
          onSuccess: () => {
            toast.success("Comprobante enviado — el superadmin lo revisará pronto")
            setSelectedPlan("")
          },
          onError: (error) =>
            toast.error(error instanceof ApiError ? error.detail : "No se pudo enviar el comprobante"),
        }
      )
    }
    reader.readAsDataURL(file)
  }

  const items = history?.items ?? []

  return (
    <div className="space-y-6">
      <FadeIn>
        <h1 className="text-2xl font-semibold tracking-tight">Suscripción</h1>
        <p className="text-sm text-muted-foreground">
          El plan de tu gimnasio en la plataforma y el historial de pagos de suscripción.
        </p>
      </FadeIn>

      <FadeIn delay={0.05}>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="size-4" />
              Tu plan actual
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap items-center gap-3">
            {gym && (
              <>
                <Badge variant="secondary">{PLAN_TIER_LABELS[gym.plan_tier]}</Badge>
                <Badge className={GYM_STATUS_BADGE_CLASSES[gym.status]}>
                  {GYM_STATUS_LABELS[gym.status]}
                </Badge>
                {gym.subscription_ends_at && (
                  <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
                    <CalendarClock className="size-3.5" />
                    Vence el {new Date(gym.subscription_ends_at).toLocaleDateString()}
                  </span>
                )}
                {!gym.subscription_ends_at && gym.trial_ends_at && (
                  <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
                    <CalendarClock className="size-3.5" />
                    Prueba hasta el {new Date(gym.trial_ends_at).toLocaleDateString()}
                  </span>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </FadeIn>

      <FadeIn delay={0.1}>
        <Card>
          <CardHeader>
            <CardTitle>Solicitar un plan</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <p className="text-sm text-muted-foreground">
              Transfiere el monto de tu plan y sube el comprobante — el superadmin lo aprueba y tu
              plan se activa.
            </p>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Select
                items={Object.fromEntries(SELF_SERVICE_PLANS.map((p) => [p, PLAN_TIER_LABELS[p]]))}
                value={selectedPlan}
                onValueChange={(v) => setSelectedPlan((v as SaaSPlanTier) ?? "")}
              >
                <SelectTrigger className="w-full sm:w-48">
                  <SelectValue placeholder="Elige un plan" />
                </SelectTrigger>
                <SelectContent>
                  {SELF_SERVICE_PLANS.map((p) => (
                    <SelectItem key={p} value={p}>
                      {PLAN_TIER_LABELS[p]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleFile}
              />
              <Button
                type="button"
                variant="outline"
                disabled={submitPayment.isPending}
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className="size-4" />
                {submitPayment.isPending ? "Enviando…" : "Subir comprobante"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </FadeIn>

      <FadeIn delay={0.15}>
        <Card>
          <CardHeader>
            <CardTitle>Historial de solicitudes</CardTitle>
          </CardHeader>
          <CardContent>
            {!isLoading && items.length === 0 && (
              <p className="text-sm text-muted-foreground">Todavía no has enviado ninguna solicitud.</p>
            )}
            <StaggerGroup className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {items.map((r) => (
                <StaggerItem key={r.id}>
                  <EntityCard contentClassName="gap-2 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium">{PLAN_TIER_LABELS[r.requested_plan_tier]}</span>
                      <Badge className={SUBSCRIPTION_REQUEST_STATUS_BADGE_CLASSES[r.status]}>
                        {SUBSCRIPTION_REQUEST_STATUS_LABELS[r.status]}
                      </Badge>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {formatRelativeDate(r.created_at)}
                    </span>
                    {r.rejection_reason && (
                      <p className="text-xs text-destructive">{r.rejection_reason}</p>
                    )}
                  </EntityCard>
                </StaggerItem>
              ))}
            </StaggerGroup>
          </CardContent>
        </Card>
      </FadeIn>
    </div>
  )
}
