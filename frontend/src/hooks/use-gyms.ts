import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import { api } from "@/lib/api-client"
import type { Gym, GymStatus, Page, SaaSPlanTier } from "@/lib/types"

export interface GymCreateInput {
  name: string
  subdomain: string
  contact_email: string
  contact_phone?: string
  address?: string
  plan_tier: SaaSPlanTier
}

export interface GymUpdateInput {
  name?: string
  status?: GymStatus
  plan_tier?: SaaSPlanTier
  contact_email?: string
  contact_phone?: string
  address?: string
}

export function useGyms(page = 1, pageSize = 20) {
  return useQuery({
    queryKey: ["gyms", page, pageSize],
    queryFn: () => api.get<Page<Gym>>(`/gyms?page=${page}&page_size=${pageSize}`),
  })
}

export function useCreateGym() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: GymCreateInput) => api.post<Gym>("/gyms", input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["gyms"] }),
  })
}

export function useUpdateGym() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: GymUpdateInput }) =>
      api.patch<Gym>(`/gyms/${id}`, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["gyms"] }),
  })
}
