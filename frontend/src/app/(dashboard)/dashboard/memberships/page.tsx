"use client"

import * as React from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { z } from "zod"
import { toast } from "sonner"
import { motion } from "framer-motion"
import { Pencil, Plus } from "lucide-react"

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
import { Textarea } from "@/components/ui/textarea"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { FadeIn } from "@/components/shared/motion"
import { ApiError } from "@/lib/api-client"
import type { Membership } from "@/lib/types"
import { useCreateMembership, useMemberships, useUpdateMembership } from "@/hooks/use-memberships"

const membershipSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  price: z.coerce.number().positive(),
  duration_days: z.coerce.number().int().positive(),
})

type MembershipFormValues = z.infer<typeof membershipSchema>

function MembershipFormFields({
  control,
}: {
  control: ReturnType<typeof useForm<z.input<typeof membershipSchema>, unknown, MembershipFormValues>>["control"]
}) {
  return (
    <>
      <FormField
        control={control}
        name="name"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Nombre</FormLabel>
            <FormControl>
              <Input placeholder="Mensual" {...field} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
      <FormField
        control={control}
        name="description"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Descripción</FormLabel>
            <FormControl>
              <Textarea {...field} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
      <div className="grid grid-cols-2 gap-4">
        <FormField
          control={control}
          name="price"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Precio (USD)</FormLabel>
              <FormControl>
                <Input type="number" step="0.01" {...field} value={field.value as number} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={control}
          name="duration_days"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Duración (días)</FormLabel>
              <FormControl>
                <Input type="number" {...field} value={field.value as number} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>
    </>
  )
}

function EditMembershipDialog({ plan }: { plan: Membership }) {
  const [open, setOpen] = React.useState(false)
  const updateMembership = useUpdateMembership()

  const form = useForm<z.input<typeof membershipSchema>, unknown, MembershipFormValues>({
    resolver: zodResolver(membershipSchema),
    defaultValues: {
      name: plan.name,
      description: plan.description ?? "",
      price: Number(plan.price),
      duration_days: plan.duration_days,
    },
  })

  const onSubmit = (values: MembershipFormValues) => {
    updateMembership.mutate(
      { id: plan.id, input: values },
      {
        onSuccess: () => {
          toast.success("Plan actualizado")
          setOpen(false)
        },
        onError: (error) =>
          toast.error(error instanceof ApiError ? error.detail : "No se pudo actualizar el plan"),
      }
    )
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v)
        if (v) {
          form.reset({
            name: plan.name,
            description: plan.description ?? "",
            price: Number(plan.price),
            duration_days: plan.duration_days,
          })
        }
      }}
    >
      <DialogTrigger render={<Button variant="ghost" size="sm" />}>
        <Pencil className="size-3.5" />
        Editar
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Editar plan</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4">
            <MembershipFormFields control={form.control} />
            <DialogFooter>
              <Button type="submit" disabled={updateMembership.isPending}>
                {updateMembership.isPending ? "Guardando…" : "Guardar cambios"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}

export default function MembershipsPage() {
  const [open, setOpen] = React.useState(false)
  const { data, isLoading } = useMemberships()
  const createMembership = useCreateMembership()
  const updateMembership = useUpdateMembership()

  const form = useForm<z.input<typeof membershipSchema>, unknown, MembershipFormValues>({
    resolver: zodResolver(membershipSchema),
    defaultValues: { name: "", description: "", price: 0, duration_days: 30 },
  })

  const onSubmit = (values: MembershipFormValues) => {
    createMembership.mutate(values, {
      onSuccess: () => {
        toast.success(`Plan ${values.name} creado`)
        form.reset()
        setOpen(false)
      },
      onError: (error) => {
        toast.error(error instanceof ApiError ? error.detail : "No se pudo crear el plan")
      },
    })
  }

  const plans = data?.items ?? []

  return (
    <div className="space-y-6">
      <FadeIn className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Planes de membresía</h1>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger render={<Button size="sm" />}>
            <Plus className="size-4" />
            Nuevo plan
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Crear plan de membresía</DialogTitle>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4">
                <MembershipFormFields control={form.control} />
                <DialogFooter>
                  <Button type="submit" disabled={createMembership.isPending}>
                    {createMembership.isPending ? "Creando…" : "Crear plan"}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </FadeIn>

      <FadeIn delay={0.05}>
        <Card>
          <CardHeader>
            <CardTitle>Planes ({data?.total ?? 0})</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-10 w-full" />
                ))}
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nombre</TableHead>
                    <TableHead>Precio</TableHead>
                    <TableHead>Duración</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {plans.map((plan, i) => (
                    <motion.tr
                      key={plan.id}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.25, delay: Math.min(i * 0.04, 0.3) }}
                      className="border-b transition-colors hover:bg-muted/50"
                    >
                      <TableCell className="font-medium">{plan.name}</TableCell>
                      <TableCell>${Number(plan.price).toFixed(2)}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {plan.duration_days} días
                      </TableCell>
                      <TableCell>
                        <Badge variant={plan.is_active ? "default" : "secondary"}>
                          {plan.is_active ? "Activo" : "Inactivo"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <EditMembershipDialog plan={plan} />
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() =>
                              updateMembership.mutate({
                                id: plan.id,
                                input: { is_active: !plan.is_active },
                              })
                            }
                          >
                            {plan.is_active ? "Desactivar" : "Reactivar"}
                          </Button>
                        </div>
                      </TableCell>
                    </motion.tr>
                  ))}
                  {plans.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-muted-foreground">
                        Todavía no hay planes.
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
