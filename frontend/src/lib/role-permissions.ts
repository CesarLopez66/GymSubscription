import type { UserRole } from "@/lib/types"

// Mirrors the backend's ROLE_ASSIGNABLE_BY (app/api/v1/endpoints/users.py):
// which staff roles the viewer may grant/revoke on someone else, or browse
// their people list by. A GYM_ADMIN can touch any staff role including
// BRANCH_MANAGER itself; a BRANCH_MANAGER can only manage their own
// TRAINER/NUTRITIONIST staff — never mint another manager or an admin.
export function assignableStaffRoles(viewerRoles: UserRole[]): UserRole[] {
  if (viewerRoles.includes("GYM_ADMIN")) {
    return ["GYM_ADMIN", "BRANCH_MANAGER", "TRAINER", "NUTRITIONIST"]
  }
  if (viewerRoles.includes("BRANCH_MANAGER")) {
    return ["TRAINER", "NUTRITIONIST"]
  }
  return []
}
