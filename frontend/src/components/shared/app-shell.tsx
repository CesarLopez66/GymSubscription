"use client"

import * as React from "react"
import Image from "next/image"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { useQueryClient, type QueryClient } from "@tanstack/react-query"
import { AnimatePresence, motion } from "framer-motion"
import { ChevronLeft, ChevronRight, LogOut, Menu, type LucideIcon } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet"
import { NotificationBell } from "@/components/shared/notification-bell"
import { useLogout } from "@/hooks/use-auth"
import { useMyGym } from "@/hooks/use-gyms"
import { useStoredGymName, useStoredGymTheme } from "@/hooks/use-stored-gym-name"
import { storeGymTheme } from "@/lib/gym-theme"
import { ROLE_LABELS } from "@/lib/labels"
import { useAuthStore } from "@/store/auth-store"

// Readable foreground (near-black or near-white) for a hex background,
// via relative luminance — good enough for arbitrary brand colors without
// needing a full color-contrast library.
function readableForeground(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16) / 255
  const g = parseInt(hex.slice(3, 5), 16) / 255
  const b = parseInt(hex.slice(5, 7), 16) / 255
  const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b
  return luminance > 0.55 ? "oklch(0.2 0.02 275)" : "oklch(0.98 0.01 275)"
}

const GYM_THEME_VARS = [
  "--primary",
  "--primary-solid",
  "--primary-foreground",
  "--ring",
  "--sidebar-primary",
  "--sidebar-primary-foreground",
  "--sidebar-ring",
  "--chart-1",
  "--accent",
  "--accent-foreground",
  "--sidebar-accent",
] as const

// useLayoutEffect applies colors before the browser paints (useEffect only
// runs after), which is what actually prevents the flash on a client-side
// navigation into a gym-scoped screen — e.g. straight after login, where
// the inline script in app/layout.tsx never re-runs (it only fires once,
// on that original page load). Falls back to useEffect during SSR, where
// useLayoutEffect is a no-op and React logs a warning if called directly.
const useIsomorphicLayoutEffect = typeof window !== "undefined" ? React.useLayoutEffect : React.useEffect

/** Overrides the app's fixed brand palette with the current gym's custom
 * colors (set by a superadmin on the gym record) — falls back to the
 * default theme when a gym hasn't customized one or both. */
function useGymTheme() {
  // SUPERADMIN has no gym_id — /gyms/me is only meaningful for the other
  // three roles that AppShell also renders for (dashboard/trainer/member).
  const hasGym = useAuthStore((s) => !!s.user?.gym_id)
  const { data: gym } = useMyGym(hasGym)
  // True from mount until GET /gyms/me actually resolves.
  const stillLoading = hasGym && gym === undefined
  // The inline script in app/layout.tsx only ever runs once, on whatever
  // page the browser actually (re)loaded — it does nothing for a
  // client-side navigation into a gym-scoped screen, most importantly the
  // router.push() straight out of a fresh login. This is this component's
  // own fallback for exactly that case: while the live fetch is in flight,
  // paint this gym's last-known colors from localStorage (if this browser
  // has ever loaded them before) instead of sitting on the default theme
  // for the whole round trip.
  const cachedTheme = useStoredGymTheme(stillLoading)
  const primaryColor = stillLoading ? (cachedTheme?.primary_color ?? null) : (gym?.primary_color ?? null)
  const secondaryColor = stillLoading
    ? (cachedTheme?.secondary_color ?? null)
    : (gym?.secondary_color ?? null)
  const gymName = stillLoading ? (cachedTheme?.name ?? null) : (gym?.name ?? null)

  useIsomorphicLayoutEffect(() => {
    // Every mount asserts the *full* state — positive (this gym's colors)
    // or negative (explicitly cleared) — instead of only ever adding
    // overrides and trusting the previous screen's own cleanup to have run
    // first. These are global properties on <html>, outside React's tree,
    // so a screen with no custom colors (or none, like superadmin) must
    // actively clear whatever an earlier screen left behind rather than
    // just skip setting anything.
    const root = document.documentElement.style
    if (primaryColor) {
      root.setProperty("--primary", primaryColor)
      root.setProperty("--primary-solid", primaryColor)
      root.setProperty("--primary-foreground", readableForeground(primaryColor))
      root.setProperty("--ring", `${primaryColor}99`)
      root.setProperty("--sidebar-primary", primaryColor)
      root.setProperty("--sidebar-primary-foreground", readableForeground(primaryColor))
      root.setProperty("--sidebar-ring", `${primaryColor}99`)
      root.setProperty("--chart-1", primaryColor)
    } else {
      root.removeProperty("--primary")
      root.removeProperty("--primary-solid")
      root.removeProperty("--primary-foreground")
      root.removeProperty("--ring")
      root.removeProperty("--sidebar-primary")
      root.removeProperty("--sidebar-primary-foreground")
      root.removeProperty("--sidebar-ring")
      root.removeProperty("--chart-1")
    }
    if (secondaryColor) {
      root.setProperty("--accent", secondaryColor)
      root.setProperty("--accent-foreground", readableForeground(secondaryColor))
      root.setProperty("--sidebar-accent", secondaryColor)
    } else {
      root.removeProperty("--accent")
      root.removeProperty("--accent-foreground")
      root.removeProperty("--sidebar-accent")
    }

    // Only cache once GET /gyms/me actually settles — while stillLoading,
    // primaryColor/secondaryColor/gymName above are themselves already
    // sourced from this same cache, so re-storing them here would be a
    // no-op at best and, if this browser's cache was stale or empty, would
    // overwrite a *better* cache written by another tab that finished
    // loading first.
    if (!stillLoading) {
      storeGymTheme({ name: gymName, primary_color: primaryColor, secondary_color: secondaryColor })
    }

    // Belt-and-suspenders: also clear on unmount, in case whatever screen
    // comes next doesn't mount an AppShell at all (e.g. straight to /login).
    return () => {
      for (const cssVar of GYM_THEME_VARS) root.removeProperty(cssVar)
    }
  }, [stillLoading, primaryColor, secondaryColor, gymName])
}

