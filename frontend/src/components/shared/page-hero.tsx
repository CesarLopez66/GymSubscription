import type * as React from "react"

import { FadeIn } from "@/components/shared/motion"

const TODAY_LABEL = new Date().toLocaleDateString("es-BO", {
  weekday: "long",
  day: "numeric",
  month: "long",
})

/**
 * Greeting banner reusing the same `bg-gym-radial` treatment the login page
 * uses — carries that first-impression polish into every role's home screen
 * instead of leaving it stranded on login.
 */
export function PageHero({
  title,
  subtitle,
  action,
}: {
  title: string
  subtitle?: string
  action?: React.ReactNode
}) {
  return (
    <FadeIn>
      <div className="bg-gym-radial relative overflow-hidden rounded-xl ring-1 ring-foreground/10">
        <div className="relative flex flex-wrap items-center justify-between gap-4 p-6">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
            <p className="text-sm text-muted-foreground capitalize">{subtitle ?? TODAY_LABEL}</p>
          </div>
          {action}
        </div>
      </div>
    </FadeIn>
  )
}
