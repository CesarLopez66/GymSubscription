"use client"

import * as React from "react"
import dynamic from "next/dynamic"
import { QRCodeSVG } from "qrcode.react"
import { toast } from "sonner"
import { CheckCircle2, Flame, ScanLine, XCircle } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { FadeIn } from "@/components/shared/motion"
import { ApiError } from "@/lib/api-client"
import type { CheckIn } from "@/lib/types"
import { useCheckIns, useSelfCheckIn } from "@/hooks/use-checkins"
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

export default function MemberScannerPage() {
  const user = useAuthStore((s) => s.user)
  const [scanning, setScanning] = React.useState(false)
  const [scanKey, setScanKey] = React.useState(0)
  const [lastResult, setLastResult] = React.useState<CheckIn | null>(null)
  const lastScannedRef = React.useRef<{ code: string; at: number } | null>(null)
  const selfCheckIn = useSelfCheckIn()
  const { data: myCheckIns } = useCheckIns(undefined, { pageSize: 60 })

  // Consecutive days with a granted check-in, counting back from today (or
  // from yesterday if today's visit hasn't happened yet, so the streak
  // doesn't reset to 0 the moment the clock passes midnight).
  const streak = React.useMemo(() => {
    const grantedDays = new Set(
      (myCheckIns?.items ?? [])
        .filter((c) => c.access_granted)
        .map((c) => c.timestamp.slice(0, 10))
    )
    const cursor = new Date()
    if (!grantedDays.has(cursor.toISOString().slice(0, 10))) {
      cursor.setDate(cursor.getDate() - 1)
    }
    let count = 0
    while (grantedDays.has(cursor.toISOString().slice(0, 10))) {
      count++
      cursor.setDate(cursor.getDate() - 1)
    }
    return count
  }, [myCheckIns])

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
            toast.success("¡Check-in registrado!")
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
    <div className="space-y-6">
      <FadeIn>
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold tracking-tight">
              Hola, {user?.first_name ?? "campeón"} 👋
            </h1>
            <p className="text-xs text-muted-foreground">
              {new Date().toLocaleDateString("es-BO", { weekday: "long", day: "numeric", month: "long" })}
            </p>
          </div>
          {streak > 0 && (
            <Badge className="gap-1 border-0 bg-orange-500/15 text-orange-400">
              <Flame className="size-3" />
              {streak} día{streak === 1 ? "" : "s"} seguidos
            </Badge>
          )}
        </div>
      </FadeIn>

      <FadeIn delay={0.02}>
        <Card className="overflow-hidden border-primary/30 bg-gym-radial">
          <CardHeader className="text-center">
            <CardTitle className="flex items-center justify-center gap-2">
              <ScanLine className="size-4 text-primary" />
              Check-in
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col items-center gap-3">
            {scanning ? (
              <>
                <QrScanner key={scanKey} onScan={handleScan} />
                <p className="text-xs text-muted-foreground">
                  Apunta la cámara al QR pegado en la entrada del gimnasio.
                </p>
                <div className="flex gap-2">
                  <Button variant="link" size="sm" onClick={() => setScanKey((k) => k + 1)}>
                    Reiniciar cámara
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setScanning(false)}>
                    Cancelar
                  </Button>
                </div>
              </>
            ) : (
              <>
                {lastResult && (
                  <Badge
                    variant={lastResult.access_granted ? "default" : "destructive"}
                    className="gap-1"
                  >
                    {lastResult.access_granted ? (
                      <CheckCircle2 className="size-3" />
                    ) : (
                      <XCircle className="size-3" />
                    )}
                    {lastResult.access_granted
                      ? `Entrada registrada — ${new Date(lastResult.timestamp).toLocaleTimeString()}`
                      : (lastResult.denial_reason ?? "Acceso denegado")}
                  </Badge>
                )}
                <Button onClick={() => setScanning(true)} disabled={selfCheckIn.isPending}>
                  {selfCheckIn.isPending ? "Verificando…" : "Escanear QR de entrada"}
                </Button>
              </>
            )}

            <details className="w-full text-center">
              <summary className="cursor-pointer text-xs text-muted-foreground">
                ¿Prefieres que te registren en recepción?
              </summary>
              {user && (
                <div className="mt-3 flex flex-col items-center gap-2">
                  <div className="rounded-xl bg-white p-3 shadow-lg shadow-primary/20">
                    <QRCodeSVG value={user.id} size={140} />
                  </div>
                  <p className="text-xs text-muted-foreground">Muestra esto en recepción.</p>
                </div>
              )}
            </details>
          </CardContent>
        </Card>
      </FadeIn>
    </div>
  )
}