/** Sidebar/header title: the gym's own name (same gradient+glow treatment
 * the "GymOps Ai" wordmark used to carry, now that the wordmark itself is
 * gone from authenticated screens) plus the role context ("Admin",
 * "Coaching"...). SUPERADMIN has no gym, so it falls back to just the role. */
function HeaderBrand({ title, className }: { title: string; className?: string }) {
  const hasGym = useAuthStore((s) => !!s.user?.gym_id)
  const { data: gym } = useMyGym(hasGym)
  // Seeded from the name useGymTheme cached on a previous load, so the
  // header shows it immediately instead of sitting role-only for however
  // long GET /gyms/me takes — corrected the instant the live query resolves.
  const cachedName = useStoredGymName(hasGym)
  const name = gym?.name ?? cachedName

  return (
    // `className` sets the role's font-size; the name span sizes itself off
    // that via `em` (not a fixed Tailwind step) specifically so it always
    // renders at exactly double the role text next to it, in every header
    // context this renders in (sidebar, mobile sheet, mobile top bar).
    <span className={cn("flex min-w-0 items-baseline gap-1.5", className)}>
      {name && (
        <span className="min-w-0 truncate text-[2em] leading-none font-heading font-semibold tracking-tight text-gradient-gym text-glow-gym">
          {name}
        </span>
      )}
      {name && <span className="shrink-0 text-sidebar-foreground/50">-</span>}
      <span className="min-w-0 truncate font-heading font-semibold tracking-tight">{title}</span>
    </span>
  )
}

export interface NavItem {
  label: string
  href: string
  icon: LucideIcon
  /** Warms this item's primary React Query data on hover/focus, so the page
   * already has data cached by the time a click actually navigates there. */
  prefetch?: (queryClient: QueryClient) => void
}

function NavLinks({
  navItems,
  activeHref,
  collapsed = false,
  labelsReady = true,
  onNavigate,
}: {
  navItems: NavItem[]
  activeHref: string | undefined
  collapsed?: boolean
  labelsReady?: boolean
  onNavigate?: () => void
}) {
  const router = useRouter()
  const queryClient = useQueryClient()

  const prefetchItem = (item: NavItem) => {
    router.prefetch(item.href)
    item.prefetch?.(queryClient)
  }

  return (
    <nav className="relative flex-1 space-y-1.5 p-3">
      {navItems.map((item) => {
        const active = item.href === activeHref
        const Icon = item.icon
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            onMouseEnter={() => prefetchItem(item)}
            onFocus={() => prefetchItem(item)}
            title={collapsed ? item.label : undefined}
            className={cn(
              "relative flex items-center gap-3.5 overflow-hidden rounded-lg px-3.5 py-2.5 text-base font-medium transition-colors",
              collapsed && "justify-center px-0",
              active
                ? "text-sidebar-primary-foreground"
                : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
            )}
          >
            {active && (
              <motion.span
                layoutId="nav-active-pill"
                className="absolute inset-0 rounded-lg bg-sidebar-primary"
                transition={{ type: "spring", stiffness: 400, damping: 32 }}
              />
            )}
            <Icon className="relative size-5 shrink-0" />
            {/* Gated on `labelsReady`, not just `!collapsed`: that flips the
                instant you click, while <aside>'s width keeps animating for
                ~200ms after — rendering the label immediately squeezes it
                into a container still mid-transition. labelsReady lags just
                behind the animation on expand (collapse still hides it
                instantly, which looks fine). whitespace-nowrap is a second
                line of defense so a still-narrow container clips instead of
                wrapping into a jumbled stack. */}
            {!collapsed && labelsReady && (
              <span className="relative min-w-0 truncate whitespace-nowrap">{item.label}</span>
            )}
          </Link>
        )
      })}
    </nav>
  )
}

