"use client"

import * as React from "react"
import dynamic from "next/dynamic"
import Link from "next/link"
import { QRCodeSVG } from "qrcode.react"
import { toast } from "sonner"
import { Check, CheckCircle2, ChevronRight, Dumbbell, Flame, ScanLine, TriangleAlert, XCircle } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { FadeIn } from "@/components/shared/motion"
import { ApiError } from "@/lib/api-client"
import { amber, emerald } from "@/lib/badge-colors"
import { daysUntil, formatDate, formatRecentDateTime, formatToday } from "@/lib/format"
import { isSubscriptionValid } from "@/lib/subscription-status"
import type { CheckIn } from "@/lib/types"
import { cn } from "@/lib/utils"
import {
  currentWeekDates,
  localDateKey,
  muscleSummary,
  todayDayOfWeek,
  trainingDayPosition,
} from "@/lib/week"
import { useCheckIns, useSelfCheckIn } from "@/hooks/use-checkins"
import { useMemberships } from "@/hooks/use-memberships"
import { useSubscriptions } from "@/hooks/use-subscriptions"
import { useWorkoutPlans } from "@/hooks/use-workouts"
import { useAuthStore } from "@/store/auth-store"

// html5-qrcode touches `document`/camera APIs at import time, and it's only
// needed once the member opens the scanner — load it lazily, client-side
// only, so it doesn't affect this page's first paint.
const QrScanner = dynamic(
  () => import("@/components/shared/qr-scanner").then((m) => m.QrScanner),
  {
    ssr: false,
    loading: () => <Skeleton className="mx-auto aspect-square w-full max-w-xs rounded-lg" />,
  }
)

const WEEKDAY_INITIALS = ["L", "M", "M", "J", "V", "S", "D"]

const cardClass = "rounded-2xl bg-card/75 p-4 shadow-lg shadow-black/20 ring-1 ring-foreground/10 backdrop-blur-md"

export default function MemberHomePage() {
  const user = useAuthStore((s) => s.user)
  const { data: myCheckIns } = useCheckIns(undefined, { pageSize: 60 })

  const grantedDays = React.useMemo(
    () =>
      new Set(
        (myCheckIns?.items ?? [])
          .filter((c) => c.access_granted)
          .map((c) => localDateKey(new Date(c.timestamp)))
      ),
    [myCheckIns]
  )

  // Consecutive days with a granted check-in, counting back from today (or
  // from yesterday if today's visit hasn't happened yet, so the streak
  // doesn't reset to 0 the moment the clock passes midnight).
  const streak = React.useMemo(() => {
    const cursor = new Date()
    if (!grantedDays.has(localDateKey(cursor))) cursor.setDate(cursor.getDate() - 1)
    let count = 0
    while (grantedDays.has(localDateKey(cursor))) {
      count++
      cursor.setDate(cursor.getDate() - 1)
    }
    return count
  }, [grantedDays])

  const week = currentWeekDates()
  const visitsThisWeek = week.filter((d) => grantedDays.has(localDateKey(d))).length
  const lastVisit = (myCheckIns?.items ?? [])
    .filter((c) => c.access_granted)
    .sort((a, b) => b.timestamp.localeCompare(a.timestamp))[0]

  return (
    <div className="space-y-4">
      <FadeIn>
        <div className="flex items-start justify-between gap-3 px-1">
          <div className="min-w-0">
            <h1 className="text-2xl font-semibold tracking-tight">Hola, {user?.first_name ?? "campeón"}</h1>
            <p className="text-sm text-muted-foreground">
              {formatToday()}
              {visitsThisWeek > 0 &&
                ` · ${visitsThisWeek} ${visitsThisWeek === 1 ? "entrenamiento" : "entrenamientos"} esta semana`}
            </p>
          </div>
          {streak > 1 && (
            <Badge className="mt-1 shrink-0 gap-1 border-0 bg-orange-500/15 text-orange-400">
              <Flame className="size-3" />
              {streak} días seguidos
            </Badge>
          )}
        </div>
      </FadeIn>

      <FadeIn delay={0.02}>
        <CheckInCard lastVisit={lastVisit} />
      </FadeIn>

      <FadeIn delay={0.04}>
        <MembershipSummary />
      </FadeIn>

      <FadeIn delay={0.06}>
        <TodayRoutine />
      </FadeIn>

      <FadeIn delay={0.08}>
        <section className={cn(cardClass, "space-y-3")}>
          <div className="flex items-baseline justify-between">
            <h2 className="font-heading text-[17px] font-medium">Esta semana</h2>
            <span className="text-[13px] text-muted-foreground">
              {visitsThisWeek} de 7 días
            </span>
          </div>
          <ol className="grid grid-cols-7 gap-1.5 text-center text-xs text-muted-foreground">
            {week.map((day, i) => {
              const key = localDateKey(day)
              const visited = grantedDays.has(key)
              const isToday = key === localDateKey(new Date())
              const isFuture = day > new Date()
              return (
                <li
                  key={key}
                  className={cn("flex flex-col items-center gap-1.5", isToday && "font-semibold text-foreground")}
                  aria-label={`${day.toLocaleDateString("es-BO", { weekday: "long" })}: ${visited ? "entrenaste" : "sin entrada"}`}
                >
                  <span
                    className={cn(
                      "grid size-8 place-items-center rounded-full",
                      visited && "bg-primary text-primary-foreground",
                      !visited && isToday && "border-2 border-primary",
                      !visited && !isToday && !isFuture && "border border-dashed border-foreground/20",
                      !visited && isFuture && "bg-muted"
                    )}
                  >
                    {visited && <Check className="size-3.5" strokeWidth={3} />}
                  </span>
                  {WEEKDAY_INITIALS[i]}
                </li>
              )
            })}
          </ol>
        </section>
      </FadeIn>
    </div>
  )
}

