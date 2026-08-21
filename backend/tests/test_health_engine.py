"""Unit tests for the prescriptive health engine (app/services/health_engine.py).

Pure-function tests: no database or network required.
"""

import pytest

from app.models.enums import ActivityLevel, FitnessGoal, Sex
from app.services.health_engine import (
    ACTIVITY_MULTIPLIERS,
    FAT_KCAL_PER_G,
    GOAL_CALORIE_ADJUSTMENT,
    GOAL_PROTEIN_PER_KG,
    MIN_CALORIES,
    PROTEIN_KCAL_PER_G,
    calculate_bmr,
    calculate_bmr_katch_mcardle,
    calculate_bmr_mifflin_st_jeor,
    calculate_macros,
    calculate_tdee,
    calculate_water_intake_ml,
    generate_health_prescription,
    select_workout_template,
)


class TestMifflinStJeor:
    def test_male_formula(self):
        bmr = calculate_bmr_mifflin_st_jeor(weight_kg=80, height_cm=180, age=30, sex=Sex.MALE)
        # 10*80 + 6.25*180 - 5*30 + 5 = 800 + 1125 - 150 + 5 = 1780
        assert bmr == pytest.approx(1780.0)

    def test_female_formula(self):
        bmr = calculate_bmr_mifflin_st_jeor(weight_kg=60, height_cm=165, age=25, sex=Sex.FEMALE)
        # 10*60 + 6.25*165 - 5*25 - 161 = 600 + 1031.25 - 125 - 161 = 1345.25
        assert bmr == pytest.approx(1345.25)

    def test_sex_changes_result(self):
        male = calculate_bmr_mifflin_st_jeor(weight_kg=70, height_cm=170, age=30, sex=Sex.MALE)
        female = calculate_bmr_mifflin_st_jeor(weight_kg=70, height_cm=170, age=30, sex=Sex.FEMALE)
        assert male - female == pytest.approx(166.0)


class TestKatchMcArdle:
    def test_formula(self):
        # weight 80kg, 15% body fat -> lean mass 68kg -> 370 + 21.6*68 = 1838.8
        bmr = calculate_bmr_katch_mcardle(weight_kg=80, body_fat_percentage=15)
        assert bmr == pytest.approx(1838.8)

    def test_lower_body_fat_yields_higher_bmr_at_same_weight(self):
        leaner = calculate_bmr_katch_mcardle(weight_kg=80, body_fat_percentage=10)
        fattier = calculate_bmr_katch_mcardle(weight_kg=80, body_fat_percentage=25)
        assert leaner > fattier


class TestCalculateBmrDispatch:
    def test_uses_katch_mcardle_when_body_fat_given(self):
        bmr, formula = calculate_bmr(
            weight_kg=80, height_cm=180, age=30, sex=Sex.MALE, body_fat_percentage=15
        )
        assert formula == "katch_mcardle"
        assert bmr == pytest.approx(calculate_bmr_katch_mcardle(weight_kg=80, body_fat_percentage=15))

    def test_uses_mifflin_st_jeor_when_body_fat_absent(self):
        bmr, formula = calculate_bmr(weight_kg=80, height_cm=180, age=30, sex=Sex.MALE)
        assert formula == "mifflin_st_jeor"
        assert bmr == pytest.approx(
            calculate_bmr_mifflin_st_jeor(weight_kg=80, height_cm=180, age=30, sex=Sex.MALE)
        )


class TestTdee:
    @pytest.mark.parametrize("level", list(ActivityLevel))
    def test_scales_bmr_by_activity_multiplier(self, level):
        bmr = 1600.0
        tdee = calculate_tdee(bmr=bmr, activity_level=level)
        assert tdee == pytest.approx(bmr * ACTIVITY_MULTIPLIERS[level])

    def test_monotonic_across_activity_levels(self):
        bmr = 1600.0
        tdees = [calculate_tdee(bmr=bmr, activity_level=lvl) for lvl in ActivityLevel]
        assert tdees == sorted(tdees)