function UserFooter({
  onLogout,
  collapsed = false,
  labelsReady = true,
}: {
  onLogout: () => void
  collapsed?: boolean
  labelsReady?: boolean
}) {
  const user = useAuthStore((s) => s.user)
  const initials = user ? `${user.first_name[0]}${user.last_name[0]}` : "?"

  if (collapsed) {
    return (
      <div className="flex flex-col items-center gap-2 border-t border-sidebar-border p-3">
        <Avatar className="size-9">
          <AvatarFallback className="bg-sidebar-accent text-sidebar-accent-foreground">
            {initials}
          </AvatarFallback>
        </Avatar>
        <NotificationBell />
        <Button
          variant="ghost"
          size="icon"
          onClick={onLogout}
          title="Cerrar sesión"
          className="text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
        >
          <LogOut className="size-4" />
        </Button>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-3 overflow-hidden border-t border-sidebar-border p-4">
      <Avatar className="size-10 shrink-0">
        <AvatarFallback className="bg-sidebar-accent text-sidebar-accent-foreground">
          {initials}
        </AvatarFallback>
      </Avatar>
      {/* Gated on labelsReady, same reasoning as the nav labels: rendering
          this the instant `collapsed` flips false squeezes it into <aside>
          while its width is still animating open. Dropping the whole block
          (rather than just the text) for that ~150ms also keeps the icons
          after it from being shoved into a too-narrow row. */}
      {labelsReady && (
        <div className="min-w-0 flex-1">
          <p className="truncate text-base font-medium">
            {user?.first_name} {user?.last_name}
          </p>
          <p className="truncate text-sm text-sidebar-foreground/60">
            {user?.roles?.map((r) => ROLE_LABELS[r]).join(" / ") ?? ""}
          </p>
        </div>
      )}
      <NotificationBell />
      <Button
        variant="ghost"
        size="icon"
        onClick={onLogout}
        title="Cerrar sesión"
        className="shrink-0 text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
      >
        <LogOut className="size-4" />
      </Button>
    </div>
  )
}

export function AppShell({
  title,
  navItems,
  children,
}: {
  title: string
  navItems: NavItem[]
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const logout = useLogout()
  useGymTheme()
  const [mobileNavOpen, setMobileNavOpen] = React.useState(false)
  const [collapsed, setCollapsed] = React.useState(false)

  // Text content (nav labels, the footer's name/role, the header's title)
  // only renders once this flips true — instantly on collapse, but only
  // ~180ms after expanding starts, so it never renders into an <aside> that
  // hasn't finished its own 200ms width transition yet. Without the delay,
  // labels/text get squeezed into a still-narrow sidebar for a moment and
  // render garbled. Set from the toggle button's own click handler (below),
  // not from an effect watching `collapsed` — this *is* the state change,
  // not a reaction to some other system, so an effect would just add a
  // redundant render pass.
  const [labelsReady, setLabelsReady] = React.useState(true)
  const labelsReadyTimer = React.useRef<ReturnType<typeof setTimeout>>(undefined)

  const toggleCollapsed = () => {
    clearTimeout(labelsReadyTimer.current)
    setCollapsed((prev) => {
      const next = !prev
      if (next) {
        setLabelsReady(false)
      } else {
        labelsReadyTimer.current = setTimeout(() => setLabelsReady(true), 180)
      }
      return next
    })
  }

  // Pick the single most specific matching href so a parent route (e.g. the
  // "/dashboard" overview) doesn't also light up on every nested subroute
  // (e.g. "/dashboard/members") — that would activate two nav items at once
  // and break the shared `layoutId` pill animation below.
  const activeHref = navItems
    .map((item) => item.href)
    .filter((href) => pathname === href || pathname.startsWith(`${href}/`))
    .sort((a, b) => b.length - a.length)[0]

  return (
    <div className="relative flex h-screen w-full overflow-hidden">
      <Image
        src="/images/gym-background.jpg"
        alt=""
        fill
        priority
        sizes="100vw"
        className="-z-10 scale-110 object-cover blur-xl"
      />
      <div className="absolute inset-0 -z-10 bg-linear-to-b from-background/92 via-background/90 to-background" />
      {/* The outer shell is h-screen (not min-h-screen) and every scrollable
          flex child down the tree carries min-h-0 — flex items default to
          min-height:auto, which ignores flex-1's intent to shrink and lets
          content grow the whole page instead of scrolling inside its own
          box. Without min-h-0 on <main>, the entire page (sidebar included)
          scrolled together and the user/notifications/logout footer ended
          up dragged out of view. Now only <main> (and, if long, the nav
          list) scrolls; the sidebar never moves. */}
      <aside
        className={cn(
          "sticky top-0 hidden h-screen shrink-0 flex-col border-r bg-sidebar text-sidebar-foreground transition-[width] duration-200 ease-in-out md:flex",
          collapsed ? "w-20" : "w-72"
        )}
      >
        <div
          className={cn(
            "flex h-16 shrink-0 items-center overflow-hidden border-b border-sidebar-border",
            collapsed ? "justify-center px-2" : "justify-between px-5"
          )}
        >
          {!collapsed && labelsReady && <HeaderBrand title={title} className="text-lg" />}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          <NavLinks
            navItems={navItems}
            activeHref={activeHref}
            collapsed={collapsed}
            labelsReady={labelsReady}
          />
        </div>
        <UserFooter onLogout={logout} collapsed={collapsed} labelsReady={labelsReady} />
      </aside>

      {/* Rendered as a sibling of <aside>, not inside it: <aside> is
          `sticky`, which — per spec — always creates its own stacking
          context. A child positioned to poke outside aside's box (as this
          button does) would have the portion beyond that edge painted over
          by <main> anyway, since aside's whole subtree stacks as one unit
          against its siblings — making that overhanging half of the button
          look clickable but not actually receive the click.
          One button toggles both directions: it slides along with aside's
          own width transition (left-20 collapsed, left-72 expanded) and
          just flips which chevron it shows. */}
      <button
        type="button"
        onClick={toggleCollapsed}
        title={collapsed ? "Expandir menú" : "Contraer menú"}
        className={cn(
          "fixed top-1/2 z-20 hidden size-11 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-white/20 bg-primary/60 text-primary-foreground shadow-lg shadow-black/40 ring-2 ring-background backdrop-blur-md transition-all duration-200 ease-in-out hover:bg-primary/80 md:flex",
          collapsed ? "left-20" : "left-72"
        )}
      >
        {collapsed ? <ChevronRight className="size-5" /> : <ChevronLeft className="size-5" />}
      </button>

      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <header className="flex h-16 shrink-0 items-center justify-between border-b bg-sidebar px-4 text-sidebar-foreground md:hidden">
          <div className="flex items-center gap-1">
            <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
              <SheetTrigger
                render={
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-sidebar-foreground/70 hover:bg-sidebar-accent"
                  />
                }
              >
                <Menu className="size-5" />
                <span className="sr-only">Abrir menú</span>
              </SheetTrigger>
              <SheetContent side="left" className="flex w-72 flex-col">
                <div className="flex h-16 shrink-0 items-center gap-2 border-b border-sidebar-border px-6">
                  <HeaderBrand title={title} className="text-lg" />
                </div>
                <div className="min-h-0 flex-1 overflow-y-auto">
                  <NavLinks
                    navItems={navItems}
                    activeHref={activeHref}
                    onNavigate={() => setMobileNavOpen(false)}
                  />
                </div>
                <UserFooter
                  onLogout={() => {
                    setMobileNavOpen(false)
                    logout()
                  }}
                />
              </SheetContent>
            </Sheet>
            <HeaderBrand title={title} className="text-base" />
          </div>
          <div className="flex items-center gap-1">
            <NotificationBell />
            <Button
              variant="ghost"
              size="icon"
              onClick={logout}
              className="text-sidebar-foreground/70 hover:bg-sidebar-accent"
            >
              <LogOut className="size-4" />
            </Button>
          </div>
        </header>
        <main className="bg-gym-radial relative min-h-0 flex-1 overflow-y-auto p-4 md:p-8">
          <AnimatePresence mode="wait">
            <motion.div
              key={pathname}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              className="mx-auto w-full max-w-7xl"
            >
              {children}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
    </div>
  )
}
