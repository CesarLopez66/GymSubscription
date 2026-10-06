import { create } from "zustand"

interface BranchFilterState {
  /** undefined = "todas las sucursales" (sin filtro). In-memory only — no
   * need to survive a refresh, unlike auth. */
  branchId: string | undefined
  setBranchId: (branchId: string | undefined) => void
}

export const useBranchFilterStore = create<BranchFilterState>()((set) => ({
  branchId: undefined,
  setBranchId: (branchId) => set({ branchId }),
}))
