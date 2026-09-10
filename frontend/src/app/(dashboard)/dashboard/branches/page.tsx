"use client"

import * as React from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { z } from "zod"
import { toast } from "sonner"
import { Building2, Pencil, Plus, QrCode, RotateCcw, Trash2 } from "lucide-react"
import { QRCodeSVG } from "qrcode.react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
import { ConfirmDialog } from "@/components/shared/confirm-dialog"
import { EntityCard } from "@/components/shared/entity-card"
import { FadeIn, StaggerGroup, StaggerItem } from "@/components/shared/motion"
import { activeBadgeClass } from "@/lib/badge-colors"
import { ApiError } from "@/lib/api-client"
import type { Branch } from "@/lib/types"
import {
  useBranchCheckinQr,
  useBranches,
  useCreateBranch,
  useDeleteBranch,
  useRegenerateBranchCheckinQr,
  useUpdateBranch,
  type BranchCreateInput,
} from "@/hooks/use-branches"

const branchSchema = z.object({
  name: z.string().min(1, "Requerido"),
  address: z.string().optional(),
  phone: z.string().optional(),
})

type BranchFormValues = z.infer<typeof branchSchema>

function BranchQrDialog({ branch }: { branch: Branch }) {
  const [open, setOpen] = React.useState(false)
  const { data, isLoading } = useBranchCheckinQr(branch.id)
  const regenerate = useRegenerateBranchCheckinQr()

  const handleRegenerate = () => {
    regenerate.mutate(branch.id, {
      onSuccess: () => toast.success("Código regenerado — el póster impreso anterior ya no funciona"),
      onError: (error) => toast.error(error instanceof ApiError ? error.detail : "No se pudo regenerar el código"),
    })
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="ghost" size="sm" />}>
        <QrCode className="size-3.5" />
        QR
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>QR de entrada — {branch.name}</DialogTitle>
          <DialogDescription>
            Imprime este código y pégalo en la entrada de esta sucursal. Los miembros lo
            escanean para hacer check-in y quedan atribuidos automáticamente a esta ubicación.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col items-center gap-3">
          {isLoading && <Skeleton className="size-44 rounded-lg" />}
          {data && (
            <div className="rounded-xl bg-white p-3 shadow-lg shadow-primary/20">
              <QRCodeSVG value={data.checkin_qr_token} size={176} />
            </div>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={handleRegenerate}
            disabled={regenerate.isPending}
          >
            {regenerate.isPending ? "Regenerando…" : "Regenerar código"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function BranchFormDialog({
  branch,
  trigger,
}: {
  branch?: Branch
  trigger: React.ReactElement
}) {
  const [open, setOpen] = React.useState(false)
  const createBranch = useCreateBranch()
  const updateBranch = useUpdateBranch()
  const isEditing = !!branch

  const form = useForm<BranchFormValues>({
    resolver: zodResolver(branchSchema),
    defaultValues: {
      name: branch?.name ?? "",
      address: branch?.address ?? "",
      phone: branch?.phone ?? "",
    },
  })

  React.useEffect(() => {
    if (open) {
      form.reset({
        name: branch?.name ?? "",
        address: branch?.address ?? "",
        phone: branch?.phone ?? "",
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const onSubmit = (values: BranchFormValues) => {
    const input: BranchCreateInput = {
      name: values.name,
      address: values.address || undefined,
      phone: values.phone || undefined,
    }
    if (isEditing) {
      updateBranch.mutate(
        { id: branch.id, input },
        {
          onSuccess: () => {
            toast.success("Sucursal actualizada")
            setOpen(false)
          },
          onError: (error) =>
            toast.error(error instanceof ApiError ? error.detail : "No se pudo actualizar la sucursal"),
        }
      )
    } else {
      createBranch.mutate(input, {
        onSuccess: () => {
          toast.success(`Sucursal "${values.name}" creada`)
          setOpen(false)
        },
        onError: (error) =>
          toast.error(error instanceof ApiError ? error.detail : "No se pudo crear la sucursal"),
      })
    }
  }

  const isPending = createBranch.isPending || updateBranch.isPending

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={trigger} />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEditing ? "Editar sucursal" : "Nueva sucursal"}</DialogTitle>
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
                    <Input placeholder="Sucursal Norte" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="address"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Dirección (opcional)</FormLabel>
                  <FormControl>
                    <Input {...field} />
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
            <DialogFooter>
              <Button type="submit" disabled={isPending}>
                {isPending ? "Guardando…" : isEditing ? "Guardar cambios" : "Crear sucursal"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}

export default function BranchesPage() {
  const { data, isLoading } = useBranches()
  const updateBranch = useUpdateBranch()
  const deleteBranch = useDeleteBranch()
  const [deleteTarget, setDeleteTarget] = React.useState<Branch | null>(null)

  const branches = data?.items ?? []

  const handleToggleActive = (branch: Branch) => {
    updateBranch.mutate(
      { id: branch.id, input: { is_active: !branch.is_active } },
      {
        onSuccess: () =>
          toast.success(branch.is_active ? `${branch.name} desactivada` : `${branch.name} reactivada`),
        onError: (error) =>
          toast.error(error instanceof ApiError ? error.detail : "No se pudo actualizar la sucursal"),
      }
    )
  }

  const handleDelete = () => {
    if (!deleteTarget) return
    deleteBranch.mutate(deleteTarget.id, {
      onSuccess: () => {
        toast.success(`${deleteTarget.name} eliminada`)
        setDeleteTarget(null)
      },
      onError: (error) => {
        toast.error(error instanceof ApiError ? error.detail : "No se pudo eliminar la sucursal")
        setDeleteTarget(null)
      },
    })
  }

  return (
    <div className="space-y-6">
      <FadeIn className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Sucursales</h1>
        <BranchFormDialog
          trigger={
            <Button size="sm">
              <Plus className="size-4" />
              Nueva sucursal
            </Button>
          }
        />
      </FadeIn>

      <FadeIn delay={0.05}>
        <Card>
          <CardHeader>
            <CardTitle>
              Ubicaciones <span className="text-muted-foreground">({data?.total ?? 0})</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="mb-4 text-sm text-muted-foreground">
              Cada sucursal tiene su propio QR de entrada: los miembros, pagos, suscripciones,
              evaluaciones, rutinas y planes de nutrición pueden clasificarse por sucursal
              automáticamente.
            </p>
            {isLoading ? (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-40 w-full" />
                ))}
              </div>
            ) : (
              <StaggerGroup className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {branches.map((b) => (
                  <StaggerItem key={b.id}>
                    <EntityCard>
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <Building2 className="size-4 text-primary" />
                          <p className="font-semibold leading-tight">{b.name}</p>
                        </div>
                        <Badge className={activeBadgeClass(b.is_active)}>
                          {b.is_active ? "Activa" : "Inactiva"}
                        </Badge>
                      </div>
                      <div className="space-y-0.5 text-xs text-muted-foreground">
                        <p>{b.address ?? "Sin dirección registrada"}</p>
                        <p>{b.phone ?? "Sin teléfono registrado"}</p>
                      </div>
                      <div className="flex items-center justify-between gap-2 border-t pt-3">
                        <BranchQrDialog branch={b} />
                        <div className="flex items-center gap-1">
                          <BranchFormDialog
                            branch={b}
                            trigger={
                              <Button variant="ghost" size="sm" title="Editar">
                                <Pencil className="size-3.5" />
                              </Button>
                            }
                          />
                          <Button
                            variant="ghost"
                            size="sm"
                            title={b.is_active ? "Desactivar" : "Reactivar"}
                            disabled={updateBranch.isPending}
                            onClick={() => handleToggleActive(b)}
                          >
                            <RotateCcw className="size-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            title="Eliminar"
                            onClick={() => setDeleteTarget(b)}
                          >
                            <Trash2 className="size-3.5" />
                          </Button>
                        </div>
                      </div>
                    </EntityCard>
                  </StaggerItem>
                ))}
                {branches.length === 0 && (
                  <p className="text-sm text-muted-foreground sm:col-span-2 lg:col-span-3">
                    Todavía no hay sucursales registradas. Si tu gimnasio opera en una sola
                    ubicación, puedes ignorar esta sección.
                  </p>
                )}
              </StaggerGroup>
            )}
          </CardContent>
        </Card>
      </FadeIn>

      <ConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="Eliminar sucursal"
        description={`Esto elimina "${deleteTarget?.name}" permanentemente. Los registros ya clasificados con esta sucursal (usuarios, pagos, check-ins, etc.) quedan sin sucursal asignada, pero no se eliminan. ¿Confirmas?`}
        confirmLabel="Eliminar"
        isPending={deleteBranch.isPending}
        onConfirm={handleDelete}
      />
    </div>
  )
}
