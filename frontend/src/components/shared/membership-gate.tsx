"use client"

import * as React from "react"
import { toast } from "sonner"
import { CheckCircle2, Lock, QrCode, Upload } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { FadeIn } from "@/components/shared/motion"
import { ApiError } from "@/lib/api-client"
import { formatCurrency } from "@/lib/currency"
import { formatDayMonth } from "@/lib/format"
import { applicablePromotion, discountedPrice } from "@/lib/promotions"
import { hasValidSubscription, mostRecentSubscription } from "@/lib/subscription-status"
import { cn } from "@/lib/utils"
import { useMyGym } from "@/hooks/use-gyms"
import { useMemberships } from "@/hooks/use-memberships"
import { useSubmitPaymentClaim } from "@/hooks/use-payments"
import { usePromotions } from "@/hooks/use-promotions"
import { useSubscriptions } from "@/hooks/use-subscriptions"

const MAX_PROOF_BYTES = 1_500_000

function StepTitle({ n, done, children }: { n: number; done?: boolean; children: React.ReactNode }) {
  return (
    <h3 className="flex items-center gap-2 px-1 text-sm font-semibold">
      <span
        className={cn(
          "grid size-5.5 place-items-center rounded-full text-xs",
          done ? "bg-primary-solid text-primary-foreground" : "border-[1.5px] border-foreground/25 text-foreground/80"
        )}
      >
        {n}
      </span>
      {children}
    </h3>
  )
}

/**
 * The member's self-service payment flow: pick a plan, pay the gym's QR,
 * upload the receipt for staff to approve. Used both by MembershipGate (no
 * valid subscription) and the Membresía tab (renewing ahead of time).
 */
