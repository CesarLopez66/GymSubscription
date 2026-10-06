import { keepPreviousData, queryOptions, useMutation, useQuery } from "@tanstack/react-query"

import { api } from "@/lib/api-client"
import type { GymDetail, Page, PlatformOverview, User, UserRole } from "@/lib/types"

export function superAdminOverviewQueryOptions(
  days = 30,
  gymId: string | null = null,
  paymentsDate: string | null = null
) {
  return queryOptions({
    queryKey: ["superadmin", "overview", days, gymId, paymentsDate] as const,
    queryFn: () => {
      const params = new URLSearchParams({ days: String(days) })
      if (gymId) params.set("gym_id", gymId)
      if (paymentsDate) params.set("payments_date", paymentsDate)
      return api.get<PlatformOverview>(`/superadmin/overview?${params.toString()}`)
    },
    // Switching the range/gym filter shouldn't flash every card and chart
    // to empty while the new period loads — keep showing the previous
    // period's numbers until the new ones are in.
    placeholderData: keepPreviousData,
    // The superadmin home screen re-mounts this same query (same
    // days/gym/date) on every navigation back to it — without a staleTime
    // that re-triggers the ~12-query overview endpoint even though nothing
    // changed. 20s keeps the platform's own numbers fresh enough while
    // avoiding that redundant round trip.
    staleTime: 20_000,
    // Every screen that reads this query also pops a full-screen
    // "Actualizando…" overlay while it's fetching (see LoadingOverlay) — the
    // right call for a deliberate filter change, but not for a tab regaining
    // focus. Without this, alt-tabbing back once the 20s staleTime has
    // elapsed silently reruns the ~12-query endpoint and blurs the whole
    // screen for something the user didn't do.
    refetchOnWindowFocus: false,
  })
}

export function useSuperAdminOverview(
  days = 30,
  gymId: string | null = null,
  paymentsDate: string | null = null
) {
  return useQuery(superAdminOverviewQueryOptions(days, gymId, paymentsDate))
}

export function useSuperAdminGymDetail(gymId: string) {
  return useQuery({
    queryKey: ["superadmin", "gyms", gymId],
    queryFn: () => api.get<GymDetail>(`/superadmin/gyms/${gymId}`),
    enabled: !!gymId,
  })
}

export function useGymUsers(gymId: string, role?: UserRole, page = 1, pageSize = 20) {
  return useQuery({
    queryKey: ["superadmin", "gyms", gymId, "users", role, page, pageSize],
    queryFn: () => {
      const params = new URLSearchParams({ page: String(page), page_size: String(pageSize) })
      if (role) params.set("role", role)
      return api.get<Page<User>>(`/superadmin/gyms/${gymId}/users?${params.toString()}`)
    },
    enabled: !!gymId,
  })
}

export interface ImpersonationResult {
  access_token: string
  token_type: string
  user: User
}

export function useImpersonate() {
  return useMutation({
    mutationFn: (userId: string) =>
      api.post<ImpersonationResult>(`/superadmin/impersonate/${userId}`),
  })
}
