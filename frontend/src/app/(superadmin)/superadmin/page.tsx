"use client"

import * as React from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { z } from "zod"
import { toast } from "sonner"
import { motion } from "framer-motion"
import { Building2, CheckCircle2, Clock, Plus } from "lucide-react"

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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Skeleton } from "@/components/ui/skeleton"
import { FadeIn } from "@/components/shared/motion"
import { StatCard } from "@/components/shared/stat-card"
import { ApiError } from "@/lib/api-client"
import { GYM_STATUS_LABELS, PLAN_TIER_LABELS } from "@/lib/labels"
import type { GymStatus, SaaSPlanTier } from "@/lib/types"
import { useCreateGym, useGyms, useUpdateGym } from "@/hooks/use-gyms"

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
})

type GymFormValues = z.infer<typeof gymSchema>

const PLAN_TIERS: SaaSPlanTier[] = ["FREE", "BASIC", "PRO", "ENTERPRISE"]
const GYM_STATUSES: GymStatus[] = ["TRIAL", "ACTIVE", "SUSPENDED", "CANCELLED"]

function statusVariant(status: GymStatus) {
  if (status === "ACTIVE") return "default"
  if (status === "TRIAL") return "secondary"
  return "destructive"
}

export default function SuperAdminPage() {
  const [open, setOpen] = React.useState(false)
  const { data, isLoading } = useGyms(1, 100)
  const createGym = useCreateGym()
  const updateGym = useUpdateGym()

  const form = useForm<GymFormValues>({
    resolver: zodResolver(gymSchema),
    defaultValues: {
      name: "",
      subdomain: "",
      contact_email: "",
      contact_phone: "",
      address: "",
      plan_tier: "FREE",
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

  const gyms = data?.items ?? []
  const activeCount = gyms.filter((g) => g.status === "ACTIVE").length
  const trialCount = gyms.filter((g) => g.status === "TRIAL").length

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Total de gimnasios" value={data?.total} icon={Building2} delay={0} />
        <StatCard label="Activos" value={activeCount} icon={CheckCircle2} delay={0.05} />
        <StatCard label="En prueba" value={trialCount} icon={Clock} delay={0.1} />
      </div>

      <FadeIn delay={0.15}>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Gimnasios (tenants)</CardTitle>
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
                        <Select value={field.value} onValueChange={field.onChange}>
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
                  <DialogFooter>
                    <Button type="submit" disabled={createGym.isPending}>
                      {createGym.isPending ? "Creando…" : "Crear gimnasio"}
                    </Button>
                  </DialogFooter>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
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
                  <TableHead>Subdominio</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Plan</TableHead>
                  <TableHead>Contacto</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {gyms.map((gym, i) => (
                  <motion.tr
                    key={gym.id}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.25, delay: Math.min(i * 0.03, 0.3) }}
                    className="border-b transition-colors hover:bg-muted/50"
                  >
                    <TableCell className="font-medium">{gym.name}</TableCell>
                    <TableCell className="text-muted-foreground">{gym.subdomain}</TableCell>
                    <TableCell>
                      <Select
                        value={gym.status}
                        onValueChange={(status) =>
                          updateGym.mutate(
                            { id: gym.id, input: { status: status as GymStatus } },
                            {
                              onError: (error) =>
                                toast.error(
                                  error instanceof ApiError
                                    ? error.detail
                                    : "No se pudo actualizar"
                                ),
                            }
                          )
                        }
                      >
                        <SelectTrigger size="sm" className="w-28">
                          <Badge variant={statusVariant(gym.status)}>
                            {GYM_STATUS_LABELS[gym.status]}
                          </Badge>
                        </SelectTrigger>
                        <SelectContent>
                          {GYM_STATUSES.map((status) => (
                            <SelectItem key={status} value={status}>
                              {GYM_STATUS_LABELS[status]}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <Select
                        value={gym.plan_tier}
                        onValueChange={(plan_tier) =>
                          updateGym.mutate(
                            { id: gym.id, input: { plan_tier: plan_tier as SaaSPlanTier } },
                            {
                              onError: (error) =>
                                toast.error(
                                  error instanceof ApiError
                                    ? error.detail
                                    : "No se pudo actualizar"
                                ),
                            }
                          )
                        }
                      >
                        <SelectTrigger size="sm" className="w-32">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {PLAN_TIERS.map((tier) => (
                            <SelectItem key={tier} value={tier}>
                              {PLAN_TIER_LABELS[tier]}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{gym.contact_email}</TableCell>
                  </motion.tr>
                ))}
                {gyms.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground">
                      Todavía no hay gimnasios.
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
