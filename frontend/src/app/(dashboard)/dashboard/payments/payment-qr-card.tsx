"use client"

import * as React from "react"
import { toast } from "sonner"
import { QrCode, Upload } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { FadeIn } from "@/components/shared/motion"
import { ApiError } from "@/lib/api-client"
import { useMyGym, useUpdatePaymentQr } from "@/hooks/use-gyms"

const MAX_QR_BYTES = 1_500_000

export function PaymentQrCard() {
  const { data: myGym } = useMyGym()
  const updateQr = useUpdatePaymentQr()
  const qrInputRef = React.useRef<HTMLInputElement>(null)

  const handleQrFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ""
    if (!file) return
    if (!file.type.startsWith("image/")) {
      toast.error("Selecciona un archivo de imagen")
      return
    }
    if (file.size > MAX_QR_BYTES) {
      toast.error("La imagen es muy grande (máximo 1.5 MB)")
      return
    }
    const reader = new FileReader()
    reader.onload = () => {
      updateQr.mutate(reader.result as string, {
        onSuccess: () => toast.success("QR de cobro actualizado"),
        onError: (error) =>
          toast.error(error instanceof ApiError ? error.detail : "No se pudo subir el QR"),
      })
    }
    reader.readAsDataURL(file)
  }

  return (
    <FadeIn delay={0.02}>
      <Card className="overflow-hidden border-primary/30 bg-gym-radial">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <QrCode className="size-5" />
            QR de cobro del gimnasio
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col items-center gap-4 sm:flex-row sm:items-start">
          {myGym?.payment_qr_image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={myGym.payment_qr_image}
              alt="QR de cobro"
              className="size-40 rounded-xl bg-white p-3 object-contain shadow-lg shadow-primary/20"
            />
          ) : (
            <div className="flex size-40 shrink-0 items-center justify-center rounded-xl border border-dashed border-muted-foreground/40 p-3 text-center text-xs text-muted-foreground">
              Todavía no has subido un QR de cobro
            </div>
          )}
          <div className="flex flex-1 flex-col gap-2">
            <p className="text-sm text-muted-foreground">
              Los pagos ahora se cobran solo mostrando este código para que el miembro
              transfiera desde su banco o billetera digital. Súbelo una vez y muéstralo en
              cada venta; luego registra el pago aquí para llevar el control.
            </p>
            <input
              ref={qrInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleQrFile}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="w-fit"
              disabled={updateQr.isPending}
              onClick={() => qrInputRef.current?.click()}
            >
              <Upload className="size-4" />
              {updateQr.isPending ? "Subiendo…" : myGym?.payment_qr_image ? "Cambiar QR" : "Subir QR"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </FadeIn>
  )
}
