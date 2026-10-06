import { queryOptions, useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import { api } from "@/lib/api-client"
import type { CheckIn, Page } from "@/lib/types"

export function checkInsQueryOptions(userId?: string, pageSize = 25, branchId?: string) {
  return queryOptions({
    queryKey: ["check-ins", userId, pageSize, branchId] as const,
    queryFn: () => {
      const params = new URLSearchParams({ page: "1", page_size: String(pageSize) })
      if (userId) params.set("user_id", userId)
      if (branchId) params.set("branch_id", branchId)
      return api.get<Page<CheckIn>>(`/check-in?${params.toString()}`)
    },
  })
}

export function useCheckIns(
  userId?: string,
  opts?: { live?: boolean; pageSize?: number; branchId?: string }
) {
  return useQuery({
    ...checkInsQueryOptions(userId, opts?.pageSize ?? 25, opts?.branchId),
    refetchInterval: opts?.live ? 5_000 : false,
  })
}

export function useVerifyCheckIn() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (userId: string) => api.post<CheckIn>("/check-in/verify", { user_id: userId }),
    // Optimistically drop a "pending" row in so the front-desk monitor feels
    // instant; it's reconciled with the real row once the response lands.
    onMutate: async (userId: string) => {
      await queryClient.cancelQueries({ queryKey: ["check-ins"] })
      const previous = queryClient.getQueriesData<Page<CheckIn>>({ queryKey: ["check-ins"] })

      queryClient.setQueriesData<Page<CheckIn>>({ queryKey: ["check-ins"] }, (old) => {
        if (!old) return old
        const optimistic: CheckIn = {
          id: `optimistic-${Date.now()}`,
          gym_id: "",
          user_id: userId,
          branch_id: null,
          timestamp: new Date().toISOString(),
          access_granted: true,
          denial_reason: null,
        }
        return { ...old, items: [optimistic, ...old.items], total: old.total + 1 }
      })

      return { previous }
    },
    onError: (_err, _userId, context) => {
      context?.previous?.forEach(([key, data]) => {
        queryClient.setQueryData(key, data)
      })
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["check-ins"] })
    },
  })
}

export function useSelfCheckIn() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (qrToken: string) => api.post<CheckIn>("/check-in/self", { qr_token: qrToken }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["check-ins"] }),
  })
}
