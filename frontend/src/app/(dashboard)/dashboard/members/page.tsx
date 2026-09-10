"use client"

import * as React from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { z } from "zod"
import { toast } from "sonner"
import { Plus, RotateCcw, UserX } from "lucide-react"

import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
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
import { Skeleton } from "@/components/ui/skeleton"
import {
  Tabs,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs"

import { BranchSelect } from "@/components/shared/branch-select"
import { EditUserDialog } from "@/components/shared/edit-user-dialog"
import { EntityCard } from "@/components/shared/entity-card"
import { initialsOf } from "@/components/shared/member-picker"
import { FadeIn, StaggerGroup, StaggerItem } from "@/components/shared/motion"
import { SubscriptionDialog } from "@/components/shared/subscription-dialog"
import { ApiError } from "@/lib/api-client"
import { activeBadgeClass } from "@/lib/badge-colors"
import { ROLE_LABELS } from "@/lib/labels"
import type { UserRole } from "@/lib/types"
import { useCreateUser, useDeactivateUser, useUpdateUser, useUsers } from "@/hooks/use-users"
import { useAuthStore } from "@/store/auth-store"

const STAFF_ROLES: UserRole[] = ["GYM_ADMIN", "TRAINER", "NUTRITIONIST"]
const ALL_ROLES: UserRole[] = ["GYM_ADMIN", "TRAINER", "NUTRITIONIST", "MEMBER"]

const userSchema = z.object({
  first_name: z.string().min(1),
  last_name: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(8, "Debe tener al menos 8 caracteres"),
  roles: z.array(z.enum(ALL_ROLES)).min(1, "Selecciona al menos un rol"),
  phone: z.string().optional(),
})

type UserFormValues = z.infer<typeof userSchema>

export default function MembersPage() {
  const [section, setSection] = React.useState<"staff" | "clients">("staff")
  const [staffRoleFilter, setStaffRoleFilter] = React.useState<UserRole>("TRAINER")
  const roleFilter = section === "clients" ? "MEMBER" : staffRoleFilter
  const [open, setOpen] = React.useState(false)
  const [branchId, setBranchId] = React.useState<string | undefined>(undefined)
  const currentUser = useAuthStore((s) => s.user)
  const { data, isLoading } = useUsers(roleFilter, 1, 100)
  const createUser = useCreateUser()
  const deactivateUser = useDeactivateUser()
  const updateUser = useUpdateUser()

  const form = useForm<UserFormValues>({
    resolver: zodResolver(userSchema),
    defaultValues: {
      first_name: "",
      last_name: "",
      email: "",
      password: "",
      roles: section === "clients" ? ["MEMBER"] : ["TRAINER"],
      phone: "",
    },
  })

  const openDialog = () => {
    form.reset({
      first_name: "",
      last_name: "",
      email: "",
      password: "",
      roles: section === "clients" ? ["MEMBER"] : ["TRAINER"],
      phone: "",
    })
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

  const handleReactivate = (userId: string, name: string) => {
    updateUser.mutate(
      { id: userId, input: { is_active: true } },
      {
        onSuccess: () => toast.success(`${name} reactivado`),
        onError: (error) =>
          toast.error(error instanceof ApiError ? error.detail : "No se pudo reactivar"),
      }
    )
  }

  const users = data?.items ?? []

  return (
    <div className="space-y-6">
      <FadeIn className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Personas</h1>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger render={<Button size="sm" onClick={openDialog} />}>
            <Plus className="size-4" />
            Nueva persona
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {section === "clients" ? "Agregar cliente" : "Agregar personal"}
              </DialogTitle>
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
                          {STAFF_ROLES.map((role) => {
                            const checked = field.value.includes(role)
                            return (
                              <label
                                key={role}
                                className="flex items-center gap-2 text-sm font-normal"
                              >
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
      </FadeIn>

      <FadeIn delay={0.05} className="space-y-3">
        <Tabs
          value={section}
          onValueChange={(v) => setSection(v as "staff" | "clients")}
        >
          <TabsList>
            <TabsTrigger value="staff">Personal</TabsTrigger>
            <TabsTrigger value="clients">Clientes</TabsTrigger>
          </TabsList>
        </Tabs>
        {section === "staff" && (
          <Tabs
            value={staffRoleFilter}
            onValueChange={(v) => setStaffRoleFilter(v as UserRole)}
          >
            <TabsList>
              {STAFF_ROLES.map((role) => (
                <TabsTrigger key={role} value={role}>
                  {ROLE_LABELS[role]}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        )}
      </FadeIn>

      <FadeIn delay={0.1}>
        <Card>
          <CardHeader>
            <CardTitle>
              {section === "clients" ? "Clientes" : ROLE_LABELS[staffRoleFilter]}{" "}
              <span className="text-muted-foreground">({data?.total ?? 0})</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {Array.from({ length: 6 }).map((_, i) => (
                  <Skeleton key={i} className="h-28 w-full" />
                ))}
              </div>
            ) : (
              <StaggerGroup className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {users.map((u) => (
                  <StaggerItem key={u.id}>
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
                        <Badge className={activeBadgeClass(u.is_active)}>
                          {u.is_active ? "Activo" : "Inactivo"}
                        </Badge>
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
                            <SubscriptionDialog
                              userId={u.id}
                              memberName={`${u.first_name} ${u.last_name}`}
                            />
                          )}
                          <EditUserDialog user={u} />
                          {u.is_active ? (
                            <Button
                              variant="ghost"
                              size="sm"
                              disabled={deactivateUser.isPending || u.id === currentUser?.id}
                              title={
                                u.id === currentUser?.id
                                  ? "No puedes desactivar tu propia cuenta"
                                  : "Desactivar"
                              }
                              onClick={() =>
                                deactivateUser.mutate(u.id, {
                                  onError: (error) =>
                                    toast.error(
                                      error instanceof ApiError
                                        ? error.detail
                                        : "La acción falló"
                                    ),
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
                              onClick={() =>
                                handleReactivate(u.id, `${u.first_name} ${u.last_name}`)
                              }
                            >
                              <RotateCcw className="size-3.5" />
                            </Button>
                          )}
                        </div>
                      </div>
                    </EntityCard>
                  </StaggerItem>
                ))}
                {users.length === 0 && (
                  <p className="text-sm text-muted-foreground sm:col-span-2 lg:col-span-3">
                    Todavía no hay nadie aquí.
                  </p>
                )}
              </StaggerGroup>
            )}
          </CardContent>
        </Card>
      </FadeIn>
    </div>
  )
}
