import * as React from "react"

import { Card, CardContent } from "@/components/ui/card"
import { cn } from "@/lib/utils"

/**
 * Shared visual shell for a repeated card in a grid/list (members, plans,
 * payments, gyms, promotions, etc.) — keeps hover elevation, the
 * clickable/alert border treatment, and internal spacing consistent with
 * the trainer "Clientes" cards across every screen.
 */
export function EntityCard({
  interactive = false,
  alert = false,
  className,
  contentClassName,
  onClick,
  children,
}: {
  interactive?: boolean
  alert?: boolean
  className?: string
  contentClassName?: string
  onClick?: () => void
  children: React.ReactNode
}) {
  return (
    <Card
      onClick={onClick}
      className={cn(
        "group relative h-full overflow-hidden py-0 transition-all hover:shadow-md",
        interactive && "cursor-pointer hover:-translate-y-0.5",
        alert
          ? "border-destructive/70 ring-1 ring-destructive/50 hover:border-destructive"
          : "hover:border-primary/50",
        className
      )}
    >
      <CardContent className={cn("flex flex-col gap-3 p-4", contentClassName)}>
        {children}
      </CardContent>
    </Card>
  )
}
