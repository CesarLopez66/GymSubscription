import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import { api } from "@/lib/api-client"
import type {
  GymSubscriptionPayment,
  GymSubscriptionPaymentWithGym,
  Page,
  SaaSPlanTier,
  SubscriptionRequestStatus,
} from "@/lib/types"

export interface GymSubscriptionPaymentInput {
  requested_plan_tier: SaaSPlanTier
  proof_image: string
}

export function useSubmitSubscriptionPayment() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: GymSubscriptionPaymentInput) =>
      api.post<GymSubscriptionPayment>("/gym-subscriptions", input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["gyms", "me"] }),
  })
}

export function useSubscriptionPayments(status?: SubscriptionRequestStatus, page = 1, pageSize = 20) {
  return useQuery({
    queryKey: ["gym-subscriptions", status, page, pageSize],
    queryFn: () => {
      const params = new URLSearchParams({ page: String(page), page_size: String(pageSize) })
      if (status) params.set("request_status", status)
      return api.get<Page<GymSubscriptionPaymentWithGym>>(`/gym-subscriptions?${params.toString()}`)
    },
  })
}

export function useApproveSubscriptionPayment() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) =>
      api.post<GymSubscriptionPayment>(`/gym-subscriptions/${id}/approve`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["gym-subscriptions"] })
      queryClient.invalidateQueries({ queryKey: ["superadmin"] })
      queryClient.invalidateQueries({ queryKey: ["gyms"] })
    },
  })
}

export function useRejectSubscriptionPayment() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      api.post<GymSubscriptionPayment>(`/gym-subscriptions/${id}/reject`, { reason }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["gym-subscriptions"] }),
  })
}
