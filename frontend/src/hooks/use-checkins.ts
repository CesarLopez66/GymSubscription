import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import { api } from "@/lib/api-client"
import type { CheckIn, Page } from "@/lib/types"

export function useCheckIns(userId?: string, opts?: { live?: boolean }) {
  return useQuery({
    queryKey: ["check-ins", userId],
    queryFn: () => {
      const params = new URLSearchParams({ page: "1", page_size: "25" })
      if (userId) params.set("user_id", userId)
      return api.get<Page<CheckIn>>(`/check-in?${params.toString()}`)
    },
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
