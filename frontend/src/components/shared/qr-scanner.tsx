"use client"

import * as React from "react"
import { Html5Qrcode, Html5QrcodeScannerState } from "html5-qrcode"
import { CameraOff, ScanLine } from "lucide-react"

import { Button } from "@/components/ui/button"

const ELEMENT_ID = "subgym-qr-reader"

/**
 * Camera-based QR scanner. Decodes whatever string is encoded in the QR
 * (the member dashboard encodes the member's own user id — see
 * app/(member)/member/page.tsx) and reports it via onScan. Requires camera
 * permission from the browser; falls back gracefully with an explicit error
 * state (and the check-in page keeps its manual member picker alongside
 * this, so front-desk staff are never blocked by a denied/unavailable
 * camera).
 */
export function QrScanner({ onScan }: { onScan: (decodedText: string) => void }) {
  const scannerRef = React.useRef<Html5Qrcode | null>(null)
  const [status, setStatus] = React.useState<"idle" | "starting" | "running" | "error">("idle")
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null)

  const stop = React.useCallback(async () => {
    const scanner = scannerRef.current
    if (scanner && scanner.getState() === Html5QrcodeScannerState.SCANNING) {
      await scanner.stop().catch(() => undefined)
    }
    setStatus("idle")
  }, [])

  const start = React.useCallback(async () => {
    setStatus("starting")
    setErrorMessage(null)
    try {
      const scanner = new Html5Qrcode(ELEMENT_ID, { verbose: false })
      scannerRef.current = scanner
      await scanner.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 240, height: 240 } },
        (decodedText) => {
          onScan(decodedText)
        },
        undefined
      )
      setStatus("running")
    } catch {
      setStatus("error")
      setErrorMessage(
        "No se pudo acceder a la cámara. Revisa los permisos del navegador o usa la selección manual."
      )
    }
  }, [onScan])

  React.useEffect(() => {
    return () => {
      const scanner = scannerRef.current
      if (scanner && scanner.getState() === Html5QrcodeScannerState.SCANNING) {
        scanner.stop().catch(() => undefined)
      }
    }
  }, [])

  return (
    <div className="space-y-3">
      <div
        id={ELEMENT_ID}
        className="mx-auto aspect-square w-full max-w-xs overflow-hidden rounded-lg border bg-black/40 [&_video]:rounded-lg"
      />
      {status !== "running" ? (
        <Button type="button" onClick={start} disabled={status === "starting"} className="w-full">
          <ScanLine className="size-4" />
          {status === "starting" ? "Activando cámara…" : "Escanear con cámara"}
        </Button>
      ) : (
        <Button type="button" variant="outline" onClick={stop} className="w-full">
          <CameraOff className="size-4" />
          Detener escaneo
        </Button>
      )}
      {errorMessage && <p className="text-center text-xs text-destructive">{errorMessage}</p>}
    </div>
  )
}
