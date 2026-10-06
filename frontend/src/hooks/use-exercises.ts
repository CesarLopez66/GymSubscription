import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import { api } from "@/lib/api-client"
import type { Exercise, Page } from "@/lib/types"

export function useExercises(page = 1, pageSize = 100) {
  return useQuery({
    queryKey: ["exercises", page, pageSize],
    queryFn: () => api.get<Page<Exercise>>(`/exercises?page=${page}&page_size=${pageSize}`),
    // Catálogo de ejercicios: cambia rara vez, así que no vale la pena
    // refetchear cada 30s por defecto.
    staleTime: 5 * 60 * 1000,
  })
}

export interface ExerciseInput {
  name: string
  description?: string
  muscle_group: string
  equipment?: string
  video_url?: string
}

export function useCreateExercise() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: ExerciseInput) => api.post<Exercise>("/exercises", input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["exercises"] }),
  })
}

export function useUpdateExercise() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: Partial<ExerciseInput> }) =>
      api.patch<Exercise>(`/exercises/${id}`, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["exercises"] }),
  })
}

export function useDeleteExercise() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.delete<void>(`/exercises/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["exercises"] }),
  })
}
