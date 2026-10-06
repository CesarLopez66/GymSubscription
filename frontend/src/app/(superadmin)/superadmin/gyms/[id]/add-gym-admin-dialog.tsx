"use client"

import * as React from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { z } from "zod"
import { toast } from "sonner"
import { UserPlus } from "lucide-react"

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
import { ApiError } from "@/lib/api-client"
import { useCreateGymAdmin } from "@/hooks/use-gyms"

const adminSchema = z.object({
  first_name: z.string().min(1),
  last_name: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(8, "Debe tener al menos 8 caracteres"),
})

type AdminFormValues = z.infer<typeof adminSchema>

export function AddGymAdminDialog({ gymId }: { gymId: string }) {
  const [open, setOpen] = React.useState(false)
  const createGymAdmin = useCreateGymAdmin()

  const form = useForm<AdminFormValues>({
    resolver: zodResolver(adminSchema),
    defaultValues: { first_name: "", last_name: "", email: "", password: "" },
  })

  const onSubmit = (values: AdminFormValues) => {
    createGymAdmin.mutate(
      { gymId, input: values },
      {
        onSuccess: () => {
          toast.success(`${values.first_name} ${values.last_name} agregado como administrador`)
          form.reset()
          setOpen(false)
        },
        onError: (error) => {
          toast.error(error instanceof ApiError ? error.detail : "No se pudo crear el administrador")
        },
      }
    )
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="sm" variant="outline" />}>
        <UserPlus className="size-4" />
        Agregar administrador
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Agregar administrador</DialogTitle>
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
            <DialogFooter>
              <Button type="submit" disabled={createGymAdmin.isPending}>
                {createGymAdmin.isPending ? "Agregando…" : "Agregar administrador"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
