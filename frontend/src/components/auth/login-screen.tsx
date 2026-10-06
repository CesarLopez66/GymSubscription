"use client"

import * as React from "react"
import Image from "next/image"
import Link from "next/link"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { z } from "zod"
import { motion } from "framer-motion"
import {
  ArrowRight,
  Building2,
  ChevronLeft,
  Dumbbell,
  Eye,
  EyeOff,
  Flame,
  ScanLine,
} from "lucide-react"

import { Button } from "@/components/ui/button"
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
import { cn } from "@/lib/utils"
import { Logo } from "@/components/shared/logo"
import { useLogin } from "@/hooks/use-auth"
import { toast } from "sonner"

const loginSchema = z.object({
  email: z.string().email("Ingresa un correo válido"),
  password: z.string().min(1, "La contraseña es obligatoria"),
})

type LoginValues = z.infer<typeof loginSchema>

const FEATURES = [
  { icon: ScanLine, label: "Check-in con QR en segundos" },
  { icon: Dumbbell, label: "Rutinas y evaluaciones físicas por entrenador" },
  { icon: Flame, label: "Planes de nutrición con macros" },
]

// Shared glass look for the inputs and the labels above them — bigger and
// more transparent than the default form controls elsewhere in the app,
// to match the frosted card sitting on top of the hero photo.
const glassInputClass =
  "h-12 rounded-2xl border-white/14 bg-white/5 text-base backdrop-blur-sm placeholder:text-muted-foreground/70 md:text-[15px]"
const fieldLabelClass = "text-sm font-medium text-foreground/90"

