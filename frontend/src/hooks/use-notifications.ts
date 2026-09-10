import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import { api } from "@/lib/api-client"
import type { Notification, Page } from "@/lib/types"

export function useNotifications(opts?: { live?: boolean; pageSize?: number }) {
  const pageSize = opts?.pageSize ?? 20
  return useQuery({
    queryKey: ["notifications", pageSize],
    queryFn: () => api.get<Page<Notification>>(`/notifications?page=1&page_size=${pageSize}`),
    refetchInterval: opts?.live ? 60_000 : false,
  })
}

export function useUnreadNotificationCount(opts?: { live?: boolean }) {
  return useQuery({
    queryKey: ["notifications", "unread-count"],
    queryFn: () => api.get<{ unread: number }>("/notifications/unread-count"),
    refetchInterval: opts?.live ? 60_000 : false,
  })
}

export function useMarkNotificationRead() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.post<void>(`/notifications/${id}/read`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["notifications"] }),
  })
}

export function useMarkAllNotificationsRead() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => api.post<void>("/notifications/read-all"),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["notifications"] }),
  })
}
