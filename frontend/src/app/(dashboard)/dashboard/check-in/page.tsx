"use client"

import * as React from "react"
import dynamic from "next/dynamic"
import { toast } from "sonner"
import { motion } from "framer-motion"
import { CheckCircle2, ScanLine, XCircle } from "lucide-react"

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
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { FadeIn } from "@/components/shared/motion"
import { ApiError } from "@/lib/api-client"
import { useCheckIns, useVerifyCheckIn } from "@/hooks/use-checkins"
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

export default function CheckInMonitorPage() {
  const [selectedMember, setSelectedMember] = React.useState<string>("")
  const [scanKey, setScanKey] = React.useState(0)
  const lastScannedRef = React.useRef<{ code: string; at: number } | null>(null)
  const { data: members } = useUsers("MEMBER", 1, 200)
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

      <FadeIn delay={0.05}>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ScanLine className="size-4 text-primary" />
              Verificación de acceso
            </CardTitle>
          </CardHeader>
          <CardContent>
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
                  <Select
                    value={selectedMember}
                    onValueChange={(value) => setSelectedMember(value ?? "")}
                  >
                    <SelectTrigger className="w-full sm:w-80">
                      <SelectValue placeholder="Selecciona un miembro" />
                    </SelectTrigger>
                    <SelectContent>
                      {(members?.items ?? []).map((m) => (
                        <SelectItem key={m.id} value={m.id}>
                          {m.first_name} {m.last_name} ({m.email})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button onClick={handleManualScan} disabled={!selectedMember || verify.isPending}>
                    {verify.isPending ? "Verificando…" : "Verificar acceso"}
                  </Button>
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </FadeIn>

      <FadeIn delay={0.1}>
        <Card>
          <CardHeader>
            <CardTitle>Actividad en vivo</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Hora</TableHead>
                  <TableHead>Miembro</TableHead>
                  <TableHead>Resultado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(checkIns?.items ?? []).map((c, i) => (
                  <motion.tr
                    key={c.id}
                    initial={{ opacity: 0, y: -6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.25, delay: Math.min(i * 0.03, 0.2) }}
                    className="border-b transition-colors hover:bg-muted/50"
                  >
                    <TableCell className="text-muted-foreground">
                      {new Date(c.timestamp).toLocaleTimeString()}
                    </TableCell>
                    <TableCell className="font-medium">{memberName(c.user_id)}</TableCell>
                    <TableCell>
                      {c.access_granted ? (
                        <Badge className="gap-1">
                          <CheckCircle2 className="size-3" />
                          Concedido
                        </Badge>
                      ) : (
                        <Badge variant="destructive" className="gap-1">
                          <XCircle className="size-3" />
                          {c.denial_reason ?? "Denegado"}
                        </Badge>
                      )}
                    </TableCell>
                  </motion.tr>
                ))}
                {(checkIns?.items?.length ?? 0) === 0 && (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center text-muted-foreground">
                      Todavía no hay check-ins hoy.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </FadeIn>
    </div>
  )
}
