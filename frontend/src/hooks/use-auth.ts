import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useRouter } from "next/navigation"

import { api } from "@/lib/api-client"
import type { LoginChoicesResponse, TokenPair, User, UserRole } from "@/lib/types"
import { useAuthStore } from "@/store/auth-store"

export interface LoginInput {
  email: string
  password: string
  gym_subdomain?: string
}

// email+password alone can match more than one account (same address
// registered at two different gyms, or at a gym and the platform) — the
// backend replies with the candidates instead of a token pair, and the
// caller re-submits with one of those as gym_subdomain to disambiguate.
export type LoginResult =
  | { status: "success"; tokens: TokenPair; user: User }
  | { status: "choose_gym"; gyms: LoginChoicesResponse["gyms"] }

function isLoginChoices(value: TokenPair | LoginChoicesResponse): value is LoginChoicesResponse {
  return "requires_gym_selection" in value
}

export function useLogin() {
  const setSession = useAuthStore((s) => s.setSession)
  const router = useRouter()

  return useMutation({
    mutationFn: async (input: LoginInput): Promise<LoginResult> => {
      const result = await api.post<TokenPair | LoginChoicesResponse>("/auth/token", input, {
        skipAuth: true,
      })
      if (isLoginChoices(result)) {
        return { status: "choose_gym", gyms: result.gyms }
      }
      const user = await api.get<User>("/auth/me", {
        headers: { Authorization: `Bearer ${result.access_token}` },
      })
      return { status: "success", tokens: result, user }
    },
    onSuccess: (result) => {
      if (result.status !== "success") return
      setSession(result.tokens, result.user)
      router.push(roleHome(result.user.roles))
    },
  })
}

export interface RegisterGymInput {
  gym_name: string
  subdomain: string
  contact_phone?: string
  address?: string
  admin_first_name: string
  admin_last_name: string
  admin_email: string
  admin_password: string
}

// Public self-service signup — the gym and its first GYM_ADMIN are created
// together server-side, and the response is a normal token pair, so this
// logs the new admin straight in exactly like useLogin does.
export function useRegisterGym() {
  const setSession = useAuthStore((s) => s.setSession)
  const router = useRouter()

  return useMutation({
    mutationFn: async (input: RegisterGymInput) => {
      const tokens = await api.post<TokenPair>("/registration/gyms", input, { skipAuth: true })
      const user = await api.get<User>("/auth/me", {
        headers: { Authorization: `Bearer ${tokens.access_token}` },
      })
      return { tokens, user }
    },
    onSuccess: ({ tokens, user }) => {
      setSession(tokens, user)
      router.push(roleHome(user.roles))
    },
  })
}

export interface ForgotPasswordInput {
  email: string
  gym_subdomain?: string
}

export function useForgotPassword() {
  return useMutation({
    mutationFn: (input: ForgotPasswordInput) =>
      api.post<void>("/auth/forgot-password", input, { skipAuth: true }),
  })
}

export interface ResetPasswordInput {
  token: string
  new_password: string
}

export function useResetPassword() {
  return useMutation({
    mutationFn: (input: ResetPasswordInput) =>
      api.post<void>("/auth/reset-password", input, { skipAuth: true }),
  })
}

export function useLogout() {
  const clear = useAuthStore((s) => s.clear)
  const queryClient = useQueryClient()
  const router = useRouter()

  return () => {
    api.post("/auth/logout-all").catch(() => undefined)
    clear()
    queryClient.clear()
    router.push("/login")
  }
}

export function useCurrentUser() {
  const accessToken = useAuthStore((s) => s.accessToken)
  const storedUser = useAuthStore((s) => s.user)
  const setUser = useAuthStore((s) => s.setUser)

  return useQuery({
    queryKey: ["me"],
    queryFn: async () => {
      const user = await api.get<User>("/auth/me")
      setUser(user)
      return user
    },
    enabled: !!accessToken,
    initialData: storedUser ?? undefined,
    staleTime: 60_000,
  })
}

// A staff member can hold more than one role at once (e.g. GYM_ADMIN +
// TRAINER) — this picks a single landing area by priority when several of
// their roles would otherwise send them somewhere different.
const ROLE_HOME_PRIORITY: { role: UserRole; href: string }[] = [
  { role: "SUPERADMIN", href: "/superadmin" },
  { role: "GYM_ADMIN", href: "/dashboard" },
  { role: "BRANCH_MANAGER", href: "/branch" },
  { role: "TRAINER", href: "/trainer" },
  { role: "NUTRITIONIST", href: "/trainer" },
  { role: "MEMBER", href: "/member" },
]

export function roleHome(roles: User["roles"]): string {
  return ROLE_HOME_PRIORITY.find((entry) => roles.includes(entry.role))?.href ?? "/login"
}

// Roles that operate across every branch of their gym — mirrors the
// backend's _UNSCOPED_ROLES (app/deps/auth.py). Used to hide branch-picker
// UI (BranchFilter, BranchSelect) for a viewer whose access is already
// confined to a single branch, since choosing one is meaningless for them.
export function useIsUnscopedViewer(): boolean {
  const user = useAuthStore((s) => s.user)
  return !!user?.roles.some((r) => r === "GYM_ADMIN" || r === "SUPERADMIN")
}
