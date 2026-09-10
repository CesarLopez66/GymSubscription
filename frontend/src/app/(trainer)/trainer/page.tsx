"use client"

import * as React from "react"
import { useRouter } from "next/navigation"

export default function TrainerHomePage() {
  const router = useRouter()

  React.useEffect(() => {
    router.replace("/trainer/clients")
  }, [router])

  return null
}
