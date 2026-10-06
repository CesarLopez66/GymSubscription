"use client"

import * as React from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { z } from "zod"
import { toast } from "sonner"
import { Plus } from "lucide-react"

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
import type { UserRole } from "@/lib/types"
import { useCreateUser } from "@/hooks/use-users"
import { useAuthStore } from "@/store/auth-store"

const userSchema = z.object({
  first_name: z.string().min(1),
  last_name: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(8, "Debe tener al menos 8 caracteres"),
  roles: z.array(z.custom<UserRole>()).min(1, "Selecciona al menos un rol"),
  phone: z.string().optional(),
})

type UserFormValues = z.infer<typeof userSchema>

export function AddPersonDialog({ section }: { section: "staff" | "clients" }) {
  const [open, setOpen] = React.useState(false)
  const [branchId, setBranchId] = React.useState<string | undefined>(undefined)
  const createUser = useCreateUser()
  const viewerRoles = useAuthStore((s) => s.user?.roles ?? [])
  const staffRoles = React.useMemo(() => assignableStaffRoles(viewerRoles), [viewerRoles])

  const defaultValues = (): UserFormValues => ({
    first_name: "",
    last_name: "",
    email: "",
    password: "",
    roles: section === "clients" ? ["MEMBER"] : ["TRAINER"],
    phone: "",
  })

  const form = useForm<UserFormValues>({
    resolver: zodResolver(userSchema),
    defaultValues: defaultValues(),
  })

  const openDialog = () => {
    form.reset(defaultValues())
    setBranchId(undefined)
    setOpen(true)
  }

  const onSubmit = (values: UserFormValues) => {
    createUser.mutate(
      { ...values, branch_id: branchId },
      {
        onSuccess: () => {
          toast.success(`${values.first_name} ${values.last_name} agregado`)
          form.reset()
          setBranchId(undefined)
          setOpen(false)
        },
        onError: (error) => {
          toast.error(error instanceof ApiError ? error.detail : "No se pudo crear el usuario")
        },
      }
    )
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="sm" onClick={openDialog} />}>
        <Plus className="size-4" />
        Nueva persona
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{section === "clients" ? "Agregar cliente" : "Agregar personal"}</DialogTitle>
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
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Correo electrónico</FormLabel>
                  <FormControl>
                    <Input type="email" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Contraseña temporal</FormLabel>
                  <FormControl>
                    <Input type="password" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="phone"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Teléfono (opcional)</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            {section === "staff" && (
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
                                  next ? [...field.value, role] : field.value.filter((r) => r !== role)
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
            <BranchSelect value={branchId} onChange={setBranchId} />
            <DialogFooter>
              <Button type="submit" disabled={createUser.isPending}>
                {createUser.isPending ? "Agregando…" : "Agregar persona"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
