"""Generates a workout routine by asking an LLM (Ollama), instead of a
rule-based engine — the model sees the member's evaluation, the gym's
exercise catalog (so it can only pick real, in-catalog exercises), and the
member's previous routine if any (so it can adjust it rather than starting
over). There is no non-LLM fallback: if the model is unreachable or its
output can't be validated into a usable routine, generation fails outright.
"""

import json
import logging
from typing import Any

import httpx

from app.core.config import settings
from app.models.enums import DayOfWeek, FitnessGoal
from app.models.evaluation import PhysicalEvaluation
from app.models.exercise import Exercise
from app.models.workout import WorkoutPlan

logger = logging.getLogger(__name__)

# Same bounds as WorkoutPlanItemBase (backend/app/schemas/workout.py) — the
# LLM's output still has to pass through that schema eventually, so items
# outside these ranges would be rejected there anyway; checking here lets us
# drop just the bad item instead of failing the whole generation.
_MIN_SETS, _MAX_SETS = 1, 50
_MIN_REPS, _MAX_REPS = 1, 200
_MIN_REST, _MAX_REST = 0, 1800

_VALID_DAYS = {d.value for d in DayOfWeek}

_SYSTEM_PROMPT = """Eres un entrenador experto que diseña rutinas de gimnasio.
Debes responder ÚNICAMENTE con un JSON válido (sin markdown, sin texto extra) \
que siga exactamente este esquema:

{
  "name": "<nombre corto de la rutina, ej. 'Empuje/Jalón/Pierna'>",
  "days": [
    {
      "day_of_week": "<MONDAY|TUESDAY|WEDNESDAY|THURSDAY|FRIDAY|SATURDAY|SUNDAY>",
      "exercises": [
        {"exercise_id": "<uno de los ids de available_exercises>", "sets": <int>, "reps": <int>, "rest_seconds": <int>}
      ]
    }
  ]
}

Reglas:
- Usa SOLO ejercicios de "available_exercises", referenciados por su "id" exacto — nunca inventes un id ni un ejercicio.
- Elige entre 2 y 6 sesiones por semana según el objetivo y nivel de actividad \
(más sesiones para hipertrofia/actividad alta, menos para rehabilitación o sedentarismo), dejando días de descanso.
- Si "previous_routine" no es null, ajústala: mantén los ejercicios que sigan siendo apropiados y progresa \
series/repeticiones de forma razonable en vez de generar una rutina completamente distinta — \
salvo que el objetivo o nivel de actividad hayan cambiado, en cuyo caso arma una rutina nueva acorde al objetivo actual.
- series/repeticiones/descanso deben ser razonables para el objetivo (ej. fuerza/hipertrofia: series 3-5, reps 6-12; \
pérdida de grasa/resistencia: series 2-4, reps 12-20, descansos cortos; rehabilitación: bajo volumen, tempo controlado).
"""


class LLMGenerationError(Exception):
    pass


def _build_user_payload(
    *,
    evaluation: PhysicalEvaluation,
    exercises: list[Exercise],
    previous_plan: WorkoutPlan | None,
) -> str:
    payload: dict[str, Any] = {
        "member_evaluation": {
            # weight_kg/height_cm/body_fat_percentage are Numeric columns —
            # Decimal at runtime, which json.dumps can't serialize directly.
            "weight_kg": float(evaluation.weight_kg),
            "height_cm": float(evaluation.height_cm),
            "body_fat_percentage": (
                float(evaluation.body_fat_percentage)
                if evaluation.body_fat_percentage is not None
                else None
            ),
            "fitness_goal": evaluation.fitness_goal.value,
            "activity_level": evaluation.activity_level.value,
        },
        "available_exercises": [
            {
                "id": str(e.id),
                "name": e.name,
                "muscle_group": e.muscle_group,
                "equipment": e.equipment,
            }
            for e in exercises
        ],
        "previous_routine": None,
    }
    if previous_plan is not None:
        payload["previous_routine"] = {
            "name": previous_plan.name,
            "items": [
                {
                    "day_of_week": item.day_of_week.value,
                    "exercise_id": str(item.exercise_id),
                    "sets": item.sets,
                    "reps": item.reps,
                }
                for item in previous_plan.items
            ],
        }
    return json.dumps(payload, ensure_ascii=False)


