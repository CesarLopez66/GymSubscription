import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import { api } from "@/lib/api-client"
import type { NutritionPlan, Page } from "@/lib/types"

export function useNutritionPlans(userId?: string, page = 1, pageSize = 20) {
  return useQuery({
    queryKey: ["nutrition", userId, page, pageSize],
    queryFn: () => {
      const params = new URLSearchParams({ page: String(page), page_size: String(pageSize) })
      if (userId) params.set("user_id", userId)
      return api.get<Page<NutritionPlan>>(`/nutrition?${params.toString()}`)
    },
  })
}

export interface NutritionPlanUpdateInput {
  calories?: number
  protein_g?: number
  carbs_g?: number
  fats_g?: number
  water_ml?: number
  is_active?: boolean
}

export function useUpdateNutritionPlan() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: NutritionPlanUpdateInput }) =>
      api.patch<NutritionPlan>(`/nutrition/${id}`, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["nutrition"] }),
  })
}

export interface NutritionLog {
  log_date: string
  protein_g: number
  carbs_g: number
  fats_g: number
}

export function useNutritionLog(date: string) {
  return useQuery({
    queryKey: ["nutrition", "log", date],
    queryFn: () => api.get<NutritionLog | null>(`/nutrition/log?target_date=${date}`),
  })
}

export function useUpsertNutritionLog() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: { protein_g: number; carbs_g: number; fats_g: number; log_date: string }) =>
      api.put<NutritionLog>("/nutrition/log", input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["nutrition", "log"] }),
  })
}
