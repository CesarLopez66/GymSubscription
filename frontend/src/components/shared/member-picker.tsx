"use client"

import * as React from "react"
import { Check, ChevronDown, Search } from "lucide-react"

import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { cn } from "@/lib/utils"
import type { User } from "@/lib/types"
import { useUsers } from "@/hooks/use-users"

export function initialsOf(member: User) {
  return `${member.first_name[0] ?? ""}${member.last_name[0] ?? ""}`.toUpperCase()
}

export function MemberOption({ member }: { member: User }) {
  return (
    <span className="flex min-w-0 items-center gap-2">
      <Avatar size="sm" className="shrink-0">
        <AvatarFallback className="bg-primary/10 text-[10px] font-medium text-primary">
          {initialsOf(member)}
        </AvatarFallback>
      </Avatar>
      <span className="min-w-0 truncate">
        <span className="font-medium">
          {member.first_name} {member.last_name}
        </span>
        <span className="ml-1.5 text-xs text-muted-foreground">{member.email}</span>
      </span>
    </span>
  )
}

export function MemberPicker({
  value,
  onChange,
  placeholder = "Selecciona un miembro",
  clearable = false,
  clearLabel = "Venta directa / tienda",
}: {
  value: string
  onChange: (userId: string) => void
  placeholder?: string
  /** Shows a "no member" option at the top of the list, calling onChange(""). */
  clearable?: boolean
  clearLabel?: string
}) {
  const [open, setOpen] = React.useState(false)
  const [query, setQuery] = React.useState("")
  const { data: members, isLoading } = useUsers("MEMBER", 1, 100)

  const filtered = (members?.items ?? []).filter((m) => {
    const q = query.trim().toLowerCase()
    if (!q) return true
    return (
      `${m.first_name} ${m.last_name}`.toLowerCase().includes(q) ||
      m.email.toLowerCase().includes(q)
    )
  })
  const selected = members?.items.find((m) => m.id === value)

  return (
    <Popover
      open={open}
      onOpenChange={(v) => {
        setOpen(v)
        if (!v) setQuery("")
      }}
    >
      <PopoverTrigger
        render={
          <Button type="button" variant="outline" className="h-11 w-full justify-between font-normal" />
        }
      >
        {selected ? (
          <MemberOption member={selected} />
        ) : (
          <span className="text-muted-foreground">
            {isLoading ? "Cargando miembros…" : placeholder}
          </span>
        )}
        <ChevronDown className="size-4 shrink-0 text-muted-foreground" />
      </PopoverTrigger>
      <PopoverContent align="start" className="w-(--anchor-width) p-0">
        <div className="flex items-center gap-2 border-b px-2">
          <Search className="size-3.5 shrink-0 text-muted-foreground" />
          <Input
            autoFocus
            placeholder="Buscar por nombre o correo…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="h-9 border-0 bg-transparent px-0 shadow-none focus-visible:ring-0"
          />
        </div>
        <div className="max-h-64 overflow-y-auto p-1">
          {clearable && (
            <button
              type="button"
              onClick={() => {
                onChange("")
                setOpen(false)
              }}
              className={cn(
                "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm text-muted-foreground hover:bg-accent",
                !value && "bg-accent"
              )}
            >
              {clearLabel}
            </button>
          )}
          {filtered.map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => {
                onChange(m.id)
                setOpen(false)
              }}
              className={cn(
                "flex w-full items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left hover:bg-accent",
                value === m.id && "bg-accent"
              )}
            >
              <MemberOption member={m} />
              {value === m.id && <Check className="size-4 shrink-0 text-primary" />}
            </button>
          ))}
          {filtered.length === 0 && (
            <p className="p-2 text-center text-sm text-muted-foreground">Sin resultados.</p>
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}
