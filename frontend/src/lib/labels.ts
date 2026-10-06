import type {
  ActivityLevel,
  DayOfWeek,
  DiscountType,
  FitnessGoal,
  GymStatus,
  PaymentMethod,
  PaymentStatus,
  PaymentType,
  SaaSPlanTier,
  SubscriptionRequestStatus,
  SubscriptionStatus,
  UserRole,
} from "@/lib/types"

// Etiquetas en español para valores de la API. Los valores en sí (las claves)
// permanecen en inglés porque son el contrato con el backend/BD.

export const ROLE_LABELS: Record<UserRole, string> = {
  SUPERADMIN: "Super administrador",
  GYM_ADMIN: "Administrador de gimnasio",
  BRANCH_MANAGER: "Encargado de sucursal",
  TRAINER: "Entrenador",
  NUTRITIONIST: "Nutricionista",
  MEMBER: "Miembro",
}

export const GYM_STATUS_LABELS: Record<GymStatus, string> = {
  TRIAL: "Prueba",
  ACTIVE: "Activo",
  SUSPENDED: "Suspendido",
  CANCELLED: "Cancelado",
}

export const PLAN_TIER_LABELS: Record<SaaSPlanTier, string> = {
  FREE: "Gratis",
  BASIC: "Básico",
  PRO: "Pro",
  ENTERPRISE: "Empresarial",
}

export const SUBSCRIPTION_REQUEST_STATUS_LABELS: Record<SubscriptionRequestStatus, string> = {
  PENDING: "Pendiente",
  APPROVED: "Aprobada",
  REJECTED: "Rechazada",
}

export const SUBSCRIPTION_STATUS_LABELS: Record<SubscriptionStatus, string> = {
  ACTIVE: "Activa",
  EXPIRED: "Vencida",
  CANCELLED: "Cancelada",
  PENDING: "Pendiente",
}

export const DISCOUNT_TYPE_LABELS: Record<DiscountType, string> = {
  PERCENTAGE: "Porcentaje",
  FIXED_AMOUNT: "Monto fijo",
}

export const FITNESS_GOAL_LABELS: Record<FitnessGoal, string> = {
  FAT_LOSS: "Pérdida de grasa",
  MUSCLE_GAIN: "Ganancia muscular",
  MAINTENANCE: "Mantenimiento",
  REHAB: "Rehabilitación",
}

export const ACTIVITY_LEVEL_LABELS: Record<ActivityLevel, string> = {
  SEDENTARY: "Sedentario",
  LIGHT: "Actividad ligera",
  MODERATE: "Actividad moderada",
  ACTIVE: "Activo",
  VERY_ACTIVE: "Muy activo",
}

export const DAY_LABELS: Record<DayOfWeek, string> = {
  MONDAY: "Lunes",
  TUESDAY: "Martes",
  WEDNESDAY: "Miércoles",
  THURSDAY: "Jueves",
  FRIDAY: "Viernes",
  SATURDAY: "Sábado",
  SUNDAY: "Domingo",
}

export const DAY_LABELS_SHORT: Record<DayOfWeek, string> = {
  MONDAY: "Lun",
  TUESDAY: "Mar",
  WEDNESDAY: "Mié",
  THURSDAY: "Jue",
  FRIDAY: "Vie",
  SATURDAY: "Sáb",
  SUNDAY: "Dom",
}

export const PAYMENT_TYPE_LABELS: Record<PaymentType, string> = {
  MEMBERSHIP: "Membresía",
  RETAIL: "Tienda",
  OTHER: "Otro",
}

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  QR: "Código QR",
  CASH: "Efectivo",
  CARD: "Tarjeta",
  TRANSFER: "Transferencia",
  OTHER: "Otro",
}

export const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
  PENDING: "Pendiente",
  COMPLETED: "Completado",
  REFUNDED: "Reembolsado",
  FAILED: "Fallido",
}
