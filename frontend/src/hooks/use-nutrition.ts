import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import { api } from "@/lib/api-client"
import type {
  ActivityLevel,
  FitnessGoal,
  NutritionPlan,
  NutritionPlanGenerateResponse,
  Page,
} from "@/lib/types"

export interface NutritionGenerateInput {
  user_id: string
  weight_kg: number
  height_cm: number
  age: number
  activity_level: ActivityLevel
  fitness_goal: FitnessGoal
  body_fat_percentage?: number
  notes?: string
}

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

export function useGenerateNutritionPlan() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: NutritionGenerateInput) =>
      api.post<NutritionPlanGenerateResponse>("/nutrition/generate", input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["nutrition"] }),
  })
}
