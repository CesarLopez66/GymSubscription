import uuid
from datetime import date, datetime

from pydantic import BaseModel, ConfigDict, Field

from app.models.enums import ActivityLevel, FitnessGoal


class NutritionPlanGenerateRequest(BaseModel):
    """Input used to auto-calculate a nutrition plan via the prescriptive algorithm."""

    user_id: uuid.UUID
    weight_kg: float = Field(gt=0, le=500)
    height_cm: float = Field(gt=0, le=300)
    age: int = Field(gt=0, le=120)
    activity_level: ActivityLevel
    fitness_goal: FitnessGoal
    # When provided, BMR is computed with Katch-McArdle (lean-mass based)
    # instead of Mifflin-St Jeor.
    body_fat_percentage: float | None = Field(default=None, ge=3, le=60)
    start_date: date = Field(default_factory=date.today)
    end_date: date | None = None
    notes: str | None = None


class NutritionPlanCreate(BaseModel):
    """Direct manual creation of a nutrition plan, bypassing auto-calculation."""

    user_id: uuid.UUID
    fitness_goal: FitnessGoal
    bmr: float = Field(gt=0)
    bmr_formula: str = Field(default="manual", max_length=20)
    tdee: float = Field(gt=0)
    calories: int = Field(gt=0)
    protein_g: int = Field(ge=0)
    carbs_g: int = Field(ge=0)
    fats_g: int = Field(ge=0)
    water_ml: int = Field(gt=0)
    start_date: date = Field(default_factory=date.today)
    end_date: date | None = None
    notes: str | None = None


class NutritionPlanUpdate(BaseModel):
    calories: int | None = Field(default=None, gt=0)
    protein_g: int | None = Field(default=None, ge=0)
    carbs_g: int | None = Field(default=None, ge=0)
    fats_g: int | None = Field(default=None, ge=0)
    water_ml: int | None = Field(default=None, gt=0)
    end_date: date | None = None
    is_active: bool | None = None
    notes: str | None = None


class WorkoutTemplateRecommendationRead(BaseModel):
    name: str
    sessions_per_week: int
    focus_areas: list[str]
    description: str


class NutritionPlanRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    gym_id: uuid.UUID
    user_id: uuid.UUID
    created_by_id: uuid.UUID | None
    fitness_goal: FitnessGoal
    bmr: float
    bmr_formula: str
    tdee: float
    calories: int
    protein_g: int
    carbs_g: int
    fats_g: int
    water_ml: int
    start_date: date
    end_date: date | None
    is_active: bool
    notes: str | None
    created_at: datetime
    updated_at: datetime


class NutritionPlanGenerateResponse(NutritionPlanRead):
    """The generated plan plus an advisory workout template — the template
    itself isn't persisted; a trainer turns it into a real WorkoutPlan via
    POST /workouts/assign."""

    recommended_workout_template: WorkoutTemplateRecommendationRead
