"use client"

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useUsers } from "@/hooks/use-users"

export function MemberPicker({
  value,
  onChange,
  placeholder = "Selecciona un miembro",
}: {
  value: string
  onChange: (userId: string) => void
  placeholder?: string
}) {
  const { data: members, isLoading } = useUsers("MEMBER", 1, 200)

  return (
    <Select value={value} onValueChange={(v) => onChange(v ?? "")}>
      <SelectTrigger className="w-full sm:w-80">
        <SelectValue placeholder={isLoading ? "Cargando miembros…" : placeholder} />
      </SelectTrigger>
      <SelectContent>
        {(members?.items ?? []).map((m) => (
          <SelectItem key={m.id} value={m.id}>
            {m.first_name} {m.last_name} ({m.email})
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
