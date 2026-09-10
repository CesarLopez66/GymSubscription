import { queryOptions, useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import { api } from "@/lib/api-client"
import type { Branch, Page } from "@/lib/types"

export interface BranchCreateInput {
  name: string
  address?: string
  phone?: string
}

export interface BranchUpdateInput {
  name?: string
  address?: string
  phone?: string
  is_active?: boolean
}

export function branchesQueryOptions(page = 1, pageSize = 100) {
  return queryOptions({
    queryKey: ["branches", page, pageSize] as const,
    queryFn: () => api.get<Page<Branch>>(`/branches?page=${page}&page_size=${pageSize}`),
    // Sucursales cambian casi nunca — más margen que el default global evita
    // un refetch (y su spinner) cada vez que se revisita esta pantalla.
    staleTime: 5 * 60 * 1000,
  })
}

export function useBranches(page = 1, pageSize = 100) {
  return useQuery(branchesQueryOptions(page, pageSize))
}

export function useCreateBranch() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: BranchCreateInput) => api.post<Branch>("/branches", input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["branches"] }),
  })
}

export function useUpdateBranch() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: BranchUpdateInput }) =>
      api.patch<Branch>(`/branches/${id}`, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["branches"] }),
  })
}

export function useDeleteBranch() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.delete<void>(`/branches/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["branches"] }),
  })
}

export interface BranchCheckinQr {
  checkin_qr_token: string
}

export function useBranchCheckinQr(branchId: string) {
  return useQuery({
    queryKey: ["branches", branchId, "checkin-qr"],
    queryFn: () => api.get<BranchCheckinQr>(`/branches/${branchId}/checkin-qr`),
    enabled: !!branchId,
  })
}

export function useRegenerateBranchCheckinQr() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (branchId: string) =>
      api.post<BranchCheckinQr>(`/branches/${branchId}/checkin-qr/regenerate`),
    onSuccess: (_data, branchId) =>
      queryClient.invalidateQueries({ queryKey: ["branches", branchId, "checkin-qr"] }),
  })
}
