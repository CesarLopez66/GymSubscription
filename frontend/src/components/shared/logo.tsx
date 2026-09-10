import Image from "next/image"

import { cn } from "@/lib/utils"

const SIZES = {
  sm: { mark: "size-7", text: "text-sm", radius: "rounded-lg", gap: "gap-2" },
  md: { mark: "size-8", text: "text-base", radius: "rounded-lg", gap: "gap-2" },
  lg: { mark: "size-10", text: "text-lg", radius: "rounded-xl", gap: "gap-2" },
  xl: { mark: "size-12", text: "text-2xl", radius: "rounded-2xl", gap: "gap-3" },
  // Hero-sized lockup: stands in for a page's main heading (e.g. the login
  // screen), not just a header wordmark.
  "2xl": { mark: "size-16 lg:size-20", text: "text-4xl lg:text-6xl", radius: "rounded-3xl", gap: "gap-4 lg:gap-5" },
} as const

/**
 * GymOps Ai's mark: the cyborg-lifter artwork used as the app's favicon
 * (see src/app/icon.jpg) — kept as a plain <img>-in-a-badge instead of a
 * generic icon-in-a-box, so the app reads as a product with its own
 * identity rather than a UI-kit demo.
 */
export function LogoMark({ size = "md", className }: { size?: keyof typeof SIZES; className?: string }) {
  const { mark, radius } = SIZES[size]
  return (
    <span
      className={cn(mark, radius, "relative shrink-0 overflow-hidden shadow-sm shadow-primary/30", className)}
      aria-hidden="true"
    >
      <Image src="/images/gymops-icon.jpg" alt="" fill sizes="96px" className="object-cover" />
    </span>
  )
}

export function Logo({
  size = "md",
  className,
}: {
  size?: keyof typeof SIZES
  className?: string
}) {
  const { text, gap } = SIZES[size]
  return (
    <span className={cn("flex items-center", gap, className)}>
      <LogoMark size={size} />
      <span className={cn(text, "font-heading font-semibold tracking-tight")}>
        <span className="text-gradient-primary">Gym</span>
        <span>Ops</span> <span className="text-gradient-primary text-glow-ai">Ai</span>
      </span>
    </span>
  )
}
