"use client"

import { X } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

const HEX_PATTERN = /^#[0-9a-fA-F]{6}$/

/** Hex color picker (swatch + manual text entry) used for a gym's brand
 * colors. `value` is undefined/empty when the gym uses the app's default
 * theme for that color. */
export function ColorInput({
  label,
  value,
  onChange,
  fallback = "#7c3aed",
}: {
  label: string
  value: string | undefined
  onChange: (value: string | undefined) => void
  fallback?: string
}) {
  return (
    <div className="grid gap-2">
      <p className="text-sm font-medium">{label}</p>
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={value && HEX_PATTERN.test(value) ? value : fallback}
          onChange={(e) => onChange(e.target.value)}
          className="size-9 shrink-0 cursor-pointer rounded-md border bg-transparent p-0.5"
          aria-label={label}
        />
        <Input
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value || undefined)}
          placeholder="Color por defecto"
          className="font-mono uppercase"
          maxLength={7}
        />
        {value && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => onChange(undefined)}
            title="Usar color por defecto"
          >
            <X className="size-4" />
          </Button>
        )}
      </div>
    </div>
  )
}
