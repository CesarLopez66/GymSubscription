import { queryOptions, useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import { api } from "@/lib/api-client"
import type { DiscountType, Page, Promotion } from "@/lib/types"

export interface PromotionInput {
  name: string
  description?: string
  membership_id?: string | null
  discount_type: DiscountType
  discount_value: number
  start_date: string
  end_date: string
  is_active?: boolean
}

export function promotionsQueryOptions(page = 1, pageSize = 50) {
  return queryOptions({
    queryKey: ["promotions", page, pageSize] as const,
    queryFn: () => api.get<Page<Promotion>>(`/promotions?page=${page}&page_size=${pageSize}`),
    staleTime: 2 * 60 * 1000,
  })
}

export function usePromotions(page = 1, pageSize = 50) {
  return useQuery(promotionsQueryOptions(page, pageSize))
}

export function useCreatePromotion() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: PromotionInput) => api.post<Promotion>("/promotions", input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["promotions"] }),
  })
}

export function useUpdatePromotion() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: Partial<PromotionInput> }) =>
      api.patch<Promotion>(`/promotions/${id}`, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["promotions"] }),
  })
}
