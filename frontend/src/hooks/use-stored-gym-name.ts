import { useSyncExternalStore } from "react"

import { readStoredGymTheme, type StoredGymTheme } from "@/lib/gym-theme"

// Nothing external ever fires this — the cached theme is a one-shot
// instant-paint fallback, corrected by the live query moments later, not a
// value that needs to stay in sync for the component's whole lifetime.
const noopSubscribe = () => () => {}

/** Cached gym branding (name + colors) for a header/theme's instant-paint
 * fallback, read through useSyncExternalStore so the first client render
 * matches the server-rendered (localStorage-less) markup — both resolve via
 * getServerSnapshot — without the "setState inside an effect" pattern,
 * which the project's react-hooks/set-state-in-effect rule rejects. */
export function useStoredGymTheme(enabled: boolean): StoredGymTheme | null {
  return useSyncExternalStore(
    noopSubscribe,
    () => (enabled ? readStoredGymTheme() : null),
    () => null
  )
}

export function useStoredGymName(enabled: boolean): string | null {
  return useStoredGymTheme(enabled)?.name ?? null
}
