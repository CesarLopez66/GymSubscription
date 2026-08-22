"use client"

import { motion } from "framer-motion"
import type { LucideIcon } from "lucide-react"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
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
        <CardHeader className="flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
          <span className="flex size-8 items-center justify-center rounded-lg bg-accent text-accent-foreground">
            <Icon className="size-4" />
          </span>
        </CardHeader>
        <CardContent className="text-3xl font-semibold">
          {value == null ? "—" : <AnimatedNumber value={value} format={format} />}
        </CardContent>
      </Card>
    </motion.div>
  )
}
