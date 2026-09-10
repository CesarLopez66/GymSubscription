import { queryOptions, useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import { api } from "@/lib/api-client"
import type { Page, Payment, PaymentMethod, PaymentStatus, PaymentType } from "@/lib/types"

export interface PaymentCreateInput {
  user_id?: string
  subscription_id?: string
  membership_id?: string
  branch_id?: string
  payment_type: PaymentType
  payment_method: PaymentMethod
  amount: number
  currency?: string
  description?: string
  reference?: string
}

export function paymentsQueryOptions(userId?: string, page = 1, pageSize = 20, branchId?: string) {
  return queryOptions({
    queryKey: ["payments", userId, page, pageSize, branchId] as const,
    queryFn: () => {
      const params = new URLSearchParams({ page: String(page), page_size: String(pageSize) })
      if (userId) params.set("user_id", userId)
      if (branchId) params.set("branch_id", branchId)
      return api.get<Page<Payment>>(`/payments?${params.toString()}`)
    },
  })
}

export function usePayments(userId?: string, page = 1, pageSize = 20, branchId?: string) {
  return useQuery(paymentsQueryOptions(userId, page, pageSize, branchId))
}

export function useRevenueSummary() {
  return useQuery({
    queryKey: ["payments", "revenue-summary"],
    queryFn: () => api.get<{ total_revenue: number }>("/payments/revenue-summary"),
  })
}

export interface DailyRevenue {
  date: string
  total: number
}

export function useDailyRevenue(days = 30) {
  return useQuery({
    queryKey: ["payments", "revenue-daily", days],
    queryFn: () => api.get<DailyRevenue[]>(`/payments/revenue-daily?days=${days}`),
  })
}

export interface PaymentSelfCreateInput {
  membership_id: string
  payment_method?: PaymentMethod
  reference?: string
  proof_image: string
}

export function useSubmitPaymentClaim() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: PaymentSelfCreateInput) => api.post<Payment>("/payments/self", input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["payments"] }),
  })
}

export function useApprovePayment() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.post<Payment>(`/payments/${id}/approve`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["payments"] })
      queryClient.invalidateQueries({ queryKey: ["subscriptions"] })
    },
  })
}

export function useRejectPayment() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      api.post<Payment>(`/payments/${id}/reject`, { reason }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["payments"] }),
  })
}

export function useCreatePayment() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: PaymentCreateInput) => api.post<Payment>("/payments", input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["payments"] }),
  })
}

export function useUpdatePaymentStatus() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: PaymentStatus }) =>
      api.patch<Payment>(`/payments/${id}`, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["payments"] })
    },
  })
}
