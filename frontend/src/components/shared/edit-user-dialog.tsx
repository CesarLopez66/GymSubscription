"use client"

import * as React from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { z } from "zod"
import { toast } from "sonner"
import { Pencil } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { BranchSelect } from "@/components/shared/branch-select"
import { ApiError } from "@/lib/api-client"
import { ROLE_LABELS } from "@/lib/labels"
import { assignableStaffRoles } from "@/lib/role-permissions"
import type { User, UserRole } from "@/lib/types"
import { useUpdateUser } from "@/hooks/use-users"
import { useAuthStore } from "@/store/auth-store"

// These roles are meaningless without a branch — the backend 403s a
// scoped actor with none and simply can't route a branch-less person's
// data anywhere, so the form requires it up front instead of failing later.
const BRANCH_REQUIRING_ROLES: UserRole[] = ["BRANCH_MANAGER", "TRAINER", "NUTRITIONIST"]

export function EditUserDialog({ user }: { user: User }) {
  const [open, setOpen] = React.useState(false)
  const updateUser = useUpdateUser()
  const viewerRoles = useAuthStore((s) => s.user?.roles ?? [])
  // Reassigning someone's branch is an org-level decision — stays
  // admin-only even for a manager who can otherwise edit their own staff.
  const canReassignBranch = viewerRoles.includes("GYM_ADMIN")
  const staffRoles = React.useMemo(() => assignableStaffRoles(viewerRoles), [viewerRoles])
  // A client (MEMBER) never has their role edited from here — only staff
  // roles can combine and change over time.
  const isStaff = !user.roles.includes("MEMBER")

  const editSchema = React.useMemo(
    () =>
      z
        .object({
          first_name: z.string().min(1, "Requerido"),
          last_name: z.string().min(1, "Requerido"),
          phone: z.string().optional(),
          roles: z.array(z.custom<UserRole>()).min(1, "Selecciona al menos un rol"),
          branch_id: z.string().optional(),
        })
        .refine(
          (values) =>
            !values.roles.some((r) => BRANCH_REQUIRING_ROLES.includes(r)) || !!values.branch_id,
          { message: "Este rol requiere una sucursal asignada", path: ["branch_id"] }
        ),
    []
  )

  type EditValues = z.infer<typeof editSchema>

  const defaultValues = React.useMemo<EditValues>(
    () => ({
      first_name: user.first_name,
      last_name: user.last_name,
      phone: user.phone ?? "",
      roles: user.roles,
      branch_id: user.branch_id ?? undefined,
    }),
    [user]
  )

  const form = useForm<EditValues>({
    resolver: zodResolver(editSchema),
    defaultValues,
  })

  const onSubmit = (values: EditValues) => {
    const { roles, branch_id, ...rest } = values
    updateUser.mutate(
      {
        id: user.id,
        input: isStaff
          ? { ...rest, roles, ...(canReassignBranch ? { branch_id: branch_id ?? null } : {}) }
          : rest,
      },
      {
        onSuccess: () => {
          toast.success("Datos actualizados")
          setOpen(false)
        },
        onError: (error) =>
          toast.error(error instanceof ApiError ? error.detail : "No se pudo actualizar"),
      }
    )
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v)
        if (v) form.reset(defaultValues)
      }}
    >
      <DialogTrigger render={<Button variant="ghost" size="sm" />}>
        <Pencil className="size-3.5" />
        Editar
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Editar persona</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4">
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="first_name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nombre</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="last_name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Apellido</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <FormField
              control={form.control}
              name="phone"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Teléfono</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            {isStaff && (
              <FormField
                control={form.control}
                name="roles"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Roles</FormLabel>
                    <div className="flex flex-col gap-2">
                      {staffRoles.map((role) => {
                        const checked = field.value.includes(role)
                        return (
                          <label key={role} className="flex items-center gap-2 text-sm font-normal">
                            <Checkbox
                              checked={checked}
                              onCheckedChange={(next) => {
                                field.onChange(
                                  next
                                    ? [...field.value, role]
                                    : field.value.filter((r) => r !== role)
                                )
                              }}
                            />
                            {ROLE_LABELS[role]}
                          </label>
                        )
                      })}
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}
            {isStaff && canReassignBranch && (
              <FormField
                control={form.control}
                name="branch_id"
                render={({ field }) => (
                  <FormItem>
                    <BranchSelect value={field.value} onChange={field.onChange} label="Sucursal" />
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}
            <DialogFooter>
              <Button type="submit" disabled={updateUser.isPending}>
                {updateUser.isPending ? "Guardando…" : "Guardar cambios"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
