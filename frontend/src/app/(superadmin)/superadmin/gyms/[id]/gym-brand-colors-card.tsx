"use client"

import * as React from "react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ColorInput } from "@/components/shared/color-input"
import { ApiError } from "@/lib/api-client"
import type { Gym } from "@/lib/types"
import { useUpdateGym } from "@/hooks/use-gyms"

export function GymBrandColorsCard({ gym }: { gym: Gym }) {
  const updateGym = useUpdateGym()
  const [primaryColor, setPrimaryColor] = React.useState<string | undefined>(undefined)
  const [secondaryColor, setSecondaryColor] = React.useState<string | undefined>(undefined)

  // Seed the editable color state from the fetched gym once (and again if
  // the id in the URL changes) — a ref, not a `gym`-keyed effect, so it
  // doesn't clobber what the superadmin is mid-typing every time this query
  // silently refetches in the background.
  const seededGymId = React.useRef<string | null>(null)
  React.useEffect(() => {
    if (seededGymId.current !== gym.id) {
      seededGymId.current = gym.id
      setPrimaryColor(gym.primary_color ?? undefined)
      setSecondaryColor(gym.secondary_color ?? undefined)
    }
  }, [gym])

  const colorsChanged =
    primaryColor !== (gym.primary_color ?? undefined) || secondaryColor !== (gym.secondary_color ?? undefined)

  const handleSaveColors = () => {
    updateGym.mutate(
      { id: gym.id, input: { primary_color: primaryColor ?? null, secondary_color: secondaryColor ?? null } },
      {
        onSuccess: () => toast.success("Colores actualizados"),
        onError: (error) =>
          toast.error(error instanceof ApiError ? error.detail : "No se pudieron actualizar los colores"),
      }
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Colores de marca</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Se aplican al panel de administración, entrenadores y miembros de este gimnasio. Deja
          un color vacío para usar el tema por defecto.
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
        <Button size="sm" disabled={!colorsChanged || updateGym.isPending} onClick={handleSaveColors}>
          {updateGym.isPending ? "Guardando…" : "Guardar colores"}
        </Button>
      </CardContent>
    </Card>
  )
}
