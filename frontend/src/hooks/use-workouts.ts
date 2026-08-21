import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import { api } from "@/lib/api-client"
import type { DayOfWeek, FitnessGoal, Page, WorkoutPlan } from "@/lib/types"

export interface WorkoutPlanItemInput {
  exercise_id: string
  day_of_week: DayOfWeek
  sets: number
  reps: number
  rpe?: number
  rest_seconds?: number
  order?: number
  notes?: string
}

export interface WorkoutPlanCreateInput {
  user_id: string
  name: string
  fitness_goal: FitnessGoal
  start_date: string
  end_date?: string
  is_active?: boolean
  items: WorkoutPlanItemInput[]
}

export function useWorkoutPlans(userId?: string, page = 1, pageSize = 20) {
  return useQuery({
    queryKey: ["workouts", userId, page, pageSize],
    queryFn: () => {
      const params = new URLSearchParams({ page: String(page), page_size: String(pageSize) })
      if (userId) params.set("user_id", userId)
      return api.get<Page<WorkoutPlan>>(`/workouts?${params.toString()}`)
    },
  })
}

export function useAssignWorkoutPlan() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: WorkoutPlanCreateInput) => api.post<WorkoutPlan>("/workouts/assign", input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["workouts"] }),
  })
}
