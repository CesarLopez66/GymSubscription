"use client"

import * as React from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { z } from "zod"
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
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { MemberPicker } from "@/components/shared/member-picker"
import { ApiError } from "@/lib/api-client"
import type { ActivityLevel, FitnessGoal } from "@/lib/types"
import { useCreateEvaluation, useEvaluations } from "@/hooks/use-evaluations"

const FITNESS_GOALS: FitnessGoal[] = ["FAT_LOSS", "MUSCLE_GAIN", "MAINTENANCE", "REHAB"]
const ACTIVITY_LEVELS: ActivityLevel[] = [
  "SEDENTARY",
  "LIGHT",
  "MODERATE",
  "ACTIVE",
  "VERY_ACTIVE",
]

const evaluationSchema = z.object({
  weight_kg: z.coerce.number().positive().max(500),
  height_cm: z.coerce.number().positive().max(300),
  body_fat_percentage: z.coerce.number().min(0).max(100).optional(),
  fitness_goal: z.enum(["FAT_LOSS", "MUSCLE_GAIN", "MAINTENANCE", "REHAB"]),
  activity_level: z.enum(["SEDENTARY", "LIGHT", "MODERATE", "ACTIVE", "VERY_ACTIVE"]),
  notes: z.string().optional(),
})

type EvaluationFormValues = z.infer<typeof evaluationSchema>

export default function EvaluationsPage() {
  const [memberId, setMemberId] = React.useState("")
  const { data: evaluations } = useEvaluations(memberId || undefined)
  const createEvaluation = useCreateEvaluation()

  const form = useForm<z.input<typeof evaluationSchema>, unknown, EvaluationFormValues>({
    resolver: zodResolver(evaluationSchema),
    defaultValues: {
      weight_kg: 70,
      height_cm: 170,
      fitness_goal: "MAINTENANCE",
      activity_level: "MODERATE",
      notes: "",
    },
  })

  const onSubmit = (values: EvaluationFormValues) => {
    if (!memberId) {
      toast.error("Select a member first")
      return
    }
    createEvaluation.mutate(
      { ...values, user_id: memberId },
      {
        onSuccess: () => toast.success("Evaluation recorded"),
        onError: (error) =>
          toast.error(error instanceof ApiError ? error.detail : "Could not save evaluation"),
      }
    )
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">Physical evaluations</h1>
      <MemberPicker value={memberId} onChange={setMemberId} />

      {memberId && (
        <div className="grid gap-6 lg:grid-cols-[380px_1fr]">
          <Card>
            <CardHeader>
              <CardTitle>New evaluation</CardTitle>
            </CardHeader>
            <CardContent>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4">
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="weight_kg"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Weight (kg)</FormLabel>
                          <FormControl>
                            <Input type="number" step="0.1" {...field} value={field.value as number} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="height_cm"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Height (cm)</FormLabel>
                          <FormControl>
                            <Input type="number" step="0.1" {...field} value={field.value as number} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  <FormField
                    control={form.control}
                    name="body_fat_percentage"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Body fat % (optional)</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            step="0.1"
                            {...field}
                            value={(field.value as number | undefined) ?? ""}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="fitness_goal"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Fitness goal</FormLabel>
                        <Select value={field.value} onValueChange={field.onChange}>
                          <FormControl>
                            <SelectTrigger className="w-full">
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {FITNESS_GOALS.map((g) => (
                              <SelectItem key={g} value={g}>
                                {g}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="activity_level"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Activity level</FormLabel>
                        <Select value={field.value} onValueChange={field.onChange}>
                          <FormControl>
                            <SelectTrigger className="w-full">
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {ACTIVITY_LEVELS.map((a) => (
                              <SelectItem key={a} value={a}>
                                {a}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="notes"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Notes</FormLabel>
                        <FormControl>
                          <Textarea {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <Button type="submit" disabled={createEvaluation.isPending}>
                    {createEvaluation.isPending ? "Saving…" : "Save evaluation"}
                  </Button>
                </form>
              </Form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>History</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Weight</TableHead>
                    <TableHead>Body fat</TableHead>
                    <TableHead>Goal</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(evaluations?.items ?? []).map((ev) => (
                    <TableRow key={ev.id}>
                      <TableCell className="text-muted-foreground">
                        {new Date(ev.evaluated_at).toLocaleDateString()}
                      </TableCell>
                      <TableCell>{ev.weight_kg} kg</TableCell>
                      <TableCell>
                        {ev.body_fat_percentage != null ? `${ev.body_fat_percentage}%` : "—"}
                      </TableCell>
                      <TableCell>{ev.fitness_goal}</TableCell>
                    </TableRow>
                  ))}
                  {(evaluations?.items?.length ?? 0) === 0 && (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center text-muted-foreground">
                        No evaluations yet.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
