// Shared between the pre-hydration inline script in app/layout.tsx (a
// Server Component) and client-side consumers (useGymTheme/useStoredGymName)
// — both read/write the same localStorage entry so a returning visitor's
// last-known gym colors/name paint immediately, instead of flashing the
// default theme until GET /gyms/me resolves. Kept free of any React import:
// app/layout.tsx pulls in just GYM_THEME_STORAGE_KEY, and Next.js refuses to
// let a Server Component import a module that also depends on a
// client-only hook (see hooks/use-stored-gym-name.ts).
export const GYM_THEME_STORAGE_KEY = "subgym-gym-theme"

export interface StoredGymTheme {
  name: string | null
  primary_color: string | null
  secondary_color: string | null
}

export function storeGymTheme(theme: StoredGymTheme): void {
  try {
    localStorage.setItem(GYM_THEME_STORAGE_KEY, JSON.stringify(theme))
  } catch {
    // Storage unavailable (private browsing, quota) — the CSS custom
    // properties still get set for this session, just not cached for next.
  }
}

// useStoredGymTheme (use-stored-gym-name.ts) feeds this straight into
// useSyncExternalStore as its getSnapshot, which requires a referentially
// stable return value whenever the underlying data hasn't changed — a
// fresh JSON.parse on every call breaks that (a new object each time reads
// as "changed" even when it isn't) and React throws "getSnapshot should be
// cached" / loops forever re-rendering. Parsing only when the raw string
// itself changes keeps the same object identity across calls in between.
let cachedRaw: string | null | undefined
let cachedTheme: StoredGymTheme | null = null

export function readStoredGymTheme(): StoredGymTheme | null {
  try {
    const raw = localStorage.getItem(GYM_THEME_STORAGE_KEY)
    if (raw !== cachedRaw) {
      cachedRaw = raw
      cachedTheme = raw ? (JSON.parse(raw) as StoredGymTheme) : null
    }
    return cachedTheme
  } catch {
    // Also covers SSR (no `localStorage` global) and private-browsing —
    // callers fall back to whatever GET /gyms/me eventually returns.
    return null
  }
}
