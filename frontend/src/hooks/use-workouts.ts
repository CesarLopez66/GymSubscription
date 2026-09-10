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

export function useReplaceWorkoutPlanItems() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, items }: { id: string; items: WorkoutPlanItemInput[] }) =>
      api.put<WorkoutPlan>(`/workouts/${id}/items`, items),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["workouts"] }),
  })
}

export function useUpdateWorkoutPlan() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, is_active }: { id: string; is_active: boolean }) =>
      api.patch<WorkoutPlan>(`/workouts/${id}`, { is_active }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["workouts"] }),
  })
}

export function useCompletionsForDate(date: string) {
  return useQuery({
    queryKey: ["workouts", "completions", date],
    queryFn: () => api.get<string[]>(`/workouts/completions?target_date=${date}`),
  })
}

export function useSetItemCompletion() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ itemId, completed, date }: { itemId: string; completed: boolean; date: string }) =>
      api.put<void>(`/workouts/items/${itemId}/completion`, { completed, target_date: date }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["workouts", "completions"] }),
  })
}

export interface WorkoutAdherence {
  active_days: number
  period_days: number
}

export function useWorkoutAdherence(userId: string, days = 7) {
  return useQuery({
    queryKey: ["workouts", "adherence", userId, days],
    queryFn: () => api.get<WorkoutAdherence>(`/workouts/adherence/${userId}?days=${days}`),
    enabled: !!userId,
  })
}
