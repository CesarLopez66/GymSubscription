"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { z } from "zod"
import { motion } from "framer-motion"
import { Activity, Dumbbell, Flame, ScanLine } from "lucide-react"

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

const FEATURES = [
  { icon: Dumbbell, label: "Rutinas y evaluaciones físicas" },
  { icon: Flame, label: "Planes de nutrición con macros" },
  { icon: ScanLine, label: "Check-in por QR en segundos" },
]

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
    <div className="bg-gym-radial relative flex flex-1 items-center justify-center overflow-hidden p-4">
      <div className="bg-grid-fade pointer-events-none absolute inset-0" />

      <div className="relative grid w-full max-w-4xl gap-10 lg:grid-cols-2 lg:items-center">
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className="hidden flex-col gap-6 lg:flex"
        >
          <div className="flex items-center gap-2">
            <span className="flex size-10 items-center justify-center rounded-xl bg-primary text-primary-foreground">
              <Dumbbell className="size-5" />
            </span>
            <span className="text-lg font-semibold tracking-tight">SubGym</span>
          </div>
          <h1 className="text-4xl leading-tight font-semibold tracking-tight">
            El sistema operativo <span className="text-gradient-primary">de tu gimnasio</span>
          </h1>
          <p className="max-w-sm text-muted-foreground">
            Membresías, acceso, entrenamiento y nutrición en una sola plataforma para todo tu
            equipo y tus miembros.
          </p>
          <ul className="flex flex-col gap-3">
            {FEATURES.map(({ icon: Icon, label }, i) => (
              <motion.li
                key={label}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.15 + i * 0.08 }}
                className="flex items-center gap-3 text-sm"
              >
                <span className="flex size-8 items-center justify-center rounded-lg bg-accent text-accent-foreground">
                  <Icon className="size-4" />
                </span>
                {label}
              </motion.li>
            ))}
          </ul>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: "easeOut" }}
        >
          <Card className="w-full border-white/10 bg-card/80 shadow-2xl shadow-black/40 backdrop-blur-sm">
            <CardHeader>
              <div className="mb-1 flex items-center gap-2 lg:hidden">
                <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                  <Dumbbell className="size-4" />
                </span>
                <span className="font-semibold tracking-tight">SubGym</span>
              </div>
              <CardTitle className="text-xl">Inicia sesión</CardTitle>
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
                    <Activity className="size-4" />
                    {login.isPending ? "Iniciando sesión…" : "Iniciar sesión"}
                  </Button>
                </form>
              </Form>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  )
}
