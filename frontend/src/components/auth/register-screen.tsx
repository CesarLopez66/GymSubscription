"use client"

import Image from "next/image"
import Link from "next/link"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { z } from "zod"
import { motion } from "framer-motion"
import { Building2, Rocket } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
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
import { Logo } from "@/components/shared/logo"
import { useRegisterGym } from "@/hooks/use-auth"

const registerSchema = z.object({
  gym_name: z.string().min(2, "Ingresa el nombre de tu gimnasio"),
  subdomain: z
    .string()
    .min(2)
    .regex(/^[a-z0-9-]+$/, "Solo minúsculas, números y guiones"),
  admin_first_name: z.string().min(1, "Ingresa tu nombre"),
  admin_last_name: z.string().min(1, "Ingresa tu apellido"),
  admin_email: z.string().email("Ingresa un correo válido"),
  admin_password: z.string().min(8, "Debe tener al menos 8 caracteres"),
})

type RegisterValues = z.infer<typeof registerSchema>

const glassInputClass =
  "h-12 rounded-xl border-white/15 bg-white/5 text-base backdrop-blur-sm placeholder:text-muted-foreground/60 md:text-base"
const fieldLabelClass = "text-sm font-medium text-foreground/90 lg:text-base"

export function RegisterScreen() {
  const registerGym = useRegisterGym()
  const form = useForm<RegisterValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      gym_name: "",
      subdomain: "",
      admin_first_name: "",
      admin_last_name: "",
      admin_email: "",
      admin_password: "",
    },
  })

  const onSubmit = (values: RegisterValues) => {
    registerGym.mutate(values, {
      onError: (error) => {
        toast.error(error instanceof ApiError ? error.detail : "No se pudo registrar el gimnasio")
      },
    })
  }

  return (
    <div className="relative flex flex-1 items-center justify-center overflow-hidden p-6 lg:p-10">
      <Image
        src="/images/login-hero.png"
        alt=""
        fill
        priority
        sizes="100vw"
        className="object-cover object-[center_20%]"
      />
      <div className="absolute inset-0 bg-gradient-to-b from-background/85 via-background/75 to-background" />
      <div className="bg-gym-radial pointer-events-none absolute inset-0" />

      <div className="relative grid w-full max-w-5xl gap-12 lg:grid-cols-2 lg:items-center lg:gap-16">
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className="hidden flex-col gap-6 lg:flex"
        >
          <Logo size="2xl" />
          <p className="text-lg text-muted-foreground">
            Registra tu gimnasio y empieza a usar la plataforma gratis — sin tarjeta, sin
            esperar aprobación. Cuando quieras más capacidad, pides tu plan pago desde tu propio
            panel.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: "easeOut" }}
        >
          <Card className="w-full border-white/15 bg-card/70 shadow-2xl shadow-black/50 ring-1 ring-white/10 backdrop-blur-xl [--card-spacing:--spacing(7)] lg:[--card-spacing:--spacing(8)]">
            <CardHeader>
              <div className="mb-2 lg:hidden">
                <Logo size="lg" />
              </div>
              <CardTitle className="text-center text-2xl lg:text-3xl">Registra tu gimnasio</CardTitle>
            </CardHeader>
            <CardContent>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4">
                  <FormField
                    control={form.control}
                    name="gym_name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className={fieldLabelClass}>Nombre del gimnasio</FormLabel>
                        <FormControl>
                          <Input placeholder="Iron Paradise" className={glassInputClass} {...field} />
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
                        <FormLabel className={fieldLabelClass}>Subdominio</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <Building2 className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                            <Input
                              placeholder="ironparadise"
                              className={`${glassInputClass} pl-9`}
                              {...field}
                            />
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="admin_first_name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className={fieldLabelClass}>Tu nombre</FormLabel>
                          <FormControl>
                            <Input className={glassInputClass} {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="admin_last_name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className={fieldLabelClass}>Tu apellido</FormLabel>
                          <FormControl>
                            <Input className={glassInputClass} {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  <FormField
                    control={form.control}
                    name="admin_email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className={fieldLabelClass}>Tu correo electrónico</FormLabel>
                        <FormControl>
                          <Input
                            type="email"
                            placeholder="tu@ejemplo.com"
                            className={glassInputClass}
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="admin_password"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className={fieldLabelClass}>Contraseña</FormLabel>
                        <FormControl>
                          <Input type="password" placeholder="••••••••" className={glassInputClass} {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <Button
                    type="submit"
                    size="lg"
                    className="mt-1 h-12 w-full rounded-xl text-base"
                    disabled={registerGym.isPending}
                  >
                    <Rocket className="size-5" />
                    {registerGym.isPending ? "Creando tu gimnasio…" : "Crear mi gimnasio"}
                  </Button>

                  <p className="text-center text-sm text-muted-foreground">
                    ¿Ya tienes una cuenta?{" "}
                    <Link href="/login" className="font-medium text-foreground hover:underline">
                      Inicia sesión
                    </Link>
                  </p>
                </form>
              </Form>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  )
}
