"use client"

import * as React from "react"
import { toast } from "sonner"
import { Lock, Upload } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { FadeIn } from "@/components/shared/motion"
import { PlanPriceLabel } from "@/components/shared/plan-price-label"
import { ApiError } from "@/lib/api-client"
import { applicablePromotion } from "@/lib/promotions"
import { hasValidSubscription, mostRecentSubscription } from "@/lib/subscription-status"
import { useMyGym } from "@/hooks/use-gyms"
import { useMemberships } from "@/hooks/use-memberships"
import { useSubmitPaymentClaim } from "@/hooks/use-payments"
import { usePromotions } from "@/hooks/use-promotions"
import { useSubscriptions } from "@/hooks/use-subscriptions"

const MAX_PROOF_BYTES = 1_500_000

function PaymentClaimForm() {
  const { data: plans } = useMemberships()
  const { data: promotions } = usePromotions(1, 100)
  const submitClaim = useSubmitPaymentClaim()
  const fileInputRef = React.useRef<HTMLInputElement>(null)
  const [membershipId, setMembershipId] = React.useState<string>("")
  const [sent, setSent] = React.useState(false)

  const planItems = (plans?.items ?? [])
    .filter((p) => p.is_active)
    .map((p) => ({
      value: p.id,
      label: <PlanPriceLabel plan={p} promo={applicablePromotion(promotions?.items ?? [], p.id)} />,
    }))

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ""
    if (!file || !membershipId) {
      if (!membershipId) toast.error("Elige primero tu plan")
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
      submitClaim.mutate(
        { membership_id: membershipId, proof_image: reader.result as string },
        {
          onSuccess: () => setSent(true),
          onError: (error) =>
            toast.error(error instanceof ApiError ? error.detail : "No se pudo enviar el comprobante"),
        }
      )
    }
    reader.readAsDataURL(file)
  }

  if (sent) {
    return (
      <p className="text-xs text-primary">
        Comprobante enviado — un administrador lo revisará pronto.
      </p>
    )
  }

  return (
    <div className="flex w-full flex-col gap-2">
      <Select
        items={planItems}
        value={membershipId}
        onValueChange={(value) => setMembershipId(value ?? "")}
      >
        <SelectTrigger className="w-full">
          <SelectValue placeholder="Elige tu plan" />
        </SelectTrigger>
        <SelectContent>
          {planItems.map((item) => (
            <SelectItem key={item.value} value={item.value}>
              {item.label}
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
        size="sm"
        disabled={submitClaim.isPending || !membershipId}
        onClick={() => fileInputRef.current?.click()}
      >
        <Upload className="size-4" />
        {submitClaim.isPending ? "Enviando…" : "Ya pagué — subir comprobante"}
      </Button>
    </div>
  )
}

/**
 * Blocks a member-facing screen behind an active/paid subscription — only
 * the payment QR and a short explanation are shown until staff registers a
 * payment that activates one. Wrapped around the routine/nutrition/stats
 * tabs individually (see (member)/member/*), not the whole layout: the
 * Escáner and Membresía tabs must stay reachable even while unpaid, since
 * that's exactly where a member sees why they're blocked and pays.
 */
export function MembershipGate({ children }: { children: React.ReactNode }) {
  const { data: subscriptions, isLoading } = useSubscriptions()
  const { data: myGym } = useMyGym()

  if (isLoading) {
    return (
      <div className="flex h-[60vh] items-center justify-center text-sm text-muted-foreground">
        Cargando…
      </div>
    )
  }

  const items = subscriptions?.items ?? []
  if (hasValidSubscription(items)) {
    return <>{children}</>
  }

  const lastSub = mostRecentSubscription(items)

  return (
    <FadeIn>
      <Card className="overflow-hidden border-destructive/30">
        <CardHeader className="text-center">
          <CardTitle className="flex items-center justify-center gap-2 text-destructive">
            <Lock className="size-4" />
            Membresía pendiente de pago
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col items-center gap-3 text-center">
          <p className="text-sm text-muted-foreground">
            {lastSub
              ? `Tu membresía venció el ${new Date(lastSub.end_date).toLocaleDateString()}. Regulariza tu pago para volver a ver tu rutina, tu plan de nutrición y usar tu acceso al gimnasio.`
              : "Todavía no tienes una membresía activa. Paga para desbloquear tu rutina, tu plan de nutrición y tu acceso al gimnasio."}
          </p>
          {myGym?.payment_qr_image ? (
            <>
              <div className="rounded-xl bg-white p-3 shadow-lg shadow-primary/20">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={myGym.payment_qr_image}
                  alt="QR de pago del gimnasio"
                  className="size-48 object-contain"
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Escanéalo desde tu banco o billetera digital.
              </p>
            </>
          ) : null}
          <PaymentClaimForm />
        </CardContent>
      </Card>
    </FadeIn>
  )
}
