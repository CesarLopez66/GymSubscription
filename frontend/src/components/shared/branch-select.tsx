"use client"

import { Building2 } from "lucide-react"

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useBranches } from "@/hooks/use-branches"

const NO_BRANCH = "__none__"

/**
 * Optional per-branch classification picker for creation forms (members,
 * payments, subscriptions, evaluations). A gym with no branches renders
 * nothing, so single-location gyms see no extra UI at all.
 */
export function BranchSelect({
  value,
  onChange,
  label = "Sucursal (opcional)",
}: {
  value: string | undefined
  onChange: (value: string | undefined) => void
  label?: string
}) {
  const { data } = useBranches()
  const branches = (data?.items ?? []).filter((b) => b.is_active)

  if (branches.length === 0) return null

  const items = [
    { value: NO_BRANCH, label: "Sin sucursal específica" },
    ...branches.map((b) => ({ value: b.id, label: b.name })),
  ]

  return (
    <div className="grid gap-2">
      {label && <p className="text-sm font-medium">{label}</p>}
      <Select
        items={items}
        value={value ?? NO_BRANCH}
        onValueChange={(v) => onChange(!v || v === NO_BRANCH ? undefined : v)}
      >
        <SelectTrigger className="w-full">
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
    </div>
  )
}
