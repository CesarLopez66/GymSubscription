import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import { api } from "@/lib/api-client"
import type {
  ActivityLevel,
  FitnessGoal,
  NutritionPlan,
  Page,
  PhysicalEvaluation,
  WorkoutPlan,
} from "@/lib/types"

export interface EvaluationCreateInput {
  user_id: string
  branch_id?: string
  weight_kg: number
  height_cm: number
  age: number
  body_fat_percentage?: number
  fitness_goal: FitnessGoal
  activity_level: ActivityLevel
  notes?: string
}

export interface EvaluationCreateResult extends PhysicalEvaluation {
  generated_workout_plan: WorkoutPlan
  generated_nutrition_plan: NutritionPlan
}

export function useEvaluations(userId?: string, page = 1, pageSize = 20, branchId?: string) {
  return useQuery({
    queryKey: ["evaluations", userId, page, pageSize, branchId],
    queryFn: () => {
      const params = new URLSearchParams({ page: String(page), page_size: String(pageSize) })
      if (userId) params.set("user_id", userId)
      if (branchId) params.set("branch_id", branchId)
      return api.get<Page<PhysicalEvaluation>>(`/evaluations?${params.toString()}`)
    },
  })
}

export function useCreateEvaluation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: EvaluationCreateInput) =>
      api.post<EvaluationCreateResult>("/evaluations", input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["evaluations"] })
      // A workout routine and a nutrition plan are generated/progressed as a
      // side effect of every evaluation — keep both tabs in sync without a
      // manual refresh.
      queryClient.invalidateQueries({ queryKey: ["workouts"] })
      queryClient.invalidateQueries({ queryKey: ["nutrition"] })
    },
  })
}