export function LoginScreen() {
  const login = useLogin()
  const [showPassword, setShowPassword] = React.useState(false)
  const form = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  })

  // Only set once the backend can't tell which of >1 accounts this
  // email+password belongs to — every choice it returns (including the
  // platform account) is shown as-is, since there's a single login door
  // now and the role each account has is what decides where it lands.
  const gymChoices = login.data?.status === "choose_gym" ? login.data.gyms : null

  const submitWithGym = React.useCallback(
    (gym_subdomain?: string) => {
      const { email, password } = form.getValues()
      login.mutate(
        { email, password, gym_subdomain },
        {
          onError: (error) => {
            toast.error(error instanceof ApiError ? error.detail : "No se pudo iniciar sesión")
          },
        }
      )
    },
    [form, login]
  )

  const onSubmit = () => submitWithGym(undefined)

  const showingGymPicker = !!gymChoices && gymChoices.length > 0

  return (
    <div className="relative flex flex-1 flex-col lg:items-center lg:justify-center lg:p-10">
      {/* Escritorio: la foto ocupa todo el fondo, con un velo más denso a la
          izquierda, donde va el texto. */}
      <div className="absolute inset-0 hidden lg:block">
        <Image
          src="/images/login-hero.png"
          alt=""
          fill
          priority
          sizes="100vw"
          className="object-cover object-[center_20%]"
        />
        <div className="absolute inset-0 bg-linear-to-r from-background/96 via-background/82 to-background/55" />
      </div>

      {/* Celular: la foto queda arriba como cabecera y el formulario debajo. */}
      <div className="relative isolate flex h-64 shrink-0 flex-col justify-end gap-3 px-6 pb-5 lg:hidden">
        <Image
          src="/images/login-hero.png"
          alt=""
          fill
          priority
          sizes="100vw"
          className="-z-10 object-cover object-[60%_30%]"
        />
        <div className="absolute inset-0 -z-10 bg-linear-to-b from-background/20 via-background/75 to-background" />
        <Logo size="lg" />
        <p className="text-[15px] leading-snug text-foreground/85">
          Tu membresía, tu rutina y tu acceso al gimnasio en el celular.
        </p>
      </div>

      <div className="relative mx-auto grid w-full max-w-6xl items-center gap-16 lg:grid-cols-[minmax(0,1fr)_420px]">
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className="hidden max-w-xl flex-col gap-8 lg:flex"
        >
          <Logo size="2xl" />
          <div className="flex flex-col gap-3">
            <h1 className="text-[32px] leading-10 font-semibold tracking-tight text-balance">
              Tu gimnasio entero, desde la recepción hasta la rutina de cada miembro.
            </h1>
            <p className="max-w-[46ch] text-base text-foreground/75">
              Membresías, pagos, acceso con QR, entrenamiento y nutrición en una sola plataforma para tu
              equipo y tus miembros.
            </p>
          </div>
          <ul className="flex flex-col gap-4">
            {FEATURES.map(({ icon: Icon, label }, i) => (
              <motion.li
                key={label}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.15 + i * 0.08 }}
                className="flex items-center gap-3 text-[15px]"
              >
                <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/16 text-primary">
                  <Icon className="size-4.5" />
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
          className="flex flex-col gap-5 px-6 pt-6 pb-10 lg:rounded-[28px] lg:bg-card/82 lg:p-10 lg:shadow-2xl lg:shadow-black/40 lg:ring-1 lg:ring-white/10 lg:backdrop-blur-xl"
        >
          <div className="flex flex-col gap-1.5">
            <h2 className="font-heading text-[28px] leading-8 font-semibold lg:text-[32px] lg:leading-9">
              {showingGymPicker ? "Elige tu gimnasio" : "Inicia sesión"}
            </h2>
            <p className="text-sm text-muted-foreground">
              {showingGymPicker
                ? "Tu cuenta está registrada en más de un gimnasio. Elige a cuál quieres entrar."
                : "Entra con el correo que te registró tu gimnasio."}
            </p>
          </div>

          {showingGymPicker ? (
            <div className="grid gap-4">
              <div className="grid gap-2">
                {gymChoices!.map((gym) => (
                  <button
                    key={gym.subdomain}
                    type="button"
                    disabled={login.isPending}
                    onClick={() => submitWithGym(gym.subdomain)}
                    className={cn(
                      glassInputClass,
                      "flex w-full items-center gap-3 border px-4 text-left font-medium transition-colors hover:bg-white/10 disabled:opacity-60"
                    )}
                  >
                    <Building2 className="size-4 shrink-0 text-muted-foreground" />
                    {gym.name}
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={() => login.reset()}
                className="flex items-center gap-1 self-start py-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
              >
                <ChevronLeft className="size-3.5" />
                Volver
              </button>
            </div>
          ) : (
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
                          autoComplete="email"
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
                      <div className="flex items-baseline justify-between gap-3">
                        <FormLabel className={fieldLabelClass}>Contraseña</FormLabel>
                        <Link
                          href="/forgot-password"
                          className="py-1 text-[13px] text-primary transition-colors hover:underline"
                        >
                          ¿La olvidaste?
                        </Link>
                      </div>
                      <div className="relative">
                        <FormControl>
                          <Input
                            type={showPassword ? "text" : "password"}
                            autoComplete="current-password"
                            placeholder="••••••••"
                            className={cn(glassInputClass, "pr-12")}
                            {...field}
                          />
                        </FormControl>
                        <button
                          type="button"
                          onClick={() => setShowPassword((v) => !v)}
                          className="absolute top-1/2 right-1 flex size-10 -translate-y-1/2 items-center justify-center rounded-xl text-muted-foreground transition-colors hover:text-foreground"
                          aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                        >
                          {showPassword ? <EyeOff className="size-4.5" /> : <Eye className="size-4.5" />}
                        </button>
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <Button
                  type="submit"
                  size="lg"
                  className="mt-1 h-12 w-full gap-2 rounded-2xl text-base font-semibold shadow-lg shadow-primary-solid/35"
                  disabled={login.isPending}
                >
                  {login.isPending ? "Iniciando sesión…" : "Iniciar sesión"}
                  {!login.isPending && <ArrowRight className="size-4.5" />}
                </Button>

                <div className="h-px bg-white/8" />

                <p className="text-center text-sm text-muted-foreground">
                  ¿Tu gimnasio todavía no usa GymOps Ai?{" "}
                  <Link href="/register" className="inline-block py-1 font-medium text-primary hover:underline">
                    Regístralo gratis
                  </Link>
                </p>
              </form>
            </Form>
          )}
        </motion.div>
      </div>
    </div>
  )
}
