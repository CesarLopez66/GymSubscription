"use client"

import * as React from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { z } from "zod"
import { toast } from "sonner"
import { Plus } from "lucide-react"

import { Button } from "@/components/ui/button"
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
import { ColorInput } from "@/components/shared/color-input"
import { ApiError } from "@/lib/api-client"
import { PLAN_TIER_LABELS } from "@/lib/labels"
import type { SaaSPlanTier } from "@/lib/types"
import { useCreateGym } from "@/hooks/use-gyms"

const HEX_COLOR = /^#[0-9a-fA-F]{6}$/

const gymSchema = z.object({
  name: z.string().min(2),
  subdomain: z
    .string()
    .min(2)
    .regex(/^[a-z0-9-]+$/, "Solo minúsculas, números y guiones"),
  contact_email: z.string().email(),
  contact_phone: z.string().optional(),
  address: z.string().optional(),
  plan_tier: z.enum(["FREE", "BASIC", "PRO", "ENTERPRISE"]),
  primary_color: z.string().regex(HEX_COLOR, "Color inválido").optional(),
  secondary_color: z.string().regex(HEX_COLOR, "Color inválido").optional(),
})

type GymFormValues = z.infer<typeof gymSchema>

const PLAN_TIERS: SaaSPlanTier[] = ["FREE", "BASIC", "PRO", "ENTERPRISE"]

export function CreateGymDialog() {
  const [open, setOpen] = React.useState(false)
  const createGym = useCreateGym()

  const form = useForm<GymFormValues>({
    resolver: zodResolver(gymSchema),
    defaultValues: {
      name: "",
      subdomain: "",
      contact_email: "",
      contact_phone: "",
      address: "",
      plan_tier: "FREE",
      primary_color: undefined,
      secondary_color: undefined,
    },
  })

  const onSubmit = (values: GymFormValues) => {
    createGym.mutate(values, {
      onSuccess: () => {
        toast.success(`${values.name} creado`)
        form.reset()
        setOpen(false)
      },
      onError: (error) => {
        toast.error(error instanceof ApiError ? error.detail : "No se pudo crear el gimnasio")
      },
    })
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="sm" />}>
        <Plus className="size-4" />
        Nuevo gimnasio
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Crear gimnasio</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nombre</FormLabel>
                  <FormControl>
                    <Input placeholder="Acme Fitness" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="subdomain"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Subdominio</FormLabel>
                  <FormControl>
                    <Input placeholder="acme" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="contact_email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Correo de contacto</FormLabel>
                  <FormControl>
                    <Input type="email" placeholder="owner@acme.com" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="contact_phone"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Teléfono de contacto</FormLabel>
                  <FormControl>
                    <Input placeholder="Opcional" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="plan_tier"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Plan</FormLabel>
                  <Select items={PLAN_TIER_LABELS} value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {PLAN_TIERS.map((tier) => (
                        <SelectItem key={tier} value={tier}>
                          {PLAN_TIER_LABELS[tier]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="primary_color"
              render={({ field }) => (
                <FormItem>
                  <ColorInput label="Color primario" value={field.value} onChange={field.onChange} />
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="secondary_color"
              render={({ field }) => (
                <FormItem>
                  <ColorInput
                    label="Color secundario"
                    value={field.value}
                    onChange={field.onChange}
                    fallback="#a855f7"
                  />
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button type="submit" disabled={createGym.isPending}>
                {createGym.isPending ? "Creando…" : "Crear gimnasio"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
