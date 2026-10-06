export function daysSince(dateStr: string) {
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / 86_400_000)
}

export function daysUntil(dateStr: string) {
  const ms = new Date(dateStr).setHours(0, 0, 0, 0) - new Date().setHours(0, 0, 0, 0)
  return Math.round(ms / 86_400_000)
}

/** Human-relative past date, e.g. "Hoy", "Ayer", "Hace 3 días", "Hace 2 meses". */
export function formatRelativeDate(dateStr: string) {
  const days = daysSince(dateStr)
  if (days <= 0) return "Hoy"
  if (days === 1) return "Ayer"
  if (days < 7) return `Hace ${days} días`
  if (days < 30) return `Hace ${Math.floor(days / 7)} sem.`
  const months = Math.floor(days / 30)
  return `Hace ${months} ${months === 1 ? "mes" : "meses"}`
}

/** Human-relative future date, e.g. "Hoy", "Mañana", "En 3 días". */
export function formatRelativeFutureDate(dateStr: string) {
  const days = daysUntil(dateStr)
  if (days <= 0) return "Hoy"
  if (days === 1) return "Mañana"
  return `En ${days} días`
}

// Fechas tipo "YYYY-MM-DD" de la API se interpretan como medianoche local, no
// UTC — `new Date("2026-09-14")` es UTC y en Bolivia (UTC-4) se mostraría
// como el 13.
function parseDate(dateStr: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(dateStr) ? new Date(`${dateStr}T00:00:00`) : new Date(dateStr)
}

const SHORT_DATE = new Intl.DateTimeFormat("es-BO", { day: "numeric", month: "short", year: "numeric" })
const DAY_MONTH = new Intl.DateTimeFormat("es-BO", { day: "numeric", month: "short" })
const TIME = new Intl.DateTimeFormat("es-BO", { hour: "2-digit", minute: "2-digit", hourCycle: "h23" })

// Intl devuelve "14 sept 2026" o "14 de sep. de 2026" según el motor; se
// normaliza a "14 sep 2026" para que se vea igual en todos los navegadores.
function tidy(text: string) {
  return text.replace(/\bde\b/g, "").replace(/\./g, "").replace(/sept/g, "sep").replace(/\s+/g, " ").trim()
}

/** "14 sep 2026" */
export function formatDate(dateStr: string) {
  return tidy(SHORT_DATE.format(parseDate(dateStr)))
}

/** "14 sep" */
export function formatDayMonth(dateStr: string) {
  return tidy(DAY_MONTH.format(parseDate(dateStr)))
}

/** "15 ago – 14 sep 2026", o con ambos años si cruza de año. */
export function formatDateRange(startStr: string, endStr: string) {
  const start = parseDate(startStr)
  const end = parseDate(endStr)
  const startLabel = start.getFullYear() === end.getFullYear() ? formatDayMonth(startStr) : formatDate(startStr)
  return `${startLabel} – ${formatDate(endStr)}`
}

/** "Martes 6 de octubre" */
export function formatToday(date = new Date()) {
  const text = date.toLocaleDateString("es-BO", { weekday: "long", day: "numeric", month: "long" })
  return text.charAt(0).toUpperCase() + text.slice(1).replace(",", "")
}

/** "ayer, 18:42" / "hoy, 07:10" / "14 sep, 18:42" */
export function formatRecentDateTime(dateStr: string) {
  const days = daysSince(new Date(dateStr).toDateString())
  const prefix = days <= 0 ? "hoy" : days === 1 ? "ayer" : formatDayMonth(dateStr)
  return `${prefix}, ${TIME.format(new Date(dateStr))}`
}
