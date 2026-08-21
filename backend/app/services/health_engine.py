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
        name="Circuito de cuerpo completo",
        sessions_per_week=3,
        focus_areas=["ejercicios compuestos", "acondicionamiento metabólico"],
        description="Sesiones de cuerpo completo que combinan superseries de fuerza con "
        "bloques cortos de acondicionamiento; frecuencia moderada acorde a un nivel de "
        "actividad base bajo.",
    ),
    (FitnessGoal.FAT_LOSS, False): WorkoutTemplateRecommendation(
        name="Circuito de cuerpo completo+",
        sessions_per_week=4,
        focus_areas=["ejercicios compuestos", "acondicionamiento metabólico", "volumen accesorio"],
        description="Trabajo de fuerza de cuerpo completo más bloques de acondicionamiento, con "
        "una sesión adicional ya que el miembro tolera una carga de entrenamiento mayor.",
    ),
    (FitnessGoal.MUSCLE_GAIN, True): WorkoutTemplateRecommendation(
        name="Split tren superior/inferior",
        sessions_per_week=4,
        focus_areas=["hipertrofia", "sobrecarga progresiva"],
        description="Sesiones alternadas de tren superior e inferior para construir una "
        "frecuencia de entrenamiento base antes de pasar a un split de mayor volumen.",
    ),
    (FitnessGoal.MUSCLE_GAIN, False): WorkoutTemplateRecommendation(
        name="Empuje/Jalón/Pierna",
        sessions_per_week=6,
        focus_areas=["hipertrofia", "sobrecarga progresiva", "especialización por grupo muscular"],
        description="El clásico split empuje/jalón/pierna repetido dos veces por semana, "
        "para un miembro que ya se recupera bien de entrenamientos frecuentes.",
    ),
    (FitnessGoal.MAINTENANCE, True): WorkoutTemplateRecommendation(
        name="Mantenimiento de cuerpo completo",
        sessions_per_week=3,
        focus_areas=["fuerza general", "movilidad"],
        description="Tres sesiones de cuerpo completo para mantener la fuerza y el "
        "acondicionamiento actuales.",
    ),
    (FitnessGoal.MAINTENANCE, False): WorkoutTemplateRecommendation(
        name="Mantenimiento superior/inferior",
        sessions_per_week=4,
        focus_areas=["fuerza general", "acondicionamiento"],
        description="Split de tren superior/inferior para mantener la fuerza y la capacidad "
        "de trabajo con un volumen semanal sostenible.",
    ),
    (FitnessGoal.REHAB, True): WorkoutTemplateRecommendation(
        name="Enfoque correctivo y de movilidad",
        sessions_per_week=2,
        focus_areas=["movilidad", "estabilidad", "fuerza con tempo controlado"],
        description="Sesiones de baja intensidad y tempo controlado que priorizan el rango de "
        "movimiento y la estabilidad; el progreso lo autoriza el entrenador, no esta plantilla.",
    ),
    (FitnessGoal.REHAB, False): WorkoutTemplateRecommendation(
        name="Enfoque correctivo y de movilidad+",
        sessions_per_week=3,
        focus_areas=["movilidad", "estabilidad", "fuerza con tempo controlado"],
        description="Sesiones de baja intensidad y tempo controlado que priorizan el rango de "
        "movimiento y la estabilidad, con una frecuencia algo mayor dada la actividad base del "
        "miembro; el progreso lo autoriza el entrenador, no esta plantilla.",
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
