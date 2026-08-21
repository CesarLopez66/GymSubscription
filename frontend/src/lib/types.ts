export type UserRole = "SUPERADMIN" | "GYM_ADMIN" | "TRAINER" | "NUTRITIONIST" | "MEMBER"
export type GymStatus = "TRIAL" | "ACTIVE" | "SUSPENDED" | "CANCELLED"
export type SaaSPlanTier = "FREE" | "BASIC" | "PRO" | "ENTERPRISE"
export type SubscriptionStatus = "ACTIVE" | "EXPIRED" | "CANCELLED" | "PENDING"
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
export type PaymentMethod = "CASH" | "CARD" | "TRANSFER" | "OTHER"
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
  created_at: string
  updated_at: string
}

export interface User {
  id: string
  gym_id: string | null
  email: string
  role: UserRole
  first_name: string
  last_name: string
  phone: string | null
  date_of_birth: string | null
  sex: Sex | null
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

export interface MemberSubscription {
  id: string
  gym_id: string
  user_id: string
  membership_id: string
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
  timestamp: string
  access_granted: boolean
  denial_reason: string | null
}

export interface PhysicalEvaluation {
  id: string
  gym_id: string
  user_id: string
  evaluated_by_id: string | null
  weight_kg: number
  height_cm: number
  body_fat_percentage: number | null
  fitness_goal: FitnessGoal
  activity_level: ActivityLevel
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
  processed_by_id: string | null
  payment_type: PaymentType
  payment_method: PaymentMethod
  status: PaymentStatus
  amount: string
  currency: string
  description: string | null
  reference: string | null
  created_at: string
  updated_at: string
}

export interface TokenPair {
  access_token: string
  refresh_token: string
  token_type: string
}

export interface ApiErrorBody {
  detail: string
}
