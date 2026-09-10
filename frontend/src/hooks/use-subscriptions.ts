import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import { api } from "@/lib/api-client"
import type { MemberSubscription, Page, SubscriptionStatus } from "@/lib/types"

export interface SubscriptionCreateInput {
  user_id: string
  membership_id: string
  branch_id?: string
  start_date?: string
  payment_amount: number
  payment_method: string
}

export function useSubscriptions(userId?: string, page = 1, pageSize = 20, branchId?: string) {
  return useQuery({
    queryKey: ["subscriptions", userId, page, pageSize, branchId],
    queryFn: () => {
      const params = new URLSearchParams({ page: String(page), page_size: String(pageSize) })
      if (userId) params.set("user_id", userId)
      if (branchId) params.set("branch_id", branchId)
      return api.get<Page<MemberSubscription>>(`/subscriptions?${params.toString()}`)
    },
  })
}

export function useCreateSubscription() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: SubscriptionCreateInput) =>
      api.post<MemberSubscription>("/subscriptions", input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["subscriptions"] }),
  })
}

export function useUpdateSubscription() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({
      id,
      status,
      end_date,
    }: {
      id: string
      status?: SubscriptionStatus
      end_date?: string
    }) => api.patch<MemberSubscription>(`/subscriptions/${id}`, { status, end_date }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["subscriptions"] }),
  })
}
