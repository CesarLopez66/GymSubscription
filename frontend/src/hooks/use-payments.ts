import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import { api } from "@/lib/api-client"
import type { Page, Payment, PaymentMethod, PaymentType } from "@/lib/types"

export interface PaymentCreateInput {
  user_id?: string
  subscription_id?: string
  payment_type: PaymentType
  payment_method: PaymentMethod
  amount: number
  currency?: string
  description?: string
  reference?: string
}

export function usePayments(userId?: string, page = 1, pageSize = 20) {
  return useQuery({
    queryKey: ["payments", userId, page, pageSize],
    queryFn: () => {
      const params = new URLSearchParams({ page: String(page), page_size: String(pageSize) })
      if (userId) params.set("user_id", userId)
      return api.get<Page<Payment>>(`/payments?${params.toString()}`)
    },
  })
}

export function useRevenueSummary() {
  return useQuery({
    queryKey: ["payments", "revenue-summary"],
    queryFn: () => api.get<{ total_revenue: number }>("/payments/revenue-summary"),
  })
}

export function useCreatePayment() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: PaymentCreateInput) => api.post<Payment>("/payments", input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["payments"] }),
  })
}