async def _call_ollama(user_payload: str) -> str:
    if settings.MODEL_PROVIDER != "ollama":
        raise LLMGenerationError(f"Proveedor de LLM no soportado: {settings.MODEL_PROVIDER}")

    request_body = {
        "model": settings.MODEL_NAME,
        "messages": [
            {"role": "system", "content": _SYSTEM_PROMPT},
            {"role": "user", "content": user_payload},
        ],
        "stream": False,
        "format": "json",
    }
    try:
        async with httpx.AsyncClient(timeout=90.0) as client:
            response = await client.post(
                f"{settings.OLLAMA_BASE_URL}/api/chat", json=request_body
            )
            response.raise_for_status()
    except httpx.HTTPError as exc:
        logger.warning("Ollama request failed: %s", exc)
        raise LLMGenerationError(
            "No se pudo contactar al asistente de IA para generar la rutina"
        ) from exc

    try:
        return response.json()["message"]["content"]
    except (KeyError, ValueError) as exc:
        raise LLMGenerationError("Respuesta inesperada del asistente de IA") from exc


def _parse_and_validate(content: str, *, valid_exercise_ids: set[str]) -> tuple[str, list[dict]]:
    try:
        data = json.loads(content)
    except ValueError as exc:
        raise LLMGenerationError("El asistente de IA no devolvió un JSON válido") from exc

    name = data.get("name")
    days = data.get("days")
    if not isinstance(name, str) or not name.strip() or not isinstance(days, list):
        raise LLMGenerationError("El asistente de IA devolvió una rutina con formato inválido")

    items: list[dict] = []
    order = 0
    for day_entry in days:
        if not isinstance(day_entry, dict):
            continue
        day_of_week = day_entry.get("day_of_week")
        if day_of_week not in _VALID_DAYS:
            continue
        for ex in day_entry.get("exercises") or []:
            if not isinstance(ex, dict):
                continue
            exercise_id = ex.get("exercise_id")
            sets, reps, rest = ex.get("sets"), ex.get("reps"), ex.get("rest_seconds", 60)
            if (
                exercise_id not in valid_exercise_ids
                or not isinstance(sets, int)
                or not isinstance(reps, int)
                or not isinstance(rest, int)
                or not (_MIN_SETS <= sets <= _MAX_SETS)
                or not (_MIN_REPS <= reps <= _MAX_REPS)
                or not (_MIN_REST <= rest <= _MAX_REST)
            ):
                continue
            items.append(
                {
                    "day_of_week": DayOfWeek(day_of_week),
                    "exercise_id": exercise_id,
                    "sets": sets,
                    "reps": reps,
                    "rest_seconds": rest,
                    "order": order,
                }
            )
            order += 1

    if not items:
        raise LLMGenerationError(
            "El asistente de IA no devolvió ningún ejercicio válido para esta rutina"
        )
    return name.strip(), items


async def generate_routine_via_llm(
    *,
    evaluation: PhysicalEvaluation,
    exercises: list[Exercise],
    previous_plan: WorkoutPlan | None,
) -> tuple[str, list[dict]]:
    """Returns (routine_name, items) where each item is a dict with
    day_of_week/exercise_id/sets/reps/rest_seconds/order, ready to become
    WorkoutPlanItem rows."""
    if evaluation.fitness_goal == FitnessGoal.REHAB:
        # Hard filter, not just a prompt instruction: no heavy barbell
        # compounds ever get offered as a choice for a rehab routine.
        exercises = [e for e in exercises if e.equipment != "Barbell"]

    if not exercises:
        raise LLMGenerationError("No hay ejercicios disponibles en el catálogo para generar una rutina")

    user_payload = _build_user_payload(
        evaluation=evaluation, exercises=exercises, previous_plan=previous_plan
    )
    content = await _call_ollama(user_payload)
    valid_ids = {str(e.id) for e in exercises}
    return _parse_and_validate(content, valid_exercise_ids=valid_ids)