class TestMacros:
    def test_macros_sum_back_to_approximately_total_calories(self):
        calories = 2400
        protein_g, carbs_g, fats_g = calculate_macros(
            calories=calories, weight_kg=80, fitness_goal=FitnessGoal.MUSCLE_GAIN
        )
        reconstructed = (
            protein_g * PROTEIN_KCAL_PER_G + carbs_g * 4 + fats_g * FAT_KCAL_PER_G
        )
        # Rounding grams can introduce a few kcal of drift, never more than ~20.
        assert abs(reconstructed - calories) < 20

    def test_protein_scales_with_goal_specific_multiplier(self):
        for goal in FitnessGoal:
            protein_g, _, _ = calculate_macros(calories=2500, weight_kg=80, fitness_goal=goal)
            assert protein_g == round(80 * GOAL_PROTEIN_PER_KG[goal])

    def test_fat_loss_has_higher_protein_per_kg_than_maintenance(self):
        fat_loss_protein, _, _ = calculate_macros(
            calories=2000, weight_kg=80, fitness_goal=FitnessGoal.FAT_LOSS
        )
        maintenance_protein, _, _ = calculate_macros(
            calories=2000, weight_kg=80, fitness_goal=FitnessGoal.MAINTENANCE
        )
        assert fat_loss_protein > maintenance_protein

    def test_macros_never_negative(self):
        # Even at an artificially low calorie count, carbs should floor at 0
        # rather than go negative.
        _, carbs_g, _ = calculate_macros(calories=100, weight_kg=100, fitness_goal=FitnessGoal.FAT_LOSS)
        assert carbs_g >= 0


class TestWaterIntake:
    def test_baseline_35ml_per_kg(self):
        water = calculate_water_intake_ml(weight_kg=70, activity_level=ActivityLevel.SEDENTARY)
        assert water == 70 * 35

    def test_higher_activity_increases_water_target(self):
        sedentary = calculate_water_intake_ml(weight_kg=70, activity_level=ActivityLevel.SEDENTARY)
        very_active = calculate_water_intake_ml(weight_kg=70, activity_level=ActivityLevel.VERY_ACTIVE)
        assert very_active > sedentary


class TestWorkoutTemplateSelection:
    def test_returns_higher_frequency_for_higher_activity_level(self):
        lower = select_workout_template(
            fitness_goal=FitnessGoal.MUSCLE_GAIN, activity_level=ActivityLevel.LIGHT
        )
        higher = select_workout_template(
            fitness_goal=FitnessGoal.MUSCLE_GAIN, activity_level=ActivityLevel.ACTIVE
        )
        assert higher.sessions_per_week >= lower.sessions_per_week

    def test_rehab_goal_is_low_intensity_and_low_frequency(self):
        template = select_workout_template(
            fitness_goal=FitnessGoal.REHAB, activity_level=ActivityLevel.SEDENTARY
        )
        assert template.sessions_per_week <= 3
        assert "movilidad" in " ".join(template.focus_areas).lower()

    @pytest.mark.parametrize("goal", list(FitnessGoal))
    @pytest.mark.parametrize("level", list(ActivityLevel))
    def test_every_goal_and_activity_combination_resolves(self, goal, level):
        template = select_workout_template(fitness_goal=goal, activity_level=level)
        assert template.sessions_per_week > 0
        assert template.name


class TestGenerateHealthPrescription:
    def test_end_to_end_fields_are_internally_consistent(self):
        result = generate_health_prescription(
            weight_kg=80,
            height_cm=180,
            age=30,
            sex=Sex.MALE,
            activity_level=ActivityLevel.MODERATE,
            fitness_goal=FitnessGoal.FAT_LOSS,
        )
        assert result.bmr_formula == "mifflin_st_jeor"
        assert result.calories == round(result.tdee * (1 + GOAL_CALORIE_ADJUSTMENT[FitnessGoal.FAT_LOSS]))
        assert result.protein_g > 0
        assert result.carbs_g >= 0
        assert result.fats_g > 0
        assert result.water_ml > 0
        assert result.workout_template.sessions_per_week > 0

    def test_calories_never_drop_below_minimum_floor(self):
        # A tiny, sedentary, aggressively cutting profile would otherwise
        # compute well under a safe minimum.
        result = generate_health_prescription(
            weight_kg=40,
            height_cm=150,
            age=70,
            sex=Sex.FEMALE,
            activity_level=ActivityLevel.SEDENTARY,
            fitness_goal=FitnessGoal.FAT_LOSS,
        )
        assert result.calories >= MIN_CALORIES

    def test_katch_mcardle_used_when_body_fat_supplied(self):
        result = generate_health_prescription(
            weight_kg=80,
            height_cm=180,
            age=30,
            sex=Sex.MALE,
            activity_level=ActivityLevel.MODERATE,
            fitness_goal=FitnessGoal.MUSCLE_GAIN,
            body_fat_percentage=12,
        )
        assert result.bmr_formula == "katch_mcardle"
