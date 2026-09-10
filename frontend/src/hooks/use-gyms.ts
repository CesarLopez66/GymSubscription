import { keepPreviousData, queryOptions, useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import { api } from "@/lib/api-client"
import type { Gym, GymStatus, Page, SaaSPlanTier } from "@/lib/types"

export interface GymCreateInput {
  name: string
  subdomain: string
  contact_email: string
  contact_phone?: string
  address?: string
  plan_tier: SaaSPlanTier
}

export interface GymUpdateInput {
  name?: string
  status?: GymStatus
  plan_tier?: SaaSPlanTier
  contact_email?: string
  contact_phone?: string
  address?: string
}

export function gymsQueryOptions(
  page = 1,
  pageSize = 20,
  filters?: { search?: string; status?: GymStatus }
) {
  const search = filters?.search
  const status = filters?.status
  return queryOptions({
    queryKey: ["gyms", page, pageSize, search, status] as const,
    queryFn: () => {
      const params = new URLSearchParams({ page: String(page), page_size: String(pageSize) })
      if (search) params.set("search", search)
      if (status) params.set("status", status)
      return api.get<Page<Gym>>(`/gyms?${params.toString()}`)
    },
    placeholderData: keepPreviousData,
    staleTime: 20_000,
    // Paired with a full-screen "Actualizando…" overlay on isFetching (see
    // LoadingOverlay) on every screen that reads this — fine for a real
    // filter change, not for a tab merely regaining focus once staleTime
    // has elapsed.
    refetchOnWindowFocus: false,
  })
}

export function useGyms(
  page = 1,
  pageSize = 20,
  filters?: { search?: string; status?: GymStatus }
) {
  return useQuery(gymsQueryOptions(page, pageSize, filters))
}

export interface PublicGym {
  name: string
  subdomain: string
}

// Unauthenticated — powers the login screen's gym picker (GET /gyms/public
// only ever returns name + subdomain, never anything else on Gym).
export function usePublicGyms() {
  return useQuery({
    queryKey: ["gyms", "public"],
    queryFn: () => api.get<PublicGym[]>("/gyms/public"),
    staleTime: 5 * 60 * 1000,
  })
}

export function useCreateGym() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: GymCreateInput) => api.post<Gym>("/gyms", input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["gyms"] }),
  })
}

export function useUpdateGym() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: GymUpdateInput }) =>
      api.patch<Gym>(`/gyms/${id}`, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["gyms"] }),
  })
}

export function useSuspendGym() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      api.post<Gym>(`/gyms/${id}/suspend`, { reason }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["gyms"] })
      queryClient.invalidateQueries({ queryKey: ["gyms", "audit-log"] })
    },
  })
}

export function useReactivateGym() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.post<Gym>(`/gyms/${id}/reactivate`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["gyms"] })
      queryClient.invalidateQueries({ queryKey: ["gyms", "audit-log"] })
    },
  })
}

export interface GymAuditLogEntry {
  id: string
  actor_id: string | null
  action: string
  reason: string | null
  created_at: string
}

export function useGymAuditLog(gymId: string) {
  return useQuery({
    queryKey: ["gyms", "audit-log", gymId],
    queryFn: () => api.get<Page<GymAuditLogEntry>>(`/gyms/${gymId}/audit-log?page=1&page_size=50`),
    enabled: !!gymId,
  })
}

export function useMyGym() {
  return useQuery({
    queryKey: ["gyms", "me"],
    queryFn: () => api.get<Gym>("/gyms/me"),
    // Config del propio gym (nombre, branding, QR de pago): la cambia un
    // admin de vez en cuando, no vale la pena refetchear en cada navegación.
    staleTime: 5 * 60 * 1000,
  })
}

export function useUpdatePaymentQr() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (payment_qr_image: string | null) =>
      api.patch<Gym>("/gyms/me/payment-qr", { payment_qr_image }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["gyms", "me"] }),
  })
}

export interface GymCheckinQr {
  checkin_qr_token: string
}

export function useCheckinQr() {
  return useQuery({
    queryKey: ["gyms", "me", "checkin-qr"],
    queryFn: () => api.get<GymCheckinQr>("/gyms/me/checkin-qr"),
  })
}

export function useRegenerateCheckinQr() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => api.post<GymCheckinQr>("/gyms/me/checkin-qr/regenerate"),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["gyms", "me", "checkin-qr"] }),
  })
}
