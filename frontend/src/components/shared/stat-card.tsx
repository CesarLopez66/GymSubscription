"use client"

import { motion } from "framer-motion"
import type { LucideIcon } from "lucide-react"

import { Card, CardContent } from "@/components/ui/card"
import { AnimatedNumber } from "@/components/shared/motion"

export function StatCard({
  label,
  value,
  icon: Icon,
  format,
  delay = 0,
}: {
  label: string
  value: number | null | undefined
  icon: LucideIcon
  format?: (n: number) => string
  delay?: number
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -2 }}
      transition={{ duration: 0.3, ease: "easeOut", delay }}
    >
      <Card className="relative overflow-hidden">
        <div className="pointer-events-none absolute -top-6 -right-6 size-20 rounded-full bg-primary/10 blur-2xl" />
        <CardContent className="flex items-center gap-3">
          <Icon className="size-10 shrink-0 text-primary" strokeWidth={1.5} />
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <span className="truncate text-sm font-medium text-muted-foreground" title={label}>
              {label}
            </span>
            <span className="truncate text-2xl font-semibold">
              {value == null ? "—" : <AnimatedNumber value={value} format={format} />}
            </span>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  )
}
