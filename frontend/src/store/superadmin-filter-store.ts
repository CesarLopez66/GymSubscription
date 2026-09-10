import { create } from "zustand"

// Shared across every /superadmin screen so picking a gym on one tab keeps
// it selected when navigating to another — "null" means "todos los
// gimnasios" (the platform-wide aggregate).
interface SuperAdminFilterState {
  gymId: string | null
  setGymId: (gymId: string | null) => void
}

export const useSuperAdminFilterStore = create<SuperAdminFilterState>((set) => ({
  gymId: null,
  setGymId: (gymId) => set({ gymId }),
}))
