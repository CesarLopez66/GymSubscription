"use client"

import * as React from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { z } from "zod"
import { toast } from "sonner"
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Skeleton } from "@/components/ui/skeleton"
import { EntityCard } from "@/components/shared/entity-card"
import { FadeIn, StaggerGroup, StaggerItem } from "@/components/shared/motion"
import { ApiError } from "@/lib/api-client"
import { amber, emerald, zinc } from "@/lib/badge-colors"
import { formatCurrency } from "@/lib/currency"
import { DISCOUNT_TYPE_LABELS } from "@/lib/labels"
import type { DiscountType, Promotion } from "@/lib/types"
import { useMemberships } from "@/hooks/use-memberships"
import { useCreatePromotion, usePromotions, useUpdatePromotion } from "@/hooks/use-promotions"

const ALL_PLANS = "ALL"
const DISCOUNT_TYPES: DiscountType[] = ["PERCENTAGE", "FIXED_AMOUNT"]

const promotionSchema = z
  .object({
    name: z.string().min(1),
    description: z.string().optional(),
    membership_id: z.string(),
    discount_type: z.enum(["PERCENTAGE", "FIXED_AMOUNT"]),
    discount_value: z.coerce.number().positive(),
    start_date: z.string().min(1),
    end_date: z.string().min(1),
  })
  .refine((data) => data.end_date >= data.start_date, {
    message: "La fecha de fin no puede ser anterior a la de inicio",
    path: ["end_date"],
  })

type PromotionFormValues = z.infer<typeof promotionSchema>

function todayIso() {
  return new Date().toISOString().slice(0, 10)
}

function formatDiscountValue(discountType: DiscountType, value: string) {
  return discountType === "PERCENTAGE" ? `${Number(value)}%` : formatCurrency(value)
}

function isCurrentlyValid(promo: Promotion) {
  const today = todayIso()
  return promo.is_active && promo.start_date <= today && promo.end_date >= today
}

function promoStatusLabel(promo: Promotion) {
  if (!promo.is_active) return "Inactiva"
  return isCurrentlyValid(promo) ? "Vigente" : "Fuera de fecha"
}

function promoStatusBadgeClass(promo: Promotion) {
  if (!promo.is_active) return zinc
  return isCurrentlyValid(promo) ? emerald : amber
}

