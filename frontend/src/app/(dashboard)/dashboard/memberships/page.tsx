"use client"

import * as React from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { z } from "zod"
import { toast } from "sonner"
import { Pencil, Plus, Tag } from "lucide-react"

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
import { EntityCard } from "@/components/shared/entity-card"
import { FadeIn, StaggerGroup, StaggerItem } from "@/components/shared/motion"
import { ApiError } from "@/lib/api-client"
import { activeBadgeClass } from "@/lib/badge-colors"
import { formatCurrency } from "@/lib/currency"
import { applicablePromotion, discountedPrice } from "@/lib/promotions"
import type { Membership } from "@/lib/types"
import { useCreateMembership, useMemberships, useUpdateMembership } from "@/hooks/use-memberships"
import { usePromotions } from "@/hooks/use-promotions"

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
              <FormLabel>Precio (Bs)</FormLabel>
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
  const { data: promotions } = usePromotions(1, 100)
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
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-32 w-full" />
                ))}
              </div>
            ) : (
              <StaggerGroup className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {plans.map((plan) => {
                  const promo = applicablePromotion(promotions?.items ?? [], plan.id)
                  return (
                    <StaggerItem key={plan.id}>
                      <EntityCard>
                        <div className="flex items-center justify-between gap-2">
                          <p className="truncate font-semibold">{plan.name}</p>
                          <Badge className={activeBadgeClass(plan.is_active)}>
                            {plan.is_active ? "Activo" : "Inactivo"}
                          </Badge>
                        </div>

                        <div>
                          {promo ? (
                            <div className="flex flex-col gap-1">
                              <span className="flex items-center gap-2">
                                <span className="text-sm text-muted-foreground line-through">
                                  {formatCurrency(plan.price)}
                                </span>
                                <span className="font-medium">
                                  {formatCurrency(discountedPrice(Number(plan.price), promo))}
                                </span>
                              </span>
                              <Badge variant="outline" className="w-fit gap-1 text-[10px]">
                                <Tag className="size-3" />
                                {promo.name}
                              </Badge>
                            </div>
                          ) : (
                            <p className="font-medium">{formatCurrency(plan.price)}</p>
                          )}
                          <p className="text-xs text-muted-foreground">{plan.duration_days} días</p>
                        </div>

                        <div className="flex items-center justify-end gap-1 border-t pt-3">
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
                      </EntityCard>
                    </StaggerItem>
                  )
                })}
                {plans.length === 0 && (
                  <p className="text-sm text-muted-foreground sm:col-span-2 lg:col-span-3">
                    Todavía no hay planes.
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
