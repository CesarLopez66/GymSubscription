"use client"

import * as React from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { z } from "zod"
import { toast } from "sonner"
import { Plus, RotateCcw, UserX } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Tabs,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs"
import { motion } from "framer-motion"

import { EditUserDialog } from "@/components/shared/edit-user-dialog"
import { FadeIn } from "@/components/shared/motion"
import { SubscriptionDialog } from "@/components/shared/subscription-dialog"
import { ApiError } from "@/lib/api-client"
import { ROLE_LABELS } from "@/lib/labels"
import type { UserRole } from "@/lib/types"
import { useCreateUser, useDeactivateUser, useUpdateUser, useUsers } from "@/hooks/use-users"

const ROLES: UserRole[] = ["MEMBER", "TRAINER", "NUTRITIONIST", "GYM_ADMIN"]

const userSchema = z.object({
  first_name: z.string().min(1),
  last_name: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(8, "Debe tener al menos 8 caracteres"),
  role: z.enum(["MEMBER", "TRAINER", "NUTRITIONIST", "GYM_ADMIN"]),
  phone: z.string().optional(),
})

type UserFormValues = z.infer<typeof userSchema>

export default function MembersPage() {
  const [roleFilter, setRoleFilter] = React.useState<UserRole>("MEMBER")
  const [open, setOpen] = React.useState(false)
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
      role: "MEMBER",
      phone: "",
    },
  })

  const onSubmit = (values: UserFormValues) => {
    createUser.mutate(values, {
      onSuccess: () => {
        toast.success(`${values.first_name} ${values.last_name} agregado`)
        form.reset()
        setOpen(false)
      },
      onError: (error) => {
        toast.error(error instanceof ApiError ? error.detail : "No se pudo crear el usuario")
      },
    })
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
          <DialogTrigger render={<Button size="sm" />}>
            <Plus className="size-4" />
            Nueva persona
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Agregar persona</DialogTitle>
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
                <FormField
                  control={form.control}
                  name="role"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Rol</FormLabel>
                      <Select value={field.value} onValueChange={field.onChange}>
                        <FormControl>
                          <SelectTrigger className="w-full">
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {ROLES.map((role) => (
                            <SelectItem key={role} value={role}>
                              {ROLE_LABELS[role]}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
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

      <FadeIn delay={0.05}>
        <Tabs value={roleFilter} onValueChange={(v) => setRoleFilter(v as UserRole)}>
          <TabsList>
            {ROLES.map((role) => (
              <TabsTrigger key={role} value={role}>
                {ROLE_LABELS[role]}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </FadeIn>

      <FadeIn delay={0.1}>
        <Card>
          <CardHeader>
            <CardTitle>
              {ROLE_LABELS[roleFilter]}{" "}
              <span className="text-muted-foreground">({data?.total ?? 0})</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-10 w-full" />
                ))}
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nombre</TableHead>
                    <TableHead>Correo electrónico</TableHead>
                    <TableHead>Teléfono</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((u, i) => (
                    <motion.tr
                      key={u.id}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.25, delay: Math.min(i * 0.03, 0.3) }}
                      className="border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted"
                    >
                      <TableCell className="font-medium">
                        {u.first_name} {u.last_name}
                      </TableCell>
                      <TableCell className="text-muted-foreground">{u.email}</TableCell>
                      <TableCell className="text-muted-foreground">{u.phone ?? "—"}</TableCell>
                      <TableCell>
                        <Badge variant={u.is_active ? "default" : "destructive"}>
                          {u.is_active ? "Activo" : "Inactivo"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          {roleFilter === "MEMBER" && (
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
                              disabled={deactivateUser.isPending}
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
                              Desactivar
                            </Button>
                          ) : (
                            <Button
                              variant="ghost"
                              size="sm"
                              disabled={updateUser.isPending}
                              onClick={() =>
                                handleReactivate(u.id, `${u.first_name} ${u.last_name}`)
                              }
                            >
                              <RotateCcw className="size-3.5" />
                              Reactivar
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </motion.tr>
                  ))}
                  {users.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-muted-foreground">
                        Todavía no hay nadie aquí.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </FadeIn>
    </div>
  )
}
