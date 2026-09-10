"use client"

import * as React from "react"
import Image from "next/image"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { z } from "zod"
import { toast } from "sonner"
import { motion } from "framer-motion"
import { CheckCircle2, Eye, EyeOff } from "lucide-react"

import { Button, buttonVariants } from "@/components/ui/button"
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
import { Logo } from "@/components/shared/logo"
import { ApiError } from "@/lib/api-client"
import { cn } from "@/lib/utils"
import { useResetPassword } from "@/hooks/use-auth"

const resetSchema = z.object({
  new_password: z.string().min(8, "Debe tener al menos 8 caracteres"),
})

type ResetValues = z.infer<typeof resetSchema>

const glassInputClass =
  "h-12 rounded-xl border-white/15 bg-white/5 text-base backdrop-blur-sm placeholder:text-muted-foreground/60 md:text-base"
const fieldLabelClass = "text-sm font-medium text-foreground/90 lg:text-base"

export default function ResetPasswordPage() {
  return (
    <React.Suspense fallback={null}>
      <ResetPasswordForm />
    </React.Suspense>
  )
}

function ResetPasswordForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const token = searchParams.get("token")
  const resetPassword = useResetPassword()
  const [showPassword, setShowPassword] = React.useState(false)
  const [done, setDone] = React.useState(false)

  const form = useForm<ResetValues>({
    resolver: zodResolver(resetSchema),
    defaultValues: { new_password: "" },
  })

  const onSubmit = (values: ResetValues) => {
    if (!token) return
    resetPassword.mutate(
      { token, new_password: values.new_password },
      {
        onSuccess: () => setDone(true),
        onError: (error) =>
          toast.error(
            error instanceof ApiError ? error.detail : "No se pudo restablecer la contraseña"
          ),
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
      <div className="absolute inset-0 bg-linear-to-b from-background/85 via-background/75 to-background" />
      <div className="bg-gym-radial pointer-events-none absolute inset-0" />

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: "easeOut" }}
        className="relative w-full max-w-md"
      >
        <Card className="w-full border-white/15 bg-card/70 shadow-2xl shadow-black/50 ring-1 ring-white/10 backdrop-blur-xl [--card-spacing:--spacing(7)] lg:[--card-spacing:--spacing(8)]">
          <CardHeader>
            <div className="mb-2 flex justify-center">
              <Logo size="lg" />
            </div>
            <CardTitle className="text-center text-2xl">Restablecer contraseña</CardTitle>
          </CardHeader>
          <CardContent>
            {!token ? (
              <div className="flex flex-col items-center gap-4 py-2 text-center">
                <p className="text-sm text-muted-foreground">
                  Este enlace no es válido. Solicita uno nuevo desde la pantalla de inicio de
                  sesión.
                </p>
                <Link href="/forgot-password" className={buttonVariants({ className: "mt-1" })}>
                  Solicitar enlace
                </Link>
              </div>
            ) : done ? (
              <div className="flex flex-col items-center gap-4 py-2 text-center">
                <span className="flex size-14 items-center justify-center rounded-full bg-primary/15 text-primary">
                  <CheckCircle2 className="size-7" />
                </span>
                <p className="text-sm text-muted-foreground">
                  Tu contraseña se actualizó. Ya puedes iniciar sesión con la nueva.
                </p>
                <Button onClick={() => router.push("/login")} className="mt-1">
                  Ir a iniciar sesión
                </Button>
              </div>
            ) : (
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-5">
                  <FormField
                    control={form.control}
                    name="new_password"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className={fieldLabelClass}>Nueva contraseña</FormLabel>
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
                  <Button
                    type="submit"
                    size="lg"
                    className="h-12 w-full rounded-xl text-base"
                    disabled={resetPassword.isPending}
                  >
                    {resetPassword.isPending ? "Guardando…" : "Guardar nueva contraseña"}
                  </Button>
                </form>
              </Form>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </div>
  )
}
