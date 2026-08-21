import { create } from "zustand"
import { createJSONStorage, persist } from "zustand/middleware"

import type { User } from "@/lib/types"

interface AuthState {
  accessToken: string | null
  refreshToken: string | null
  user: User | null
  hasHydrated: boolean
  setHasHydrated: (value: boolean) => void
  setSession: (tokens: { access_token: string; refresh_token: string }, user: User) => void
  setTokens: (tokens: { access_token: string; refresh_token: string }) => void
  setUser: (user: User) => void
  clear: () => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      accessToken: null,
      refreshToken: null,
      user: null,
      hasHydrated: false,
      setHasHydrated: (value) => set({ hasHydrated: value }),
      setSession: (tokens, user) =>
        set({
          accessToken: tokens.access_token,
          refreshToken: tokens.refresh_token,
          user,
        }),
      setTokens: (tokens) =>
        set({ accessToken: tokens.access_token, refreshToken: tokens.refresh_token }),
      setUser: (user) => set({ user }),
      clear: () => set({ accessToken: null, refreshToken: null, user: null }),
    }),
    {
      name: "subgym-auth",
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
        user: state.user,
      }),
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true)
      },
    }
  )
)
