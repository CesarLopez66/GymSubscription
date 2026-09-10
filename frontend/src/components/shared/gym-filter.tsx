"use client"

import { Building2 } from "lucide-react"

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useGyms } from "@/hooks/use-gyms"
import { useSuperAdminFilterStore } from "@/store/superadmin-filter-store"

const ALL_GYMS = "__all__"

/**
 * Every /superadmin screen's data — charts, stat cards, tables, the
 * exported reports — can be scoped to one paying tenant or shown combined.
 * This selector drives that shared filter (see superadmin-filter-store).
 */
export function GymFilter() {
  const { data } = useGyms(1, 100)
  const gymId = useSuperAdminFilterStore((s) => s.gymId)
  const setGymId = useSuperAdminFilterStore((s) => s.setGymId)

  const gyms = data?.items ?? []
  const items = [
    { value: ALL_GYMS, label: "Todos los gimnasios" },
    ...gyms.map((g) => ({ value: g.id, label: g.name })),
  ]

  return (
    <Select
      items={items}
      value={gymId ?? ALL_GYMS}
      onValueChange={(value) => setGymId(!value || value === ALL_GYMS ? null : value)}
    >
      <SelectTrigger className="w-56">
        <Building2 className="size-4 text-muted-foreground" />
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {items.map((item) => (
          <SelectItem key={item.value} value={item.value}>
            {item.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
