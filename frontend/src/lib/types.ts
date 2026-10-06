export type UserRole =
  | "SUPERADMIN"
  | "GYM_ADMIN"
  | "BRANCH_MANAGER"
  | "TRAINER"
  | "NUTRITIONIST"
  | "MEMBER"
export type GymStatus = "TRIAL" | "ACTIVE" | "SUSPENDED" | "CANCELLED"
export type SaaSPlanTier = "FREE" | "BASIC" | "PRO" | "ENTERPRISE"
export type SubscriptionStatus = "ACTIVE" | "EXPIRED" | "CANCELLED" | "PENDING"
export type DiscountType = "PERCENTAGE" | "FIXED_AMOUNT"
export type Sex = "MALE" | "FEMALE"
export type FitnessGoal = "FAT_LOSS" | "MUSCLE_GAIN" | "MAINTENANCE" | "REHAB"
export type ActivityLevel = "SEDENTARY" | "LIGHT" | "MODERATE" | "ACTIVE" | "VERY_ACTIVE"
export type DayOfWeek =
  | "MONDAY"
  | "TUESDAY"
  | "WEDNESDAY"
  | "THURSDAY"
  | "FRIDAY"
  | "SATURDAY"
  | "SUNDAY"
export type PaymentType = "MEMBERSHIP" | "RETAIL" | "OTHER"
export type PaymentMethod = "QR" | "CASH" | "CARD" | "TRANSFER" | "OTHER"
export type PaymentStatus = "PENDING" | "COMPLETED" | "REFUNDED" | "FAILED"

export interface Page<T> {
  items: T[]
  total: number
  page: number
  page_size: number
  pages: number
}

export interface Gym {
  id: string
  name: string
  subdomain: string
  status: GymStatus
  plan_tier: SaaSPlanTier
  contact_email: string
  contact_phone: string | null
  address: string | null
  payment_qr_image: string | null
  primary_color: string | null
  secondary_color: string | null
  trial_ends_at: string | null
  subscription_ends_at: string | null
  created_at: string
  updated_at: string
}

export type SubscriptionRequestStatus = "PENDING" | "APPROVED" | "REJECTED"

export interface GymSubscriptionPayment {
  id: string
  gym_id: string
  requested_plan_tier: SaaSPlanTier
  amount: string
  proof_image: string
  status: SubscriptionRequestStatus
  rejection_reason: string | null
  reviewed_by_id: string | null
  created_at: string
  updated_at: string
}

export interface GymSubscriptionPaymentWithGym extends GymSubscriptionPayment {
  gym_name: string
}

