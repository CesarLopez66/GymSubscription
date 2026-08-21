"use client"

import * as React from "react"
import { Timer } from "lucide-react"

import { Button } from "@/components/ui/button"

export function RestTimer({ seconds }: { seconds: number }) {
  const [remaining, setRemaining] = React.useState<number | null>(null)
  const isRunning = remaining !== null && remaining > 0

  React.useEffect(() => {
    if (!isRunning) return
    const id = setTimeout(() => setRemaining((r) => (r !== null ? r - 1 : null)), 1000)
    return () => clearTimeout(id)
  }, [isRunning])

  return (
    <Button
      type="button"
      variant={isRunning ? "secondary" : "outline"}
      size="sm"
      onClick={() => setRemaining(seconds)}
      disabled={isRunning}
    >
      <Timer className="size-3.5" />
      {isRunning ? `${remaining}s` : `Rest ${seconds}s`}
    </Button>
  )
}
