"use client"

import { toast } from "sonner"
import { RotateCcw, UserX } from "lucide-react"

import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { EditUserDialog } from "@/components/shared/edit-user-dialog"
import { EntityCard } from "@/components/shared/entity-card"
import { initialsOf } from "@/components/shared/member-picker"
import { SubscriptionDialog } from "@/components/shared/subscription-dialog"
import { ApiError } from "@/lib/api-client"
import { activeBadgeClass } from "@/lib/badge-colors"
import { ROLE_LABELS } from "@/lib/labels"
import type { User } from "@/lib/types"
import { useDeactivateUser, useUpdateUser } from "@/hooks/use-users"
import { useAuthStore } from "@/store/auth-store"

export function PersonCard({ user: u, section }: { user: User; section: "staff" | "clients" }) {
  const currentUser = useAuthStore((s) => s.user)
  const deactivateUser = useDeactivateUser()
  const updateUser = useUpdateUser()

  const handleReactivate = () => {
    updateUser.mutate(
      { id: u.id, input: { is_active: true } },
      {
        onSuccess: () => toast.success(`${u.first_name} ${u.last_name} reactivado`),
        onError: (error) => toast.error(error instanceof ApiError ? error.detail : "No se pudo reactivar"),
      }
    )
  }

  return (
    <EntityCard>
      <div className="flex items-center gap-3">
        <Avatar size="lg" className="shrink-0">
          <AvatarFallback className="bg-primary/10 font-medium text-primary">
            {initialsOf(u)}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold leading-tight">
            {u.first_name} {u.last_name}
          </p>
          <p className="truncate text-xs text-muted-foreground">{u.email}</p>
        </div>
        <Badge className={activeBadgeClass(u.is_active)}>{u.is_active ? "Activo" : "Inactivo"}</Badge>
      </div>

      {section === "staff" && (
        <div className="flex flex-wrap gap-1">
          {u.roles.map((r) => (
            <Badge key={r} variant="outline">
              {ROLE_LABELS[r]}
            </Badge>
          ))}
        </div>
      )}

      <div className="flex items-center justify-between gap-2 border-t pt-3">
        <span className="text-xs text-muted-foreground">{u.phone ?? "Sin teléfono"}</span>
        <div className="flex items-center gap-1">
          {section === "clients" && (
            <SubscriptionDialog userId={u.id} memberName={`${u.first_name} ${u.last_name}`} />
          )}
          <EditUserDialog user={u} />
          {u.is_active ? (
            <Button
              variant="ghost"
              size="sm"
              disabled={deactivateUser.isPending || u.id === currentUser?.id}
              title={u.id === currentUser?.id ? "No puedes desactivar tu propia cuenta" : "Desactivar"}
              onClick={() =>
                deactivateUser.mutate(u.id, {
                  onError: (error) =>
                    toast.error(error instanceof ApiError ? error.detail : "La acción falló"),
                })
              }
            >
              <UserX className="size-3.5" />
            </Button>
          ) : (
            <Button
              variant="ghost"
              size="sm"
              title="Reactivar"
              disabled={updateUser.isPending}
              onClick={handleReactivate}
            >
              <RotateCcw className="size-3.5" />
            </Button>
          )}
        </div>
      </div>
    </EntityCard>
  )
}
