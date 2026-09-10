import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useRouter } from "next/navigation"

import { api } from "@/lib/api-client"
import type { TokenPair, User, UserRole } from "@/lib/types"
import { useAuthStore } from "@/store/auth-store"

export interface LoginInput {
  email: string
  password: string
  gym_subdomain?: string
}

export function useLogin() {
  const setSession = useAuthStore((s) => s.setSession)
  const router = useRouter()

  return useMutation({
    mutationFn: async (input: LoginInput) => {
      const tokens = await api.post<TokenPair>("/auth/token", input, { skipAuth: true })
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
  { role: "TRAINER", href: "/trainer" },
  { role: "NUTRITIONIST", href: "/trainer" },
  { role: "MEMBER", href: "/member" },
]

export function roleHome(roles: User["roles"]): string {
  return ROLE_HOME_PRIORITY.find((entry) => roles.includes(entry.role))?.href ?? "/login"
}