export function MemberPaymentSteps() {
  const { data: plans } = useMemberships()
  const { data: promotions } = usePromotions(1, 100)
  const { data: myGym } = useMyGym()
  const submitClaim = useSubmitPaymentClaim()
  const fileInputRef = React.useRef<HTMLInputElement>(null)
  const [membershipId, setMembershipId] = React.useState<string>("")
  const [sent, setSent] = React.useState(false)

  const options = (plans?.items ?? [])
    .filter((p) => p.is_active)
    .map((plan) => {
      const promo = applicablePromotion(promotions?.items ?? [], plan.id)
      const price = Number(plan.price)
      return { plan, promo, price, finalPrice: promo ? discountedPrice(price, promo) : price }
    })
  const selected = options.find((o) => o.plan.id === membershipId)

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
      <div className="flex items-start gap-3 rounded-2xl bg-emerald-500/10 p-4 ring-1 ring-emerald-500/30">
        <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-emerald-400" />
        <div>
          <p className="font-medium">Comprobante enviado</p>
          <p className="text-sm text-muted-foreground">
            La recepción lo revisará y activará tu membresía. Te avisaremos en notificaciones.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <section className="space-y-2.5">
        <StepTitle n={1} done={!!selected}>Elige tu plan</StepTitle>
        {options.length === 0 && (
          <p className="px-1 text-sm text-muted-foreground">El gimnasio todavía no publicó planes.</p>
        )}
        <div role="radiogroup" aria-label="Plan" className="space-y-2">
          {options.map(({ plan, promo, price, finalPrice }) => {
            const checked = plan.id === membershipId
            return (
              <label
                key={plan.id}
                className={cn(
                  "flex cursor-pointer items-center gap-3 rounded-2xl bg-card/75 px-4 py-3.5 ring-1 ring-foreground/10 transition-shadow",
                  checked && "ring-2 ring-primary"
                )}
              >
                <input
                  type="radio"
                  name="member-plan"
                  value={plan.id}
                  checked={checked}
                  onChange={() => setMembershipId(plan.id)}
                  className="size-4.5 accent-primary"
                />
                <span className="min-w-0 flex-1">
                  <span className="block font-medium">{plan.name}</span>
                  <span className="block text-[13px] text-muted-foreground">
                    {plan.duration_days} días{promo ? ` · ${promo.name}` : ""}
                  </span>
                </span>
                <span className="text-right tabular-nums">
                  {promo && (
                    <span className="block text-xs text-muted-foreground line-through">{formatCurrency(price)}</span>
                  )}
                  <span className="font-semibold">{formatCurrency(finalPrice)}</span>
                </span>
              </label>
            )
          })}
        </div>
      </section>

      <section className="space-y-2.5">
        <StepTitle n={2} done={!!selected}>Paga con el QR del gimnasio</StepTitle>
        <div className="flex items-center gap-4 rounded-2xl bg-card/75 p-4 ring-1 ring-foreground/10">
          {myGym?.payment_qr_image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={myGym.payment_qr_image}
              alt="QR de pago del gimnasio"
              className="size-29 shrink-0 rounded-xl bg-white object-contain p-1.5"
            />
          ) : (
            <span className="grid size-29 shrink-0 place-items-center rounded-xl bg-muted text-center text-xs text-muted-foreground">
              <QrCode className="size-8" />
            </span>
          )}
          <div className="min-w-0 space-y-1">
            <p className="text-[13px] text-muted-foreground">Monto a pagar</p>
            <p className="text-2xl font-semibold tabular-nums">{selected ? formatCurrency(selected.finalPrice) : "—"}</p>
            <p className="text-[13px] leading-snug text-muted-foreground">
              {myGym?.payment_qr_image
                ? "Escanéalo desde la app de tu banco o tu billetera digital."
                : "El gimnasio aún no cargó su QR. Paga en recepción y sube el comprobante."}
            </p>
          </div>
        </div>
      </section>

      <section className="space-y-2.5">
        <StepTitle n={3}>Envía el comprobante</StepTitle>
        <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
        <Button
          type="button"
          className="h-13 w-full gap-2.5 rounded-2xl text-base font-semibold"
          disabled={submitClaim.isPending || !membershipId}
          onClick={() => fileInputRef.current?.click()}
        >
          <Upload className="size-5" />
          {submitClaim.isPending ? "Enviando…" : "Subir comprobante"}
        </Button>
        <p className="px-1 text-center text-[13px] text-muted-foreground">
          {membershipId
            ? "La recepción lo revisa y activa tu membresía."
            : "Elige un plan para habilitar el envío."}
        </p>
      </section>
    </div>
  )
}

/**
 * Blocks a member-facing screen behind an active/paid subscription — only
 * the payment steps and a short explanation are shown until staff registers
 * a payment that activates one. Wrapped around the routine/nutrition/stats
 * tabs individually (see (member)/member/*), not the whole layout: the
 * Inicio and Membresía tabs must stay reachable even while unpaid, since
 * that's exactly where a member sees why they're blocked and pays.
 */
export function MembershipGate({ children }: { children: React.ReactNode }) {
  const { data: subscriptions, isLoading } = useSubscriptions()

  if (isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-24 w-full rounded-2xl" />
        <Skeleton className="h-40 w-full rounded-2xl" />
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
      <div className="space-y-4">
        <ExpiredNotice endDate={lastSub?.end_date} />
        <MemberPaymentSteps />
      </div>
    </FadeIn>
  )
}

export function ExpiredNotice({ endDate }: { endDate?: string }) {
  return (
    <section className="flex items-start gap-3 rounded-2xl bg-amber-500/10 p-4 ring-1 ring-amber-500/35">
      <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-amber-500/20 text-amber-400">
        <Lock className="size-4.5" />
      </span>
      <div className="space-y-1">
        <h2 className="text-[17px] leading-6 font-semibold">
          {endDate ? `Tu membresía venció el ${formatDayMonth(endDate)}` : "Todavía no tienes una membresía"}
        </h2>
        <p className="text-sm text-foreground/80">
          {endDate ? "Renuévala" : "Activa una"} para ver tu rutina y tu plan de nutrición, y para entrar al gimnasio.
        </p>
      </div>
    </section>
  )
}
