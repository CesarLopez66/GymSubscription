"use client"

import * as React from "react"
import dynamic from "next/dynamic"
import { QRCodeSVG } from "qrcode.react"
import { toast } from "sonner"
import { CheckCircle2, QrCode, ScanLine, XCircle } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { EntityCard } from "@/components/shared/entity-card"
import { MemberPicker } from "@/components/shared/member-picker"
import { FadeIn, StaggerGroup, StaggerItem } from "@/components/shared/motion"
import { ApiError } from "@/lib/api-client"
import { useCheckIns, useVerifyCheckIn } from "@/hooks/use-checkins"
import { useCheckinQr, useRegenerateCheckinQr } from "@/hooks/use-gyms"
import { useUsers } from "@/hooks/use-users"

// html5-qrcode touches `document`/camera APIs at import time, and it's only
// needed on this one page — load it lazily, client-side only, so every
// other route's bundle (and first paint) stays unaffected.
const QrScanner = dynamic(
  () => import("@/components/shared/qr-scanner").then((m) => m.QrScanner),
  {
    ssr: false,
    loading: () => <Skeleton className="mx-auto aspect-square w-full max-w-xs rounded-lg" />,
  }
)

function EntranceQrCard() {
  const { data, isLoading } = useCheckinQr()
  const regenerate = useRegenerateCheckinQr()

  const handleRegenerate = () => {
    regenerate.mutate(undefined, {
      onSuccess: () => toast.success("Código regenerado — el póster impreso anterior ya no funciona"),
      onError: (error) => toast.error(error instanceof ApiError ? error.detail : "No se pudo regenerar el código"),
    })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <QrCode className="size-4 text-primary" />
          QR de entrada
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col items-center gap-3">
        {isLoading && <Skeleton className="size-44 rounded-lg" />}
        {data && (
          <div className="rounded-xl bg-white p-3 shadow-lg shadow-primary/20">
            <QRCodeSVG value={data.checkin_qr_token} size={176} />
          </div>
        )}
        <p className="max-w-xs text-center text-xs text-muted-foreground">
          Imprime este código y pégalo en la entrada. Los miembros lo escanean con su
          celular para hacer check-in sin pasar por recepción.
        </p>
        <Button
          variant="outline"
          size="sm"
          onClick={handleRegenerate}
          disabled={regenerate.isPending}
        >
          {regenerate.isPending ? "Regenerando…" : "Regenerar código"}
        </Button>
      </CardContent>
    </Card>
  )
}

export default function CheckInMonitorPage() {
  const [selectedMember, setSelectedMember] = React.useState<string>("")
  const [scanKey, setScanKey] = React.useState(0)
  const lastScannedRef = React.useRef<{ code: string; at: number } | null>(null)
  const { data: members } = useUsers("MEMBER", 1, 100)
  const { data: checkIns } = useCheckIns(undefined, { live: true })
  const verify = useVerifyCheckIn()

  const memberName = (userId: string) => {
    const m = members?.items.find((u) => u.id === userId)
    return m ? `${m.first_name} ${m.last_name}` : userId.slice(0, 8)
  }

  const runVerify = React.useCallback(
    (userId: string) => {
      verify.mutate(userId, {
        onSuccess: (result) => {
          if (result.access_granted) {
            toast.success(`Acceso concedido — ${memberName(userId)}`)
          } else {
            toast.error(`Acceso denegado — ${result.denial_reason ?? "razón desconocida"}`)
          }
        },
        onError: (error) => {
          toast.error(error instanceof ApiError ? error.detail : "Falló el check-in")
        },
      })
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [verify, members]
  )

  const handleManualScan = () => {
    if (!selectedMember) return
    runVerify(selectedMember)
  }

  const handleCameraScan = React.useCallback(
    (decodedText: string) => {
      const now = Date.now()
      // The camera decodes ~10 frames/sec while the code is in view; ignore
      // repeats of the same code within 4s instead of firing a check-in per
      // frame.
      if (
        lastScannedRef.current &&
        lastScannedRef.current.code === decodedText &&
        now - lastScannedRef.current.at < 4000
      ) {
        return
      }
      lastScannedRef.current = { code: decodedText, at: now }
      runVerify(decodedText)
    },
    [runVerify]
  )

  return (
    <div className="space-y-6">
      <FadeIn>
        <h1 className="text-2xl font-semibold tracking-tight">Monitor de check-in</h1>
      </FadeIn>

      <div className="grid gap-6 lg:grid-cols-2">
        <FadeIn delay={0.05}>
          <EntranceQrCard />
        </FadeIn>

        <FadeIn delay={0.08}>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ScanLine className="size-4 text-primary" />
                Verificación manual
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="mb-3 text-xs text-muted-foreground">
                Los miembros ya pueden auto-registrar su entrada escaneando el QR de la
                puerta. Usa esto solo como respaldo (celular sin cámara, sin batería, etc).
              </p>
              <Tabs defaultValue="camera">
                <TabsList>
                  <TabsTrigger value="camera">Cámara</TabsTrigger>
                  <TabsTrigger value="manual">Selección manual</TabsTrigger>
                </TabsList>
                <TabsContent value="camera" className="pt-4">
                  <QrScanner key={scanKey} onScan={handleCameraScan} />
                  <p className="mt-2 text-center text-xs text-muted-foreground">
                    Apunta la cámara al código QR que el miembro muestra en su panel.
                  </p>
                  <Button
                    variant="link"
                    size="sm"
                    className="mx-auto mt-1 block"
                    onClick={() => setScanKey((k) => k + 1)}
                  >
                    Reiniciar cámara
                  </Button>
                </TabsContent>
                <TabsContent value="manual" className="pt-4">
                  <div className="flex flex-col gap-3 sm:flex-row">
                    <div className="min-w-0 flex-1">
                      <MemberPicker value={selectedMember} onChange={setSelectedMember} />
                    </div>
                    <Button onClick={handleManualScan} disabled={!selectedMember || verify.isPending}>
                      {verify.isPending ? "Verificando…" : "Verificar acceso"}
                    </Button>
                  </div>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </FadeIn>
      </div>

      <FadeIn delay={0.1}>
        <Card>
          <CardHeader>
            <CardTitle>Actividad en vivo</CardTitle>
          </CardHeader>
          <CardContent>
            <StaggerGroup className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {(checkIns?.items ?? []).map((c) => (
                <StaggerItem key={c.id}>
                  <EntityCard alert={!c.access_granted} contentClassName="gap-1.5 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium">{memberName(c.user_id)}</span>
                      <span className="text-xs text-muted-foreground">
                        {new Date(c.timestamp).toLocaleTimeString()}
                      </span>
                    </div>
                    {c.access_granted ? (
                      <Badge className="w-fit gap-1">
                        <CheckCircle2 className="size-3" />
                        Concedido
                      </Badge>
                    ) : (
                      <Badge variant="destructive" className="w-fit gap-1">
                        <XCircle className="size-3" />
                        {c.denial_reason ?? "Denegado"}
                      </Badge>
                    )}
                  </EntityCard>
                </StaggerItem>
              ))}
              {(checkIns?.items?.length ?? 0) === 0 && (
                <p className="text-sm text-muted-foreground sm:col-span-2 lg:col-span-3">
                  Todavía no hay check-ins hoy.
                </p>
              )}
            </StaggerGroup>
          </CardContent>
        </Card>
      </FadeIn>
    </div>
  )
}
