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
