"use client"

import * as React from "react"
import { toast } from "sonner"
import { Palette } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ColorInput } from "@/components/shared/color-input"
import { FadeIn } from "@/components/shared/motion"
import { ApiError } from "@/lib/api-client"
import { useMyGym, useUpdateMyGymBranding } from "@/hooks/use-gyms"

export default function GymSettingsPage() {
  const { data: gym } = useMyGym()
  const updateBranding = useUpdateMyGymBranding()
  const [primaryColor, setPrimaryColor] = React.useState<string | undefined>(undefined)
  const [secondaryColor, setSecondaryColor] = React.useState<string | undefined>(undefined)

  // Seed the editable color state from the fetched gym once — a ref, not a
  // `gym`-keyed effect, so it doesn't clobber what the admin is mid-typing
  // every time this query silently refetches in the background.
  const seeded = React.useRef(false)
  React.useEffect(() => {
    if (!seeded.current && gym) {
      seeded.current = true
      setPrimaryColor(gym.primary_color ?? undefined)
      setSecondaryColor(gym.secondary_color ?? undefined)
    }
  }, [gym])

  const colorsChanged =
    !!gym &&
    (primaryColor !== (gym.primary_color ?? undefined) ||
      secondaryColor !== (gym.secondary_color ?? undefined))

  const handleSave = () => {
    updateBranding.mutate(
      { primary_color: primaryColor ?? null, secondary_color: secondaryColor ?? null },
      {
        onSuccess: () => toast.success("Colores actualizados"),
        onError: (error) =>
          toast.error(error instanceof ApiError ? error.detail : "No se pudieron actualizar los colores"),
      }
    )
  }

  return (
    <div className="space-y-6">
      <FadeIn>
        <h1 className="text-2xl font-semibold tracking-tight">Personalización</h1>
        <p className="text-sm text-muted-foreground">
          La apariencia de tu gimnasio en el panel de administración, entrenadores y miembros.
        </p>
      </FadeIn>

      <FadeIn delay={0.05}>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Palette className="size-4" />
              Colores de marca
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Deja un color vacío para usar el tema por defecto de la plataforma.
            </p>
            <div className="grid gap-4 sm:grid-cols-2">
              <ColorInput label="Color primario" value={primaryColor} onChange={setPrimaryColor} />
              <ColorInput
                label="Color secundario"
                value={secondaryColor}
                onChange={setSecondaryColor}
                fallback="#a855f7"
              />
            </div>
            <Button
              size="sm"
              disabled={!colorsChanged || updateBranding.isPending}
              onClick={handleSave}
            >
              {updateBranding.isPending ? "Guardando…" : "Guardar colores"}
            </Button>
          </CardContent>
        </Card>
      </FadeIn>
    </div>
  )
}
