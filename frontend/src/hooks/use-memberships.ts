import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import { api } from "@/lib/api-client"
import type { Membership, Page } from "@/lib/types"

export interface MembershipInput {
  name: string
  description?: string
  price: number
  duration_days: number
  is_active?: boolean
}

export function useMemberships(page = 1, pageSize = 50) {
  return useQuery({
    queryKey: ["memberships", page, pageSize],
    queryFn: () => api.get<Page<Membership>>(`/memberships?page=${page}&page_size=${pageSize}`),
  })
}

export function useCreateMembership() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: MembershipInput) => api.post<Membership>("/memberships", input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["memberships"] }),
  })
}

export function useUpdateMembership() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: Partial<MembershipInput> }) =>
      api.patch<Membership>(`/memberships/${id}`, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["memberships"] }),
  })
}
