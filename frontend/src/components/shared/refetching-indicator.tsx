"use client"

import { createPortal } from "react-dom"
import { AnimatePresence, motion } from "framer-motion"
import { Loader2 } from "lucide-react"

/**
 * Full-screen blur + centered spinner shown while a filter change (range,
 * gym, search…) refetches in the background. Pairs with
 * `placeholderData: keepPreviousData`: without this, the old period's
 * numbers stay on screen with no visual cue that they're about to change,
 * which reads as stale/wrong data rather than "still loading".
 *
 * Rendered into a portal on `document.body` rather than in place: every
 * caller sits inside AppShell's page-transition `motion.div`, and Framer
 * Motion leaves a `transform` on that element even at rest — any ancestor
 * with a `transform` becomes the containing block for `position: fixed`
 * descendants per the CSS spec, so an in-place overlay would only cover
 * that div's own box (missing the sidebar and anything below it) instead
 * of the real viewport.
 */
export function LoadingOverlay({ show }: { show: boolean }) {
  const overlay = (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-background/50 backdrop-blur-sm"
        >
          <div className="flex flex-col items-center gap-3 rounded-xl bg-card/90 px-8 py-6 shadow-lg shadow-black/20 ring-1 ring-foreground/10">
            <Loader2 className="size-8 animate-spin text-primary" />
            <p className="text-sm font-medium text-muted-foreground">Actualizando…</p>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )

  if (typeof document === "undefined") return null
  return createPortal(overlay, document.body)
}
