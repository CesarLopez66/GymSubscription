"""Prescriptive algorithmic core: energy needs, macros, hydration, and a
starting workout template — everything a trainer/nutritionist needs to seed
a new member's plan from a single evaluation.

Formulas:
- BMR: Katch-McArdle when body fat % is known (more accurate — it's driven
  by lean body mass rather than a population-average build), otherwise
  Mifflin-St Jeor.
- TDEE: BMR scaled by an activity multiplier.
- Calorie target: TDEE adjusted by a fixed percentage for the member's goal.
- Macros: protein set per kg of bodyweight (goal-dependent), fat set as a
  percentage of total calories, carbs fill the remainder.
- Water: a standard 35 ml/kg baseline plus an activity-level top-up.
- Workout template: a starting split + weekly frequency keyed off goal and
  activity level — a sensible default for a trainer to start from and adjust
  in the Workout Engine, not a replacement for individualized programming.
"""

from dataclasses import dataclass, field

from app.models.enums import ActivityLevel, FitnessGoal, Sex

ACTIVITY_MULTIPLIERS: dict[ActivityLevel, float] = {
    ActivityLevel.SEDENTARY: 1.2,
    ActivityLevel.LIGHT: 1.375,
    ActivityLevel.MODERATE: 1.55,
    ActivityLevel.ACTIVE: 1.725,
    ActivityLevel.VERY_ACTIVE: 1.9,
}

# Fraction of TDEE applied as a caloric deficit/surplus per goal.
GOAL_CALORIE_ADJUSTMENT: dict[FitnessGoal, float] = {
    FitnessGoal.FAT_LOSS: -0.20,
    FitnessGoal.MUSCLE_GAIN: 0.10,
    FitnessGoal.MAINTENANCE: 0.0,
    FitnessGoal.REHAB: 0.0,
}

# Grams of protein per kg of bodyweight per goal.
GOAL_PROTEIN_PER_KG: dict[FitnessGoal, float] = {
    FitnessGoal.FAT_LOSS: 2.4,
    FitnessGoal.MUSCLE_GAIN: 2.2,
    FitnessGoal.MAINTENANCE: 1.8,
    FitnessGoal.REHAB: 2.0,  # elevated for tissue repair
}

# Fraction of total daily calories allocated to fat.
FAT_CALORIE_FRACTION = 0.25

PROTEIN_KCAL_PER_G = 4
CARBS_KCAL_PER_G = 4
FAT_KCAL_PER_G = 9

MIN_CALORIES = 1200

# ml of water per kg of bodyweight, before activity adjustment.
WATER_ML_PER_KG = 35

# Extra ml/day layered on top of the baseline per activity level.
ACTIVITY_WATER_TOPUP_ML: dict[ActivityLevel, int] = {
    ActivityLevel.SEDENTARY: 0,
    ActivityLevel.LIGHT: 250,
    ActivityLevel.MODERATE: 500,
    ActivityLevel.ACTIVE: 750,
    ActivityLevel.VERY_ACTIVE: 1000,
}


@dataclass(frozen=True)
class WorkoutTemplateRecommendation:
    name: str
    sessions_per_week: int
    focus_areas: list[str] = field(default_factory=list)
    description: str = ""


# (goal, activity_level) -> template. Activity level is bucketed into
# "lower" (SEDENTARY/LIGHT) and "higher" (MODERATE/ACTIVE/VERY_ACTIVE) since
# that's what actually changes recoverable training frequency.
_LOWER_ACTIVITY = {ActivityLevel.SEDENTARY, ActivityLevel.LIGHT}

_WORKOUT_TEMPLATES: dict[tuple[FitnessGoal, bool], WorkoutTemplateRecommendation] = {
    (FitnessGoal.FAT_LOSS, True): WorkoutTemplateRecommendation(
        name="Full Body Circuit",
        sessions_per_week=3,
        focus_areas=["compound lifts", "metabolic conditioning"],
        description="Full-body sessions combining strength supersets with short conditioning "
        "finishers; frequency kept moderate to match a lower current activity baseline.",
    ),
    (FitnessGoal.FAT_LOSS, False): WorkoutTemplateRecommendation(
        name="Full Body Circuit+",
        sessions_per_week=4,
        focus_areas=["compound lifts", "metabolic conditioning", "accessory volume"],
        description="Full-body strength work plus conditioning finishers, with an extra session "
        "since the member already tolerates a higher training load.",
    ),
    (FitnessGoal.MUSCLE_GAIN, True): WorkoutTemplateRecommendation(
        name="Upper/Lower Split",
        sessions_per_week=4,
        focus_areas=["hypertrophy", "progressive overload"],
        description="Alternating upper/lower sessions to build a base training frequency before "
        "moving to a higher-volume split.",
    ),
    (FitnessGoal.MUSCLE_GAIN, False): WorkoutTemplateRecommendation(
        name="Push/Pull/Legs",
        sessions_per_week=6,
        focus_areas=["hypertrophy", "progressive overload", "muscle group specialization"],
        description="Classic PPL run twice through the week, sized for a member who already "
        "recovers well from frequent training.",
    ),
    (FitnessGoal.MAINTENANCE, True): WorkoutTemplateRecommendation(
        name="Full Body Maintenance",
        sessions_per_week=3,
        focus_areas=["general strength", "mobility"],
        description="Three full-body sessions to maintain current strength and conditioning.",
    ),
    (FitnessGoal.MAINTENANCE, False): WorkoutTemplateRecommendation(
        name="Upper/Lower Maintenance",
        sessions_per_week=4,
        focus_areas=["general strength", "conditioning"],
        description="Upper/lower split to maintain strength and work capacity at a sustainable "
        "weekly volume.",
    ),
    (FitnessGoal.REHAB, True): WorkoutTemplateRecommendation(
        name="Corrective & Mobility Focus",
        sessions_per_week=2,
        focus_areas=["mobility", "stability", "controlled-tempo strength"],
        description="Low-intensity, controlled-tempo sessions prioritizing range of motion and "
        "stability; progress gated by trainer sign-off, not by this template.",
    ),
    (FitnessGoal.REHAB, False): WorkoutTemplateRecommendation(
        name="Corrective & Mobility Focus+",
        sessions_per_week=3,
        focus_areas=["mobility", "stability", "controlled-tempo strength"],
        description="Low-intensity, controlled-tempo sessions prioritizing range of motion and "
        "stability, at a slightly higher frequency given the member's baseline activity level; "
        "progress gated by trainer sign-off, not by this template.",
    ),
}


