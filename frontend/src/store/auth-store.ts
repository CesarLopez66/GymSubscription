import { create } from "zustand"
import { createJSONStorage, persist } from "zustand/middleware"

import type { User } from "@/lib/types"

interface ImpersonationStash {
  accessToken: string
  refreshToken: string
  user: User
}

interface AuthState {
  accessToken: string | null
  refreshToken: string | null
  user: User | null
  hasHydrated: boolean
  /** The superadmin's real session, stashed while a "view as" session is active. */
  impersonation: ImpersonationStash | null
  setHasHydrated: (value: boolean) => void
  setSession: (tokens: { access_token: string; refresh_token: string }, user: User) => void
  setTokens: (tokens: { access_token: string; refresh_token: string }) => void
  setUser: (user: User) => void
  clear: () => void
  startImpersonation: (accessToken: string, targetUser: User) => void
  stopImpersonation: () => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      accessToken: null,
      refreshToken: null,
      user: null,
      hasHydrated: false,
      impersonation: null,
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
      clear: () => set({ accessToken: null, refreshToken: null, user: null, impersonation: null }),
      startImpersonation: (accessToken, targetUser) => {
        const { accessToken: currentAccess, refreshToken: currentRefresh, user: currentUser } = get()
        if (!currentAccess || !currentRefresh || !currentUser) return
        set({
          impersonation: { accessToken: currentAccess, refreshToken: currentRefresh, user: currentUser },
          accessToken,
          refreshToken: null,
          user: targetUser,
        })
      },
      stopImpersonation: () => {
        const stash = get().impersonation
        if (!stash) return
        set({
          accessToken: stash.accessToken,
          refreshToken: stash.refreshToken,
          user: stash.user,
          impersonation: null,
        })
      },
    }),
    {
      name: "subgym-auth",
      // Bumped when `User.role` (scalar) became `User.roles` (array) — a
      // browser with a session persisted before that change has a `user`
      // object shaped like the old API, and `user.roles.some(...)` in
      // RequireAuth throws on the missing field. `migrate` patches that one
      // persisted object in place instead of forcing every open session to
      // log back in.
      version: 1,
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
        user: state.user,
        impersonation: state.impersonation,
      }),
      migrate: (persistedState, version) => {
        const state = persistedState as {
          user?: (User & { role?: string }) | null
          impersonation?: { user: User & { role?: string } } | null
        } | null

        const upgradeUser = <T extends { roles?: string[]; role?: string } | null | undefined>(
          user: T
        ): T => {
          if (!user || Array.isArray(user.roles)) return user
          return { ...user, roles: user.role ? [user.role] : [], role: undefined }
        }

        if (state && version < 1) {
          state.user = upgradeUser(state.user)
          if (state.impersonation) {
            state.impersonation = { ...state.impersonation, user: upgradeUser(state.impersonation.user)! }
          }
        }

        return state as AuthState
      },
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true)
      },
    }
  )
)
