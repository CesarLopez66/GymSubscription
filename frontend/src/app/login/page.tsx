"use client"

import * as React from "react"
import Image from "next/image"
import Link from "next/link"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { z } from "zod"
import { AnimatePresence, motion } from "framer-motion"
import { Activity, Building2, Dumbbell, Eye, EyeOff, Flame, ScanLine } from "lucide-react"

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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { ApiError } from "@/lib/api-client"
import { cn } from "@/lib/utils"
import { Logo } from "@/components/shared/logo"
import { useLogin } from "@/hooks/use-auth"
import { usePublicGyms } from "@/hooks/use-gyms"
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

// Shared glass look for the inputs and the labels above them — bigger and
// more transparent than the default form controls elsewhere in the app,
// to match the frosted card sitting on top of the hero photo.
const glassInputClass =
  "h-12 rounded-xl border-white/15 bg-white/5 text-base backdrop-blur-sm placeholder:text-muted-foreground/60 md:text-base"
const fieldLabelClass = "text-sm font-medium text-foreground/90 lg:text-base"

export default function LoginPage() {
  const login = useLogin()
  const { data: gyms } = usePublicGyms()
  const gymItems = (gyms ?? []).map((g) => ({ value: g.subdomain, label: g.name }))
  const [showPassword, setShowPassword] = React.useState(false)
  const [gymPickerOpen, setGymPickerOpen] = React.useState(false)
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

      <div className="relative grid w-full max-w-6xl gap-12 lg:grid-cols-2 lg:items-center lg:gap-16">
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className="hidden flex-col gap-8 lg:flex"
        >
          <Logo size="2xl" />
          <p className="text-lg text-muted-foreground">
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
                className="flex items-center gap-4 rounded-2xl border border-white/10 bg-card/50 px-4 py-3.5 text-base font-medium shadow-lg shadow-black/20 backdrop-blur-md"
              >
                <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/20 text-primary">
                  <Icon className="size-5" />
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
          <Card className="w-full border-white/15 bg-card/70 shadow-2xl shadow-black/50 ring-1 ring-white/10 backdrop-blur-xl [--card-spacing:--spacing(7)] lg:[--card-spacing:--spacing(8)]">
            <CardHeader>
              <div className="mb-2 lg:hidden">
                <Logo size="lg" />
              </div>
              <CardTitle className="text-center text-2xl lg:text-3xl">Inicia sesión</CardTitle>
            </CardHeader>
            <CardContent>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-5">
                  <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className={fieldLabelClass}>Correo electrónico</FormLabel>
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
                    name="password"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className={fieldLabelClass}>Contraseña</FormLabel>
                        <div className="relative">
                          <FormControl>
                            <Input
                              type={showPassword ? "text" : "password"}
                              placeholder="••••••••"
                              className={cn(glassInputClass, "pr-11")}
                              {...field}
                            />
                          </FormControl>
                          <button
                            type="button"
                            onClick={() => setShowPassword((v) => !v)}
                            className="absolute top-1/2 right-1 flex size-9 -translate-y-1/2 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:text-foreground"
                            aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                          >
                            {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                          </button>
                        </div>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <Link
                    href="/forgot-password"
                    className="-mt-2 self-end text-sm text-muted-foreground transition-colors hover:text-foreground"
                  >
                    ¿Olvidaste tu contraseña?
                  </Link>

                  <AnimatePresence mode="wait" initial={false}>
                    {!gymPickerOpen ? (
                      <motion.button
                        key="gym-picker-trigger"
                        type="button"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.15 }}
                        onClick={() => setGymPickerOpen(true)}
                        className="flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
                      >
                        <Building2 className="size-3.5" />
                        Elegir gimnasio
                      </motion.button>
                    ) : (
                      <motion.div
                        key="gym-picker-field"
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.2, ease: "easeOut" }}
                        className="overflow-hidden"
                      >
                        <FormField
                          control={form.control}
                          name="gym_subdomain"
                          render={({ field }) => (
                            <FormItem>
                              <div className="flex items-center justify-between">
                                <FormLabel className={fieldLabelClass}>Gimnasio</FormLabel>
                                <button
                                  type="button"
                                  onClick={() => {
                                    field.onChange("")
                                    setGymPickerOpen(false)
                                  }}
                                  className="text-xs text-muted-foreground hover:text-foreground"
                                >
                                  Quitar
                                </button>
                              </div>
                              <Select
                                items={gymItems}
                                value={field.value}
                                onValueChange={(value) => field.onChange(value ?? "")}
                              >
                                <FormControl>
                                  <SelectTrigger className={cn(glassInputClass, "w-full justify-between")}>
                                    <SelectValue placeholder="Selecciona tu gimnasio" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  {gymItems.map((item) => (
                                    <SelectItem key={item.value} value={item.value}>
                                      {item.label}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </motion.div>
                    )}
                  </AnimatePresence>
                  <Button
                    type="submit"
                    size="lg"
                    className="mt-1 h-12 w-full rounded-xl text-base"
                    disabled={login.isPending}
                  >
                    <Activity className="size-5" />
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