export interface User {
  id: string
  gym_id: string | null
  branch_id: string | null
  email: string
  roles: UserRole[]
  first_name: string
  last_name: string
  phone: string | null
  date_of_birth: string | null
  sex: Sex | null
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface Branch {
  id: string
  gym_id: string
  name: string
  address: string | null
  phone: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface Membership {
  id: string
  gym_id: string
  name: string
  description: string | null
  price: string
  duration_days: number
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface Promotion {
  id: string
  gym_id: string
  membership_id: string | null
  name: string
  description: string | null
  discount_type: DiscountType
  discount_value: string
  start_date: string
  end_date: string
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface MemberSubscription {
  id: string
  gym_id: string
  user_id: string
  membership_id: string
  branch_id: string | null
  start_date: string
  end_date: string
  status: SubscriptionStatus
  created_at: string
  updated_at: string
}

export interface CheckIn {
  id: string
  gym_id: string
  user_id: string
  branch_id: string | null
  timestamp: string
  access_granted: boolean
  denial_reason: string | null
}

export interface PhysicalEvaluation {
  id: string
  gym_id: string
  user_id: string
  branch_id: string | null
  evaluated_by_id: string | null
  weight_kg: number
  height_cm: number
  body_fat_percentage: number | null
  fitness_goal: FitnessGoal
  activity_level: ActivityLevel
  age: number | null
  notes: string | null
  evaluated_at: string
  created_at: string
}

export interface Exercise {
  id: string
  gym_id: string | null
  name: string
  description: string | null
  muscle_group: string
  equipment: string | null
  video_url: string | null
  created_at: string
  updated_at: string
}

export interface WorkoutPlanItem {
  id: string
  workout_plan_id: string
  exercise_id: string
  day_of_week: DayOfWeek
  sets: number
  reps: number
  rpe: number | null
  rest_seconds: number | null
  order: number
  notes: string | null
  exercise: Exercise
}

export interface WorkoutPlan {
  id: string
  gym_id: string
  user_id: string
  branch_id: string | null
  created_by_id: string | null
  name: string
  fitness_goal: FitnessGoal
  start_date: string
  end_date: string | null
  is_active: boolean
  created_at: string
  updated_at: string
  items: WorkoutPlanItem[]
}

export interface NutritionPlan {
  id: string
  gym_id: string
  user_id: string
  branch_id: string | null
  created_by_id: string | null
  fitness_goal: FitnessGoal
  bmr: number
  bmr_formula: string
  tdee: number
  calories: number
  protein_g: number
  carbs_g: number
  fats_g: number
  water_ml: number
  start_date: string
  end_date: string | null
  is_active: boolean
  notes: string | null
  created_at: string
  updated_at: string
}

export interface WorkoutTemplateRecommendation {
  name: string
  sessions_per_week: number
  focus_areas: string[]
  description: string
}

export interface NutritionPlanGenerateResponse extends NutritionPlan {
  recommended_workout_template: WorkoutTemplateRecommendation
}

export interface Payment {
  id: string
  gym_id: string
  user_id: string | null
  subscription_id: string | null
  branch_id: string | null
  processed_by_id: string | null
  membership_id: string | null
  payment_type: PaymentType
  payment_method: PaymentMethod
  status: PaymentStatus
  amount: string
  currency: string
  description: string | null
  reference: string | null
  proof_image: string | null
  rejection_reason: string | null
  created_at: string
  updated_at: string
}

export interface Notification {
  id: string
  kind: string
  title: string
  body: string
  related_id: string | null
  read_at: string | null
  created_at: string
}

export interface RecentPayment {
  id: string
  gym_id: string
  gym_name: string
  user_email: string | null
  payment_type: PaymentType
  payment_method: PaymentMethod
  status: PaymentStatus
  amount: string
  currency: string
  created_at: string
}

export interface RevenueByDay {
  date: string
  gym_id: string
  gym_name: string
  amount: number
}

export interface GymBreakdown {
  gym_id: string
  gym_name: string
  status: GymStatus
  plan_tier: SaaSPlanTier
  users_total: number
  users_by_role: Partial<Record<UserRole, number>>
  branches_total: number
  active_subscriptions: number
  revenue_period: number
  platform_revenue_period: number
  payments_count_period: number
  checkins_period: number
  checkins_trend_pct: number | null
  expiring_subscriptions_7d: number
  failed_payments_period: number
  is_at_risk: boolean
  is_trial_expired: boolean
}

export interface PlatformOverview {
  gyms_total: number
  gyms_active: number
  gyms_trial: number
  gyms_suspended: number
  gyms_cancelled: number
  users_total: number
  users_by_role: Partial<Record<UserRole, number>>
  revenue_total: number
  active_subscriptions: number
  checkins_last_30d: number
  recent_payments: RecentPayment[]
  // Scoped to the `days` window passed to GET /superadmin/overview.
  period_days: number
  period_revenue: number
  period_payments_count: number
  period_checkins: number
  revenue_by_day: RevenueByDay[]
  gyms_breakdown: GymBreakdown[]
  platform_revenue_period: number
}

export interface GymDetail {
  gym: Gym
  users_total: number
  users_by_role: Partial<Record<UserRole, number>>
  revenue_total: number
  active_subscriptions: number
  checkins_last_30d: number
  branches_total: number
  branches: Branch[]
  recent_users: User[]
  recent_payments: RecentPayment[]
  subscription_payments: GymSubscriptionPayment[]
}

export interface TokenPair {
  access_token: string
  refresh_token: string
  token_type: string
}

export interface GymChoice {
  subdomain: string
  name: string
}

export interface LoginChoicesResponse {
  requires_gym_selection: true
  gyms: GymChoice[]
}