@dataclass(frozen=True)
class HealthPrescription:
    bmr: float
    bmr_formula: str
    tdee: float
    calories: int
    protein_g: int
    carbs_g: int
    fats_g: int
    water_ml: int
    workout_template: WorkoutTemplateRecommendation


def calculate_bmr_mifflin_st_jeor(
    *, weight_kg: float, height_cm: float, age: int, sex: Sex
) -> float:
    base = (10 * weight_kg) + (6.25 * height_cm) - (5 * age)
    return base + 5 if sex == Sex.MALE else base - 161


def calculate_bmr_katch_mcardle(*, weight_kg: float, body_fat_percentage: float) -> float:
    lean_body_mass_kg = weight_kg * (1 - body_fat_percentage / 100)
    return 370 + (21.6 * lean_body_mass_kg)


def calculate_bmr(
    *,
    weight_kg: float,
    height_cm: float,
    age: int,
    sex: Sex,
    body_fat_percentage: float | None = None,
) -> tuple[float, str]:
    """Returns (bmr, formula_used)."""
    if body_fat_percentage is not None:
        return (
            calculate_bmr_katch_mcardle(weight_kg=weight_kg, body_fat_percentage=body_fat_percentage),
            "katch_mcardle",
        )
    return (
        calculate_bmr_mifflin_st_jeor(weight_kg=weight_kg, height_cm=height_cm, age=age, sex=sex),
        "mifflin_st_jeor",
    )


def calculate_tdee(*, bmr: float, activity_level: ActivityLevel) -> float:
    return bmr * ACTIVITY_MULTIPLIERS[activity_level]


def calculate_macros(
    *, calories: int, weight_kg: float, fitness_goal: FitnessGoal
) -> tuple[int, int, int]:
    protein_g = round(weight_kg * GOAL_PROTEIN_PER_KG[fitness_goal])
    protein_kcal = protein_g * PROTEIN_KCAL_PER_G

    fat_kcal = calories * FAT_CALORIE_FRACTION
    fats_g = round(fat_kcal / FAT_KCAL_PER_G)

    remaining_kcal = max(calories - protein_kcal - (fats_g * FAT_KCAL_PER_G), 0)
    carbs_g = round(remaining_kcal / CARBS_KCAL_PER_G)

    return protein_g, carbs_g, fats_g


def calculate_water_intake_ml(*, weight_kg: float, activity_level: ActivityLevel) -> int:
    return round(weight_kg * WATER_ML_PER_KG) + ACTIVITY_WATER_TOPUP_ML[activity_level]


def select_workout_template(
    *, fitness_goal: FitnessGoal, activity_level: ActivityLevel
) -> WorkoutTemplateRecommendation:
    is_lower_activity = activity_level in _LOWER_ACTIVITY
    return _WORKOUT_TEMPLATES[(fitness_goal, is_lower_activity)]


def generate_health_prescription(
    *,
    weight_kg: float,
    height_cm: float,
    age: int,
    sex: Sex,
    activity_level: ActivityLevel,
    fitness_goal: FitnessGoal,
    body_fat_percentage: float | None = None,
) -> HealthPrescription:
    bmr, bmr_formula = calculate_bmr(
        weight_kg=weight_kg,
        height_cm=height_cm,
        age=age,
        sex=sex,
        body_fat_percentage=body_fat_percentage,
    )
    tdee = calculate_tdee(bmr=bmr, activity_level=activity_level)

    adjustment = GOAL_CALORIE_ADJUSTMENT[fitness_goal]
    calories = max(round(tdee * (1 + adjustment)), MIN_CALORIES)

    protein_g, carbs_g, fats_g = calculate_macros(
        calories=calories, weight_kg=weight_kg, fitness_goal=fitness_goal
    )
    water_ml = calculate_water_intake_ml(weight_kg=weight_kg, activity_level=activity_level)
    workout_template = select_workout_template(
        fitness_goal=fitness_goal, activity_level=activity_level
    )

    return HealthPrescription(
        bmr=round(bmr, 2),
        bmr_formula=bmr_formula,
        tdee=round(tdee, 2),
        calories=calories,
        protein_g=protein_g,
        carbs_g=carbs_g,
        fats_g=fats_g,
        water_ml=water_ml,
        workout_template=workout_template,
    )
