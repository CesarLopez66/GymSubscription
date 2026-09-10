"use client"

import * as React from "react"
import Image from "next/image"
import Link from "next/link"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { z } from "zod"
import { motion } from "framer-motion"
import { ArrowLeft, MailCheck } from "lucide-react"

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
import { useForgotPassword } from "@/hooks/use-auth"

const forgotSchema = z.object({
  email: z.string().email("Ingresa un correo válido"),
})

type ForgotValues = z.infer<typeof forgotSchema>

const glassInputClass =
  "h-12 rounded-xl border-white/15 bg-white/5 text-base backdrop-blur-sm placeholder:text-muted-foreground/60 md:text-base"
const fieldLabelClass = "text-sm font-medium text-foreground/90 lg:text-base"

export default function ForgotPasswordPage() {
  const forgotPassword = useForgotPassword()
  const [sent, setSent] = React.useState(false)
  const form = useForm<ForgotValues>({
    resolver: zodResolver(forgotSchema),
    defaultValues: { email: "" },
  })

  const onSubmit = (values: ForgotValues) => {
    forgotPassword.mutate(values, {
      // Always shows the same "revisa tu correo" outcome, success or not —
      // the backend never reveals whether the email matched an account, so
      // the UI can't either.
      onSettled: () => setSent(true),
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
            <CardTitle className="text-center text-2xl">¿Olvidaste tu contraseña?</CardTitle>
          </CardHeader>
          <CardContent>
            {sent ? (
              <div className="flex flex-col items-center gap-4 py-2 text-center">
                <span className="flex size-14 items-center justify-center rounded-full bg-primary/15 text-primary">
                  <MailCheck className="size-7" />
                </span>
                <p className="text-sm text-muted-foreground">
                  Si <span className="font-medium text-foreground">{form.getValues("email")}</span>{" "}
                  corresponde a una cuenta, te enviamos un enlace para restablecer tu contraseña.
                </p>
                <Link href="/login" className={buttonVariants({ variant: "outline", className: "mt-2" })}>
                  <ArrowLeft className="size-4" />
                  Volver a iniciar sesión
                </Link>
              </div>
            ) : (
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-5">
                  <p className="text-sm text-muted-foreground">
                    Ingresa tu correo y te enviaremos un enlace para restablecer tu contraseña.
                  </p>
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
                  <Button
                    type="submit"
                    size="lg"
                    className="h-12 w-full rounded-xl text-base"
                    disabled={forgotPassword.isPending}
                  >
                    {forgotPassword.isPending ? "Enviando…" : "Enviar enlace"}
                  </Button>
                  <Link
                    href="/login"
                    className="flex items-center justify-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
                  >
                    <ArrowLeft className="size-3.5" />
                    Volver a iniciar sesión
                  </Link>
                </form>
              </Form>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </div>
  )
}
