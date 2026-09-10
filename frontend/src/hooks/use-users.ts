import { queryOptions, useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import { api } from "@/lib/api-client"
import type { Page, Sex, User, UserRole } from "@/lib/types"

export interface UserCreateInput {
  email: string
  password: string
  roles: UserRole[]
  first_name: string
  last_name: string
  phone?: string
  date_of_birth?: string
  sex?: Sex
  branch_id?: string
}

export function usersQueryOptions(role?: UserRole, page = 1, pageSize = 20, branchId?: string) {
  return queryOptions({
    queryKey: ["users", role, page, pageSize, branchId] as const,
    queryFn: () => {
      const params = new URLSearchParams({ page: String(page), page_size: String(pageSize) })
      if (role) params.set("role", role)
      if (branchId) params.set("branch_id", branchId)
      return api.get<Page<User>>(`/users?${params.toString()}`)
    },
  })
}

export function useUsers(role?: UserRole, page = 1, pageSize = 20, branchId?: string) {
  return useQuery(usersQueryOptions(role, page, pageSize, branchId))
}

export function useCreateUser() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: UserCreateInput) => api.post<User>("/users", input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["users"] }),
  })
}

export function useDeactivateUser() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (userId: string) => api.delete<User>(`/users/${userId}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["users"] }),
  })
}

export interface UserUpdateInput {
  first_name?: string
  last_name?: string
  phone?: string
  sex?: Sex
  is_active?: boolean
  branch_id?: string | null
  roles?: UserRole[]
}

export function useUpdateUser() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UserUpdateInput }) =>
      api.patch<User>(`/users/${id}`, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["users"] }),
  })
}
