"use client"

import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"

import { formatCurrency } from "@/lib/currency"
import type { RevenueByDay } from "@/lib/types"
import { localDateKey } from "@/lib/week"

type Bucket = { key: string; label: string; amount: number }

const DAY_LABEL = new Intl.DateTimeFormat("es-BO", { day: "numeric", month: "short" })
const MONTH_LABEL = new Intl.DateTimeFormat("es-BO", { month: "short" })

function shortLabel(fmt: Intl.DateTimeFormat, date: Date) {
  return fmt.format(date).replace(/\./g, "").replace("sept", "sep")
}

/**
 * Groups the per-(day, gym) rows into one bar per day (7/30-day ranges),
 * per week (90 days) or per month (1 year) — enough bars to read a trend
 * without a 365-bar comb. Empty days still get a bar so gaps read as gaps.
 */
function bucketize(rows: RevenueByDay[], days: number): Bucket[] {
  const byDay = new Map<string, number>()
  for (const row of rows) {
    const key = row.date.slice(0, 10)
    byDay.set(key, (byDay.get(key) ?? 0) + Number(row.amount))
  }

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const buckets = new Map<string, Bucket>()

  for (let i = days - 1; i >= 0; i--) {
    const day = new Date(today)
    day.setDate(today.getDate() - i)
    const amount = byDay.get(localDateKey(day)) ?? 0
    let key: string
    let label: string
    if (days <= 31) {
      key = localDateKey(day)
      label = shortLabel(DAY_LABEL, day)
    } else if (days <= 120) {
      const monday = new Date(day)
      monday.setDate(day.getDate() - ((day.getDay() + 6) % 7))
      key = localDateKey(monday)
      label = shortLabel(DAY_LABEL, monday)
    } else {
      key = `${day.getFullYear()}-${day.getMonth()}`
      label = shortLabel(MONTH_LABEL, day)
    }
    const bucket = buckets.get(key) ?? { key, label, amount: 0 }
    bucket.amount += amount
    buckets.set(key, bucket)
  }
  return [...buckets.values()]
}

const compact = new Intl.NumberFormat("es-BO", { notation: "compact", maximumFractionDigits: 1 })

export function RevenueChart({ data, days }: { data: RevenueByDay[]; days: number }) {
  const buckets = bucketize(data, days)
  const hasData = buckets.some((b) => b.amount > 0)

  if (!hasData) {
    return (
      <div className="grid h-56 place-items-center rounded-xl bg-muted/40 text-sm text-muted-foreground">
        Sin cobros registrados en este periodo.
      </div>
    )
  }

  return (
    <div className="h-56">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={buckets} margin={{ top: 8, right: 0, bottom: 0, left: 0 }}>
          <CartesianGrid vertical={false} stroke="var(--border)" />
          <XAxis
            dataKey="label"
            tickLine={false}
            axisLine={false}
            tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
            interval="preserveStartEnd"
            minTickGap={12}
          />
          <YAxis
            width={44}
            tickLine={false}
            axisLine={false}
            tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
            tickFormatter={(v: number) => compact.format(v)}
          />
          <Tooltip
            cursor={{ fill: "var(--foreground)", fillOpacity: 0.04 }}
            contentStyle={{
              background: "var(--popover)",
              border: "1px solid var(--border)",
              borderRadius: 12,
              color: "var(--popover-foreground)",
            }}
            labelStyle={{ color: "var(--muted-foreground)" }}
            formatter={(value) => [formatCurrency(Number(value)), "Cobrado"]}
          />
          <Bar dataKey="amount" radius={[6, 6, 2, 2]} maxBarSize={48}>
            {buckets.map((b, i) => (
              <Cell key={b.key} fill="var(--primary)" fillOpacity={i === buckets.length - 1 ? 1 : 0.5} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
