import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useRouter } from "next/navigation"

import { api } from "@/lib/api-client"
import type { TokenPair, User } from "@/lib/types"
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
      router.push(roleHome(user.role))
    },
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

export function roleHome(role: User["role"]): string {
  switch (role) {
    case "SUPERADMIN":
      return "/superadmin"
    case "GYM_ADMIN":
      return "/dashboard"
    case "TRAINER":
    case "NUTRITIONIST":
      return "/trainer"
    case "MEMBER":
      return "/member"
    default:
      return "/login"
  }
}
