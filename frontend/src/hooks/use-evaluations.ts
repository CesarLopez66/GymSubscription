import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import { api } from "@/lib/api-client"
import type { ActivityLevel, FitnessGoal, Page, PhysicalEvaluation } from "@/lib/types"

export interface EvaluationCreateInput {
  user_id: string
  weight_kg: number
  height_cm: number
  body_fat_percentage?: number
  fitness_goal: FitnessGoal
  activity_level: ActivityLevel
  notes?: string
}

export function useEvaluations(userId?: string, page = 1, pageSize = 20) {
  return useQuery({
    queryKey: ["evaluations", userId, page, pageSize],
    queryFn: () => {
      const params = new URLSearchParams({ page: String(page), page_size: String(pageSize) })
      if (userId) params.set("user_id", userId)
      return api.get<Page<PhysicalEvaluation>>(`/evaluations?${params.toString()}`)
    },
  })
}

export function useCreateEvaluation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: EvaluationCreateInput) =>
      api.post<PhysicalEvaluation>("/evaluations", input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["evaluations"] }),
  })
}
