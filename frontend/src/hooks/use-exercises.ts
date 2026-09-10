import { useQuery } from "@tanstack/react-query"

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
