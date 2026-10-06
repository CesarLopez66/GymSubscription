"use client"

import { usePathname } from "next/navigation"

import { APP_VERSION } from "@/lib/version"

/** Small, unobtrusive system version watermark rendered from the root
 * layout — shows up on every screen (auth included, not just once logged
 * in), since it's meant to answer "what version am I on" wherever someone
 * happens to be, e.g. for support/bug reports. The member portal hides it:
 * its bottom tab bar runs edge to edge, so a fixed corner badge would sit
 * on top of the last tab's label. */
export function VersionBadge() {
  const pathname = usePathname()
  if (pathname.startsWith("/member")) return null
  return (
    <div className="pointer-events-none fixed bottom-2 right-2 z-10 font-mono text-[10px] text-muted-foreground/50 select-none">
      v{APP_VERSION}
    </div>
  )
}