function CheckInCard({ lastVisit }: { lastVisit?: CheckIn }) {
  const user = useAuthStore((s) => s.user)
  const [scanning, setScanning] = React.useState(false)
  const [showReceptionQr, setShowReceptionQr] = React.useState(false)
  const [scanKey, setScanKey] = React.useState(0)
  const [lastResult, setLastResult] = React.useState<CheckIn | null>(null)
  const lastScannedRef = React.useRef<{ code: string; at: number } | null>(null)
  const selfCheckIn = useSelfCheckIn()

  const handleScan = React.useCallback(
    (decodedText: string) => {
      const now = Date.now()
      if (
        lastScannedRef.current &&
        lastScannedRef.current.code === decodedText &&
        now - lastScannedRef.current.at < 4000
      ) {
        return
      }
      lastScannedRef.current = { code: decodedText, at: now }

      selfCheckIn.mutate(decodedText, {
        onSuccess: (result) => {
          setLastResult(result)
          setScanning(false)
          if (result.access_granted) {
            toast.success("Entrada registrada")
          } else {
            toast.error(result.denial_reason ?? "Acceso denegado")
          }
        },
        onError: (error) => {
          toast.error(error instanceof ApiError ? error.detail : "No se pudo procesar el código")
        },
      })
    },
    [selfCheckIn]
  )

  return (
    <section className="bg-gym-radial space-y-4 rounded-3xl bg-card p-5 ring-1 ring-foreground/10">
      <div className="space-y-1">
        <span className="text-xs font-semibold tracking-wider text-primary uppercase">Check-in</span>
        <p className="text-[15px] leading-snug text-foreground/85">
          {scanning
            ? "Apunta la cámara al QR pegado en la entrada del gimnasio."
            : "Escanea el código QR de la recepción para entrar."}
        </p>
      </div>

      {scanning ? (
        <div className="space-y-2">
          <QrScanner key={scanKey} onScan={handleScan} />
          <div className="flex justify-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => setScanKey((k) => k + 1)}>
              Reiniciar cámara
            </Button>
            <Button variant="outline" size="sm" onClick={() => setScanning(false)}>
              Cancelar
            </Button>
          </div>
        </div>
      ) : (
        <>
          {lastResult && (
            <p
              className={cn(
                "flex items-center gap-2 rounded-xl px-3 py-2 text-sm",
                lastResult.access_granted ? emerald : "border-0 bg-red-500/15 text-red-400"
              )}
            >
              {lastResult.access_granted ? <CheckCircle2 className="size-4" /> : <XCircle className="size-4" />}
              {lastResult.access_granted
                ? `Entrada registrada a las ${new Date(lastResult.timestamp).toLocaleTimeString("es-BO", { hour: "2-digit", minute: "2-digit", hourCycle: "h23" })}`
                : (lastResult.denial_reason ?? "Acceso denegado")}
            </p>
          )}
          <Button
            className="h-14 w-full gap-2.5 rounded-2xl text-[17px] font-semibold shadow-lg shadow-primary-solid/40 [&_svg:not([class*='size-'])]:size-5.5"
            onClick={() => setScanning(true)}
            disabled={selfCheckIn.isPending}
          >
            <ScanLine />
            {selfCheckIn.isPending ? "Verificando…" : "Escanear QR de entrada"}
          </Button>
        </>
      )}

      <div className="flex items-center justify-between gap-3 text-[13px] text-muted-foreground">
        <span>{lastVisit ? `Última entrada: ${formatRecentDateTime(lastVisit.timestamp)}` : "Aún no registras entradas"}</span>
        <button
          type="button"
          className="shrink-0 py-2 font-medium text-primary hover:underline"
          aria-expanded={showReceptionQr}
          onClick={() => setShowReceptionQr((v) => !v)}
        >
          {showReceptionQr ? "Ocultar mi código" : "Registro en recepción"}
        </button>
      </div>

      {showReceptionQr && user && (
        <div className="flex flex-col items-center gap-2 pb-1">
          <div className="rounded-2xl bg-white p-3 shadow-lg shadow-primary/20">
            <QRCodeSVG value={user.id} size={148} />
          </div>
          <p className="text-[13px] text-muted-foreground">Muestra este código en recepción.</p>
        </div>
      )}
    </section>
  )
}

