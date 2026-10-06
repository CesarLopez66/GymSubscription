"use client"

import * as React from "react"
import { AnimatePresence, motion } from "framer-motion"
import { Building2, Check, ChevronDown } from "lucide-react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { useIsUnscopedViewer } from "@/hooks/use-auth"
import { useBranches } from "@/hooks/use-branches"
import { useBranchFilterStore } from "@/store/branch-filter-store"

const ALL_BRANCHES = "__all__"

/** Gym-wide sucursal filter for dashboard views (overview, members, pagos,
 * check-in). Backed by a shared store so the selection persists as the
 * admin navigates between those pages. Renders nothing for a single-location
 * gym — same rule as BranchSelect, so gyms without branches see no extra UI.
 * Also renders nothing for a branch-scoped viewer (BRANCH_MANAGER/TRAINER/
 * NUTRITIONIST) — the backend already confines them to their own branch
 * regardless of what this would send, so picking one is meaningless. */
export function BranchFilter() {
  const isUnscoped = useIsUnscopedViewer()
  const { data } = useBranches()
  const branchId = useBranchFilterStore((s) => s.branchId)
  const setBranchId = useBranchFilterStore((s) => s.setBranchId)
  const branches = (data?.items ?? []).filter((b) => b.is_active)
  const [open, setOpen] = React.useState(false)

  if (!isUnscoped || branches.length === 0) return null

  const items = [
    { value: ALL_BRANCHES, label: "Todas las sucursales" },
    ...branches.map((b) => ({ value: b.id, label: b.name })),
  ]

  const selectedBranch = branches.find((b) => b.id === branchId)

  return (
    <div className="relative">
      <Button
        variant="outline"
        size="sm"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <Building2 className="size-4 text-muted-foreground" />
        {selectedBranch ? selectedBranch.name : "Seleccionar sucursal"}
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
                const isSelected =
                  item.value === ALL_BRANCHES ? !branchId : branchId === item.value
                return (
                  <button
                    key={item.value}
                    type="button"
                    onClick={() => {
                      setBranchId(item.value === ALL_BRANCHES ? undefined : item.value)
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
