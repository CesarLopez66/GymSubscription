"use client"

import * as React from "react"
import { AnimatePresence, motion } from "framer-motion"
import { Building2, Check, ChevronDown } from "lucide-react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
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
  const [open, setOpen] = React.useState(false)

  const gyms = data?.items ?? []
  const items = [
    { value: ALL_GYMS, label: "Todos los gimnasios" },
    ...gyms.map((g) => ({ value: g.id, label: g.name })),
  ]

  const selectedGym = gyms.find((g) => g.id === gymId)

  return (
    <div className="relative">
      <Button
        variant="outline"
        size="sm"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <Building2 className="size-4 text-muted-foreground" />
        {selectedGym ? selectedGym.name : "Seleccionar gimnasio"}
        <ChevronDown className={cn("size-4 transition-transform", open && "rotate-180")} />
      </Button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="absolute top-full left-0 z-20 mt-1 w-56 overflow-hidden rounded-lg border border-border bg-popover shadow-md"
          >
            <div className="flex flex-col gap-0.5 p-1">
              {items.map((item) => {
                const isSelected = item.value === ALL_GYMS ? gymId === null : gymId === item.value
                return (
                  <button
                    key={item.value}
                    type="button"
                    onClick={() => {
                      setGymId(item.value === ALL_GYMS ? null : item.value)
                      setOpen(false)
                    }}
                    className={cn(
                      "flex items-center justify-between gap-2 rounded-md px-2.5 py-1.5 text-left text-sm hover:bg-muted",
                      isSelected && "bg-muted font-medium"
                    )}
                  >
                    {item.label}
                    {isSelected && <Check className="size-3.5 shrink-0" />}
                  </button>
                )
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