function PromotionFormFields({
  control,
  discountType,
}: {
  control: ReturnType<typeof useForm<z.input<typeof promotionSchema>, unknown, PromotionFormValues>>["control"]
  discountType: DiscountType
}) {
  const { data: memberships } = useMemberships()
  const membershipItems = {
    [ALL_PLANS]: "Todos los planes",
    ...Object.fromEntries((memberships?.items ?? []).map((plan) => [plan.id, plan.name])),
  }

  return (
    <>
      <FormField
        control={control}
        name="name"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Nombre</FormLabel>
            <FormControl>
              <Input placeholder="Promo Navidad" {...field} />
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
            <FormLabel>Descripción (opcional)</FormLabel>
            <FormControl>
              <Textarea {...field} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
      <FormField
        control={control}
        name="membership_id"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Aplica a</FormLabel>
            <Select items={membershipItems} value={field.value} onValueChange={field.onChange}>
              <FormControl>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
              </FormControl>
              <SelectContent>
                <SelectItem value={ALL_PLANS}>Todos los planes</SelectItem>
                {(memberships?.items ?? []).map((plan) => (
                  <SelectItem key={plan.id} value={plan.id}>
                    {plan.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <FormMessage />
          </FormItem>
        )}
      />
      <div className="grid grid-cols-2 gap-4">
        <FormField
          control={control}
          name="discount_type"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Tipo de descuento</FormLabel>
              <Select items={DISCOUNT_TYPE_LABELS} value={field.value} onValueChange={field.onChange}>
                <FormControl>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {DISCOUNT_TYPES.map((type) => (
                    <SelectItem key={type} value={type}>
                      {DISCOUNT_TYPE_LABELS[type]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={control}
          name="discount_value"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Valor ({discountType === "PERCENTAGE" ? "%" : "Bs"})</FormLabel>
              <FormControl>
                <Input type="number" step="0.01" {...field} value={field.value as number} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <FormField
          control={control}
          name="start_date"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Vigencia desde</FormLabel>
              <FormControl>
                <Input type="date" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={control}
          name="end_date"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Vigencia hasta</FormLabel>
              <FormControl>
                <Input type="date" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>
    </>
  )
}

function EditPromotionDialog({ promo }: { promo: Promotion }) {
  const [open, setOpen] = React.useState(false)
  const updatePromotion = useUpdatePromotion()

  const defaults = {
    name: promo.name,
    description: promo.description ?? "",
    membership_id: promo.membership_id ?? ALL_PLANS,
    discount_type: promo.discount_type,
    discount_value: Number(promo.discount_value),
    start_date: promo.start_date,
    end_date: promo.end_date,
  }

  const form = useForm<z.input<typeof promotionSchema>, unknown, PromotionFormValues>({
    resolver: zodResolver(promotionSchema),
    defaultValues: defaults,
  })

  const onSubmit = (values: PromotionFormValues) => {
    updatePromotion.mutate(
      {
        id: promo.id,
        input: {
          ...values,
          membership_id: values.membership_id === ALL_PLANS ? null : values.membership_id,
        },
      },
      {
        onSuccess: () => {
          toast.success("Promoción actualizada")
          setOpen(false)
        },
        onError: (error) =>
          toast.error(error instanceof ApiError ? error.detail : "No se pudo actualizar la promoción"),
      }
    )
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v)
        if (v) form.reset(defaults)
      }}
    >
      <DialogTrigger render={<Button variant="ghost" size="sm" />}>
        <Pencil className="size-3.5" />
        Editar
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Editar promoción</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4">
            <PromotionFormFields control={form.control} discountType={form.watch("discount_type")} />
            <DialogFooter>
              <Button type="submit" disabled={updatePromotion.isPending}>
                {updatePromotion.isPending ? "Guardando…" : "Guardar cambios"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}

export default function PromotionsPage() {
  const [open, setOpen] = React.useState(false)
  const { data, isLoading } = usePromotions()
  const { data: memberships } = useMemberships()
  const createPromotion = useCreatePromotion()
  const updatePromotion = useUpdatePromotion()

  const form = useForm<z.input<typeof promotionSchema>, unknown, PromotionFormValues>({
    resolver: zodResolver(promotionSchema),
    defaultValues: {
      name: "",
      description: "",
      membership_id: ALL_PLANS,
      discount_type: "PERCENTAGE",
      discount_value: 10,
      start_date: todayIso(),
      end_date: todayIso(),
    },
  })

  const onSubmit = (values: PromotionFormValues) => {
    createPromotion.mutate(
      {
        ...values,
        membership_id: values.membership_id === ALL_PLANS ? null : values.membership_id,
      },
      {
        onSuccess: () => {
          toast.success(`Promoción ${values.name} creada`)
          form.reset()
          setOpen(false)
        },
        onError: (error) => {
          toast.error(error instanceof ApiError ? error.detail : "No se pudo crear la promoción")
        },
      }
    )
  }

  const promotions = data?.items ?? []
  const membershipNameById = new Map((memberships?.items ?? []).map((m) => [m.id, m.name]))

  return (
    <div className="space-y-6">
      <FadeIn className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Promociones</h1>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger render={<Button size="sm" />}>
            <Plus className="size-4" />
            Nueva promoción
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Crear promoción</DialogTitle>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4">
                <PromotionFormFields control={form.control} discountType={form.watch("discount_type")} />
                <DialogFooter>
                  <Button type="submit" disabled={createPromotion.isPending}>
                    {createPromotion.isPending ? "Creando…" : "Crear promoción"}
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
            <CardTitle>Promociones ({data?.total ?? 0})</CardTitle>
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
                {promotions.map((promo) => (
                  <StaggerItem key={promo.id}>
                    <EntityCard>
                      <div className="flex items-center justify-between gap-2">
                        <p className="truncate font-semibold">{promo.name}</p>
                        <Badge className={promoStatusBadgeClass(promo)}>{promoStatusLabel(promo)}</Badge>
                      </div>

                      <div className="space-y-1 text-xs text-muted-foreground">
                        <p>
                          {promo.membership_id
                            ? (membershipNameById.get(promo.membership_id) ?? "Plan eliminado")
                            : "Todos los planes"}
                        </p>
                        <p className="font-medium text-foreground">
                          {formatDiscountValue(promo.discount_type, promo.discount_value)}
                        </p>
                        <p>
                          {new Date(promo.start_date).toLocaleDateString()} –{" "}
                          {new Date(promo.end_date).toLocaleDateString()}
                        </p>
                      </div>

                      <div className="flex items-center justify-end gap-1 border-t pt-3">
                        <EditPromotionDialog promo={promo} />
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={updatePromotion.isPending}
                          onClick={() =>
                            updatePromotion.mutate({
                              id: promo.id,
                              input: { is_active: !promo.is_active },
                            })
                          }
                        >
                          {promo.is_active ? "Desactivar" : "Reactivar"}
                        </Button>
                      </div>
                    </EntityCard>
                  </StaggerItem>
                ))}
                {promotions.length === 0 && (
                  <p className="text-sm text-muted-foreground sm:col-span-2 lg:col-span-3">
                    Todavía no hay promociones.
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