function MembershipSummary() {
  const { data: subscriptions, isLoading } = useSubscriptions()
  const { data: memberships } = useMemberships()

  if (isLoading) return <Skeleton className="h-28 w-full rounded-2xl" />

  const active = (subscriptions?.items ?? []).find((s) => isSubscriptionValid(s))

  if (!active) {
    return (
      <Link
        href="/member/membership"
        className="flex items-center gap-3 rounded-2xl bg-amber-500/10 p-4 ring-1 ring-amber-500/35 transition-colors hover:bg-amber-500/15"
      >
        <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-amber-500/20 text-amber-400">
          <TriangleAlert className="size-4.5" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-medium">No tienes una membresía activa</span>
          <span className="block text-[13px] text-muted-foreground">Renuévala para entrar y ver tu rutina.</span>
        </span>
        <ChevronRight className="size-5 text-muted-foreground" />
      </Link>
    )
  }

  const plan = memberships?.items.find((m) => m.id === active.membership_id)
  const daysLeft = Math.max(daysUntil(active.end_date), 0)
  const totalDays = Math.max(daysUntil(active.end_date) - daysUntil(active.start_date), 1)
  const elapsed = Math.min(Math.max((totalDays - daysLeft) / totalDays, 0), 1)
  const expiring = daysLeft <= 7

  return (
    <Link href="/member/membership" className={cn(cardClass, "block space-y-3 transition-colors hover:ring-primary/40")}>
      <div className="flex items-center justify-between gap-2">
        <span className="font-heading text-[17px] font-medium">{plan?.name ?? "Tu plan"}</span>
        <Badge className={expiring ? amber : emerald}>{expiring ? "Por vencer" : "Activa"}</Badge>
      </div>
      <div className="flex justify-between text-sm">
        <span className="text-muted-foreground">Vence el {formatDate(active.end_date)}</span>
        <span className="font-semibold tabular-nums">
          {daysLeft === 0 ? "Vence hoy" : `${daysLeft} ${daysLeft === 1 ? "día" : "días"}`}
        </span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-secondary" aria-hidden="true">
        <div
          className={cn("h-full rounded-full", expiring ? "bg-amber-400" : "bg-primary")}
          style={{ width: `${Math.round((1 - elapsed) * 100)}%` }}
        />
      </div>
    </Link>
  )
}

function TodayRoutine() {
  const { data: subscriptions } = useSubscriptions()
  const { data: workoutPlans, isLoading } = useWorkoutPlans()
  const hasAccess = (subscriptions?.items ?? []).some((s) => isSubscriptionValid(s))
  if (!hasAccess) return null
  if (isLoading) return <Skeleton className="h-20 w-full rounded-2xl" />

  const plan = workoutPlans?.items.find((p) => p.is_active)
  if (!plan) return null

  const today = todayDayOfWeek()
  const items = plan.items.filter((i) => i.day_of_week === today)
  const position = trainingDayPosition(plan.items, today)

  return (
    <Link href="/member/routine" className={cn(cardClass, "flex items-center gap-3.5 transition-colors hover:ring-primary/40")}>
      <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-primary/15 text-primary">
        <Dumbbell className="size-6" strokeWidth={1.75} />
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
          Rutina de hoy{position ? ` · Día ${position.index} de ${position.total}` : ""}
        </span>
        <span className="truncate font-semibold">
          {items.length > 0 ? muscleSummary(items) : "Día de descanso"}
        </span>
        <span className="text-[13px] text-muted-foreground">
          {items.length > 0
            ? `${items.length} ${items.length === 1 ? "ejercicio" : "ejercicios"}`
            : "Nada programado para hoy"}
        </span>
      </span>
      <ChevronRight className="size-5 shrink-0 text-muted-foreground" />
    </Link>
  )
}
