"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { z } from "zod"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
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
import { useLogin } from "@/hooks/use-auth"
import { toast } from "sonner"

const loginSchema = z.object({
  email: z.string().email("Ingresa un correo válido"),
  password: z.string().min(1, "La contraseña es obligatoria"),
  gym_subdomain: z.string().optional(),
})

type LoginValues = z.infer<typeof loginSchema>

export default function LoginPage() {
  const login = useLogin()
  const form = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "", gym_subdomain: "" },
  })

  const onSubmit = (values: LoginValues) => {
    login.mutate(
      {
        email: values.email,
        password: values.password,
        gym_subdomain: values.gym_subdomain || undefined,
      },
      {
        onError: (error) => {
          toast.error(error instanceof ApiError ? error.detail : "No se pudo iniciar sesión");
        },
      }
    )
  }

  return (
    <div className="flex flex-1 items-center justify-center p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="text-xl">Inicia sesión en SubGym</CardTitle>
          <CardDescription>
            Deja el subdominio del gimnasio en blanco si eres Super administrador.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4">
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Correo electrónico</FormLabel>
                    <FormControl>
                      <Input type="email" placeholder="tu@ejemplo.com" {...field} />
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
                    <FormLabel>Contraseña</FormLabel>
                    <FormControl>
                      <Input type="password" placeholder="••••••••" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="gym_subdomain"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Subdominio del gimnasio (opcional)</FormLabel>
                    <FormControl>
                      <Input placeholder="acme" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit" className="w-full" disabled={login.isPending}>
                {login.isPending ? "Iniciando sesión…" : "Iniciar sesión"}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  )
}
