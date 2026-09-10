"""Expands the demo dataset seeded by `seed_demo_data.py` into a full
90+ day history across THREE gyms, exercising every feature of the system:
gyms, branches, memberships, promotions, subscriptions (every status),
payments (every status/method/type), check-ins (granted/denied, attributed
to branches), physical evaluations, workout plans/items/completions,
nutrition plans/logs, notifications and gym audit logs.

Idempotent-ish: aborts if the third gym ("fitzone") already exists. Existing
PowerFit/Iron Temple users and their current active subscription are left
untouched — this script only ADDS an older subscription/payment cycle plus
denser check-in/nutrition history for them, so the demo logins used
throughout development keep working exactly as before.

Usage (from backend/, with the venv active):
    python -m scripts.expand_demo_data
"""

import asyncio
import os
import random
import sys
import uuid
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.core.security import hash_password  # noqa: E402
from app.models import (  # noqa: E402
    Branch,
    CheckIn,
    Exercise,
    Gym,
    GymAuditLog,
    Membership,
    MemberSubscription,
    Notification,
    NutritionLog,
    NutritionPlan,
    Payment,
    PhysicalEvaluation,
    Promotion,
    User,
    WorkoutCompletion,
    WorkoutPlan,
    WorkoutPlanItem,
)
from app.models.enums import (
    ActivityLevel,
    DayOfWeek,
    DiscountType,
    FitnessGoal,
    GymStatus,
    PaymentMethod,
    PaymentStatus,
    PaymentType,
    SaaSPlanTier,
    Sex,
    SubscriptionStatus,
    UserRole,
)

DEMO_PASSWORD_HASH = hash_password("12345")
TODAY = date.today()
RNG = random.Random(20260909)

# How far back the richest members' history reaches — comfortably over the
# 90-day filter the superadmin screens offer.
DEEP_HISTORY_DAYS = 118


def uid() -> uuid.UUID:
    return uuid.uuid4()


def dt_at(d: date, hour: int) -> datetime:
    return datetime.combine(d, datetime.min.time(), tzinfo=timezone.utc) + timedelta(hours=hour)


def make_user(
    *, gym_id, email, role, first_name, last_name, sex=None, phone=None, date_of_birth=None
) -> User:
    return User(
        id=uid(), gym_id=gym_id, email=email, password_hash=DEMO_PASSWORD_HASH, roles=[role],
        first_name=first_name, last_name=last_name, phone=phone, date_of_birth=date_of_birth,
        sex=sex, is_active=True,
    )


class MemberPlan:
    """Everything needed to generate one member's full 90+ day history."""

    def __init__(
        self,
        user: User,
        gym_id: uuid.UUID,
        memberships: list[Membership],
        branch_ids: list[uuid.UUID | None],
        join_days_ago: int,
        sessions_per_week: int,
        goal: FitnessGoal,
        activity: ActivityLevel,
        base_weight: float,
        base_bf: float,
        height_cm: float,
        trainer: User,
        nutritionist: User | None,
        force_expiring_soon: bool = False,
        force_cancelled: bool = False,
    ):
        self.user = user
        self.gym_id = gym_id
        self.memberships = memberships
        self.branch_ids = branch_ids
        self.join_days_ago = join_days_ago
        self.sessions_per_week = sessions_per_week
        self.goal = goal
        self.activity = activity
        self.base_weight = base_weight
        self.base_bf = base_bf
        self.height_cm = height_cm
        self.trainer = trainer
        self.nutritionist = nutritionist
        self.force_expiring_soon = force_expiring_soon
        self.force_cancelled = force_cancelled


def build_subscription_history(plan: MemberPlan) -> tuple[list[MemberSubscription], list[Payment], list[tuple[date, date]]]:
    subs: list[MemberSubscription] = []
    payments: list[Payment] = []
    active_ranges: list[tuple[date, date]] = []

    cursor = TODAY - timedelta(days=plan.join_days_ago)
    cycle_index = 0
    guard = 0
    while cursor <= TODAY and guard < 12:
        guard += 1
        membership = plan.memberships[cycle_index % len(plan.memberships)]
        cycle_index += 1
        start = cursor
        end = start + timedelta(days=membership.duration_days)

        if end < TODAY:
            status = SubscriptionStatus.EXPIRED
        elif start > TODAY:
            status = SubscriptionStatus.PENDING
        else:
            status = SubscriptionStatus.ACTIVE

        branch_id = RNG.choice(plan.branch_ids)
        sub = MemberSubscription(
            id=uid(), gym_id=plan.gym_id, user_id=plan.user.id, membership_id=membership.id,
            branch_id=branch_id, start_date=start, end_date=end, status=status,
        )
        subs.append(sub)
        active_ranges.append((start, min(end, TODAY)))

        pay_dt = dt_at(start, RNG.randint(8, 20))
        method = RNG.choice(
            [PaymentMethod.CASH, PaymentMethod.QR, PaymentMethod.CARD, PaymentMethod.TRANSFER]
        )
        if RNG.random() < 0.1:
            payments.append(
                Payment(
                    id=uid(), gym_id=plan.gym_id, user_id=plan.user.id, subscription_id=None,
                    membership_id=membership.id, branch_id=branch_id,
                    payment_type=PaymentType.MEMBERSHIP, payment_method=method,
                    status=PaymentStatus.FAILED, amount=membership.price, currency="BOB",
                    description="Pago rechazado por el banco emisor", created_at=pay_dt - timedelta(hours=3),
                )
            )
        payments.append(
            Payment(
                id=uid(), gym_id=plan.gym_id, user_id=plan.user.id, subscription_id=sub.id,
                membership_id=membership.id, branch_id=branch_id,
                payment_type=PaymentType.MEMBERSHIP, payment_method=method,
                status=PaymentStatus.COMPLETED, amount=membership.price, currency="BOB",
                description=f"Pago {membership.name}", created_at=pay_dt,
            )
        )

        gap = 0
        if RNG.random() < 0.15 and end < TODAY - timedelta(days=14):
            gap = RNG.randint(6, 16)
        cursor = end + timedelta(days=gap + 1)

    if plan.force_expiring_soon and subs:
        last = subs[-1]
        last.start_date = TODAY - timedelta(days=RNG.randint(18, 25))
        last.end_date = TODAY + timedelta(days=RNG.randint(2, 7))
        last.status = SubscriptionStatus.ACTIVE
        active_ranges[-1] = (last.start_date, TODAY)
        if payments and payments[-1].subscription_id == last.id:
            payments[-1].created_at = dt_at(last.start_date, RNG.randint(8, 20))

    if plan.force_cancelled and len(subs) >= 1:
        target = subs[-1]
        target.status = SubscriptionStatus.CANCELLED
        payments.append(
            Payment(
                id=uid(), gym_id=plan.gym_id, user_id=plan.user.id, subscription_id=target.id,
                membership_id=target.membership_id, payment_type=PaymentType.MEMBERSHIP,
                payment_method=PaymentMethod.CASH, status=PaymentStatus.REFUNDED,
                amount=next(m.price for m in plan.memberships if m.id == target.membership_id),
                currency="BOB", description="Reembolso por cancelación de membresía",
                created_at=dt_at(min(target.end_date, TODAY), 14),
            )
        )

    return subs, payments, active_ranges


def build_checkins(plan: MemberPlan, active_ranges: list[tuple[date, date]]) -> list[CheckIn]:
    rows: list[CheckIn] = []
    for start, end in active_ranges:
        d = start
        while d <= end:
            week_end = min(d + timedelta(days=6), end)
            span = (week_end - d).days + 1
            n_sessions = min(plan.sessions_per_week, span)
            offsets = RNG.sample(range(span), n_sessions) if span > 0 else []
            for off in offsets:
                day = d + timedelta(days=off)
                branch_id = RNG.choice(plan.branch_ids) if RNG.random() < 0.6 else None
                rows.append(
                    CheckIn(
                        id=uid(), gym_id=plan.gym_id, user_id=plan.user.id, branch_id=branch_id,
                        timestamp=dt_at(day, RNG.randint(6, 21)), access_granted=True, denial_reason=None,
                    )
                )
            d = week_end + timedelta(days=1)

    for (_, prev_end), (next_start, _) in zip(active_ranges, active_ranges[1:]):
        gap_days = (next_start - prev_end).days
        if gap_days > 4:
            for _ in range(RNG.randint(0, 2)):
                day = prev_end + timedelta(days=RNG.randint(1, gap_days - 1))
                rows.append(
                    CheckIn(
                        id=uid(), gym_id=plan.gym_id, user_id=plan.user.id, branch_id=None,
                        timestamp=dt_at(day, RNG.randint(6, 21)), access_granted=False,
                        denial_reason="No tiene una suscripción activa",
                    )
                )
    return rows


def build_evaluations(plan: MemberPlan) -> list[PhysicalEvaluation]:
    if plan.join_days_ago < 20:
        dates = [TODAY - timedelta(days=max(1, plan.join_days_ago - 2))]
    else:
        dates = [
            TODAY - timedelta(days=plan.join_days_ago - 3),
            TODAY - timedelta(days=max(10, plan.join_days_ago // 3)),
        ]

    evals = []
    weight = plan.base_weight
    bf = plan.base_bf
    for i, d in enumerate(dates):
        drift = -1.2 if plan.goal == FitnessGoal.FAT_LOSS else (0.8 if plan.goal == FitnessGoal.MUSCLE_GAIN else 0.1)
        w = round(weight + drift * i, 1)
        b = round(max(8.0, bf - 0.8 * i), 1)
        evals.append(
            PhysicalEvaluation(
                id=uid(), gym_id=plan.gym_id, user_id=plan.user.id, evaluated_by_id=plan.trainer.id,
                branch_id=RNG.choice(plan.branch_ids),
                age=TODAY.year - plan.user.date_of_birth.year if plan.user.date_of_birth else None,
                weight_kg=Decimal(str(w)), height_cm=Decimal(str(plan.height_cm)),
                body_fat_percentage=Decimal(str(b)), fitness_goal=plan.goal, activity_level=plan.activity,
                notes="Evaluación de seguimiento — progreso acorde al objetivo." if i > 0 else "Evaluación inicial.",
                evaluated_at=dt_at(d, RNG.randint(9, 18)),
            )
        )
    return evals


EXERCISE_DAYS = [DayOfWeek.MONDAY, DayOfWeek.WEDNESDAY, DayOfWeek.FRIDAY]


def build_workout_plan(
    plan: MemberPlan, evaluation_date: date, exercise_pool: list[Exercise]
) -> tuple[WorkoutPlan, list[WorkoutPlanItem]]:
    wp = WorkoutPlan(
        id=uid(), gym_id=plan.gym_id, user_id=plan.user.id, branch_id=RNG.choice(plan.branch_ids),
        created_by_id=plan.trainer.id, name=f"Plan {plan.goal.value.replace('_', ' ').title()}",
        fitness_goal=plan.goal, start_date=evaluation_date, is_active=True,
    )
    items = []
    chosen = RNG.sample(exercise_pool, k=min(6, len(exercise_pool)))
    for i, ex in enumerate(chosen):
        day = EXERCISE_DAYS[i % len(EXERCISE_DAYS)]
        items.append(
            WorkoutPlanItem(
                id=uid(), workout_plan_id=wp.id, exercise_id=ex.id, day_of_week=day,
                sets=RNG.randint(3, 4), reps=RNG.randint(8, 15), order=i,
                rest_seconds=RNG.choice([45, 60, 90]),
            )
        )
    return wp, items


def build_nutrition(
    plan: MemberPlan, start_date: date, existing_log_dates: set[tuple[uuid.UUID, date]]
) -> tuple[NutritionPlan | None, list[NutritionLog]]:
    if plan.nutritionist is None:
        return None, []

    bmr = round(plan.base_weight * 22)
    tdee = round(bmr * 1.4)
    if plan.goal == FitnessGoal.FAT_LOSS:
        calories = tdee - 400
    elif plan.goal == FitnessGoal.MUSCLE_GAIN:
        calories = tdee + 300
    else:
        calories = tdee
    protein = round(plan.base_weight * 2.0)
    fats = round(calories * 0.25 / 9)
    carbs = round((calories - protein * 4 - fats * 9) / 4)

    nplan = NutritionPlan(
        id=uid(), gym_id=plan.gym_id, user_id=plan.user.id, branch_id=RNG.choice(plan.branch_ids),
        created_by_id=plan.nutritionist.id, fitness_goal=plan.goal,
        bmr=Decimal(str(bmr)), bmr_formula="mifflin_st_jeor", tdee=Decimal(str(tdee)),
        calories=calories, protein_g=protein, carbs_g=max(carbs, 50), fats_g=fats,
        water_ml=round(plan.base_weight * 35), start_date=start_date, is_active=True,
        notes="Generado automáticamente a partir de la evaluación física.",
    )

    logs = []
    span_days = (TODAY - start_date).days
    n_logs = min(10, max(3, span_days // 6))
    candidate_days = list(range(1, max(2, span_days)))
    RNG.shuffle(candidate_days)
    picked = 0
    for off in candidate_days:
        if picked >= n_logs:
            break
        log_date = TODAY - timedelta(days=off)
        key = (plan.user.id, log_date)
        if key in existing_log_dates:
            continue
        existing_log_dates.add(key)
        logs.append(
            NutritionLog(
                id=uid(), gym_id=plan.gym_id, user_id=plan.user.id, log_date=log_date,
                protein_g=Decimal(str(protein + RNG.randint(-15, 15))),
                carbs_g=Decimal(str(max(30, carbs + RNG.randint(-30, 30)))),
                fats_g=Decimal(str(fats + RNG.randint(-10, 10))),
            )
        )
        picked += 1
    return nplan, logs


async def generate_full_member(
    db: AsyncSession, plan: MemberPlan, exercise_pool: list[Exercise],
    existing_log_dates: set[tuple[uuid.UUID, date]],
) -> None:
    subs, payments, active_ranges = build_subscription_history(plan)
    db.add_all(subs)
    db.add_all(payments)
    await db.flush()

    db.add_all(build_checkins(plan, active_ranges))

    evals = build_evaluations(plan)
    db.add_all(evals)

    wp, items = build_workout_plan(plan, evals[-1].evaluated_at.date(), exercise_pool)
    db.add(wp)
    await db.flush()
    db.add_all(items)
    await db.flush()

    if items:
        window = max(1, min(20, plan.join_days_ago))
        for item in RNG.sample(items, k=min(3, len(items))):
            n = min(RNG.randint(1, 3), window)
            for off in RNG.sample(range(window), n):
                db.add(
                    WorkoutCompletion(
                        id=uid(), gym_id=plan.gym_id, user_id=plan.user.id,
                        workout_plan_item_id=item.id, completed_date=TODAY - timedelta(days=off),
                    )
                )

    nplan, logs = build_nutrition(plan, evals[-1].evaluated_at.date(), existing_log_dates)
    if nplan:
        db.add(nplan)
        db.add_all(logs)

    latest_completed = next((p for p in payments if p.status == PaymentStatus.COMPLETED), None)
    if latest_completed:
        db.add(
            Notification(
                id=uid(), gym_id=plan.gym_id, user_id=plan.user.id, kind="payment_approved",
                title="Pago aprobado", body=f"Tu pago de Bs {latest_completed.amount} fue aprobado.",
                related_id=latest_completed.subscription_id,
                created_at=latest_completed.created_at, read_at=latest_completed.created_at + timedelta(hours=2),
            )
        )
    if plan.force_expiring_soon:
        db.add(
            Notification(
                id=uid(), gym_id=plan.gym_id, user_id=plan.user.id, kind="subscription_expiring",
                title="Tu suscripción está por vencer",
                body="Tu membresía vence en los próximos días. Renueva para seguir entrenando sin interrupciones.",
            )
        )
    await db.flush()


async def backfill_existing_member(
    db: AsyncSession, *, gym_id, user: User, membership: Membership, branch_ids: list[uuid.UUID | None],
    current_start: date, existing_log_dates: set[tuple[uuid.UUID, date]], trainer: User | None,
) -> None:
    """Adds an older, already-closed subscription/payment cycle plus denser
    check-in and nutrition history for a member who already has a current
    (recent) active subscription from `seed_demo_data.py` — extends their
    visible history back past 90 days without touching what already exists."""
    older_start = current_start - timedelta(days=RNG.randint(45, 60)) - timedelta(days=membership.duration_days)
    older_end = older_start + timedelta(days=membership.duration_days)
    if older_end >= current_start:
        older_end = current_start - timedelta(days=RNG.randint(3, 9))
        older_start = older_end - timedelta(days=membership.duration_days)

    branch_id = RNG.choice(branch_ids)
    old_sub = MemberSubscription(
        id=uid(), gym_id=gym_id, user_id=user.id, membership_id=membership.id, branch_id=branch_id,
        start_date=older_start, end_date=older_end, status=SubscriptionStatus.EXPIRED,
    )
    db.add(old_sub)
    await db.flush()

    pay_dt = dt_at(older_start, RNG.randint(8, 20))
    db.add(
        Payment(
            id=uid(), gym_id=gym_id, user_id=user.id, subscription_id=old_sub.id,
            membership_id=membership.id, branch_id=branch_id, payment_type=PaymentType.MEMBERSHIP,
            payment_method=RNG.choice([PaymentMethod.CASH, PaymentMethod.QR, PaymentMethod.TRANSFER]),
            status=PaymentStatus.COMPLETED, amount=membership.price, currency="BOB",
            description=f"Pago {membership.name} (ciclo anterior)", created_at=pay_dt,
        )
    )

    fake_plan = MemberPlan(
        user=user, gym_id=gym_id, memberships=[membership], branch_ids=branch_ids,
        join_days_ago=0, sessions_per_week=RNG.randint(2, 4), goal=FitnessGoal.MAINTENANCE,
        activity=ActivityLevel.MODERATE, base_weight=70, base_bf=20, height_cm=170,
        trainer=user, nutritionist=None,
    )
    db.add_all(build_checkins(fake_plan, [(older_start, older_end)]))

    if RNG.random() < 0.4 and trainer is not None:
        eval_date = older_start + timedelta(days=RNG.randint(5, 15))
        db.add(
            PhysicalEvaluation(
                id=uid(), gym_id=gym_id, user_id=user.id, evaluated_by_id=trainer.id, branch_id=branch_id,
                age=None, weight_kg=Decimal("70.0"), height_cm=Decimal("170.0"),
                body_fat_percentage=Decimal("20.0"), fitness_goal=FitnessGoal.MAINTENANCE,
                activity_level=ActivityLevel.MODERATE, notes="Evaluación de ciclo anterior.",
                evaluated_at=dt_at(eval_date, 10),
            )
        )

    span = (TODAY - older_start).days
    for _ in range(RNG.randint(3, 6)):
        off = RNG.randint(1, max(2, span - 1))
        log_date = TODAY - timedelta(days=off)
        key = (user.id, log_date)
        if key in existing_log_dates:
            continue
        existing_log_dates.add(key)
        db.add(
            NutritionLog(
                id=uid(), gym_id=gym_id, user_id=user.id, log_date=log_date,
                protein_g=Decimal(str(RNG.randint(90, 180))),
                carbs_g=Decimal(str(RNG.randint(120, 260))),
                fats_g=Decimal(str(RNG.randint(40, 85))),
            )
        )
    await db.flush()


async def run(session_factory: async_sessionmaker) -> None:
    async with session_factory() as db:
        existing = await db.execute(select(Gym).where(Gym.subdomain == "fitzone"))
        if existing.scalar_one_or_none() is not None:
            print("Ya existe un gym con subdomain 'fitzone' — abortando para no duplicar datos.")
            return

        powerfit = (await db.execute(select(Gym).where(Gym.subdomain == "powerfit"))).scalar_one_or_none()
        irontemple = (await db.execute(select(Gym).where(Gym.subdomain == "irontemple"))).scalar_one_or_none()
        if powerfit is None or irontemple is None:
            print("No se encontraron 'powerfit'/'irontemple'. Corre primero scripts/seed_demo_data.py.")
            return

        global_exercises = list(
            (await db.execute(select(Exercise).where(Exercise.gym_id.is_(None)))).scalars().all()
        )

        existing_log_dates: set[tuple[uuid.UUID, date]] = set(
            (r.user_id, r.log_date) for r in (await db.execute(select(NutritionLog))).scalars().all()
        )

        # ------------------------------------------------------------------
        # Branches — PowerFit already has one from earlier manual testing;
        # Iron Temple gets its first two here. FitZone's are added below.
        # ------------------------------------------------------------------
        it_branches_existing = list(
            (await db.execute(select(Branch).where(Branch.gym_id == irontemple.id))).scalars().all()
        )
        if not it_branches_existing:
            it_sur = Branch(id=uid(), gym_id=irontemple.id, name="Sucursal Sur", address="Av. Grigotá #789, Santa Cruz")
            it_centro = Branch(id=uid(), gym_id=irontemple.id, name="Sucursal Centro", address="Calle Ayacucho #234, Santa Cruz")
            db.add_all([it_sur, it_centro])
            await db.flush()
            it_branches: list[uuid.UUID | None] = [it_sur.id, it_centro.id, None]
        else:
            it_branches = [b.id for b in it_branches_existing] + [None]

        pf_branches_existing = list(
            (await db.execute(select(Branch).where(Branch.gym_id == powerfit.id))).scalars().all()
        )
        pf_branches: list[uuid.UUID | None] = [b.id for b in pf_branches_existing] + [None]

        # ------------------------------------------------------------------
        # Third gym: FitZone Bolivia (La Paz)
        # ------------------------------------------------------------------
        fitzone = Gym(
            id=uid(), name="FitZone Bolivia", subdomain="fitzone", status=GymStatus.ACTIVE,
            plan_tier=SaaSPlanTier.ENTERPRISE, contact_email="contacto@fitzonebolivia.com",
            contact_phone="+591 760 22 555", address="Av. Ballivián #1200, La Paz",
        )
        db.add(fitzone)
        await db.flush()

        fz_admin = make_user(
            gym_id=fitzone.id, email="carla.mendez@fitzonebolivia.com", roles=[UserRole.GYM_ADMIN],
            first_name="Carla", last_name="Méndez Quispe", sex=Sex.FEMALE,
        )
        fz_trainer1 = make_user(
            gym_id=fitzone.id, email="rodrigo.apaza@fitzonebolivia.com", roles=[UserRole.TRAINER],
            first_name="Rodrigo", last_name="Apaza Colque", sex=Sex.MALE,
        )
        fz_trainer2 = make_user(
            gym_id=fitzone.id, email="natalia.quiroga@fitzonebolivia.com", roles=[UserRole.TRAINER],
            first_name="Natalia", last_name="Quiroga Vásquez", sex=Sex.FEMALE,
        )
        fz_nutri = make_user(
            gym_id=fitzone.id, email="esteban.rios@fitzonebolivia.com", roles=[UserRole.NUTRITIONIST],
            first_name="Esteban", last_name="Ríos Mamani", sex=Sex.MALE,
        )
        db.add_all([fz_admin, fz_trainer1, fz_trainer2, fz_nutri])
        await db.flush()

        fz_sede_norte = Branch(id=uid(), gym_id=fitzone.id, name="Sede Achumani", address="Calle 15 de Achumani, La Paz")
        fz_sede_sur = Branch(id=uid(), gym_id=fitzone.id, name="Sede Sopocachi", address="Av. 20 de Octubre, La Paz")
        db.add_all([fz_sede_norte, fz_sede_sur])
        await db.flush()
        fz_branches: list[uuid.UUID | None] = [fz_sede_norte.id, fz_sede_sur.id, None]

        fz_mensual = Membership(id=uid(), gym_id=fitzone.id, name="Plan Mensual FitZone",
                                 description="Acceso ilimitado durante 30 días.", price=Decimal("120.00"), duration_days=30)
        fz_trimestral = Membership(id=uid(), gym_id=fitzone.id, name="Plan Trimestral FitZone",
                                    description="Acceso ilimitado durante 90 días.", price=Decimal("320.00"), duration_days=90)
        fz_anual = Membership(id=uid(), gym_id=fitzone.id, name="Plan Anual FitZone",
                               description="Acceso ilimitado durante 365 días, incluye evaluaciones trimestrales.",
                               price=Decimal("1100.00"), duration_days=365)
        db.add_all([fz_mensual, fz_trimestral, fz_anual])
        await db.flush()

        db.add(
            Promotion(
                id=uid(), gym_id=fitzone.id, membership_id=fz_mensual.id, name="Promo Apertura",
                description="20% de descuento en tu primer Plan Mensual.", discount_type=DiscountType.PERCENTAGE,
                discount_value=Decimal("20.00"), start_date=TODAY - timedelta(days=20), end_date=TODAY + timedelta(days=40),
                is_active=True,
            )
        )

        fz_exercise = Exercise(
            id=uid(), gym_id=fitzone.id, name="HIIT FitZone", muscle_group="Full body",
            equipment="Peso corporal y cuerdas", description="Circuito de alta intensidad propio de FitZone.",
        )
        db.add(fz_exercise)
        await db.flush()
        exercise_pool = global_exercises + [fz_exercise]

        db.add(
            GymAuditLog(id=uid(), gym_id=fitzone.id, actor_id=None, action="status_changed:TRIAL->ACTIVE",
                        reason="Activación directa en plan Enterprise")
        )
        db.add(
            GymAuditLog(id=uid(), gym_id=irontemple.id, actor_id=None, action="suspended",
                        reason="Pago de suscripción SaaS vencido")
        )
        db.add(
            GymAuditLog(id=uid(), gym_id=irontemple.id, actor_id=None, action="reactivated", reason=None)
        )

        # ------------------------------------------------------------------
        # FitZone members — full 90+ day generated history each.
        # ------------------------------------------------------------------
        fz_roster = [
            ("valentina.condori@mail.com", "Valentina", "Condori Huanca", Sex.FEMALE, 68.0, 24.0, 163),
            ("adrian.mamani@mail.com", "Adrián", "Mamani Flores", Sex.MALE, 88.0, 20.0, 176),
            ("melissa.rojas@mail.com", "Melissa", "Rojas Duran", Sex.FEMALE, 60.0, 27.0, 160),
            ("gonzalo.paredes@mail.com", "Gonzalo", "Paredes Ticona", Sex.MALE, 95.0, 25.0, 182),
            ("carolina.velasco@mail.com", "Carolina", "Velasco Blanco", Sex.FEMALE, 72.0, 22.0, 168),
            ("javier.cruz@mail.com", "Javier", "Cruz Alanoca", Sex.MALE, 80.0, 18.0, 174),
            ("daniela.suarez@mail.com", "Daniela", "Suárez Loza", Sex.FEMALE, 65.0, 23.0, 165),
            ("mauricio.gutierrez@mail.com", "Mauricio", "Gutiérrez Vía", Sex.MALE, 78.0, 21.0, 170),
            ("ximena.calle@mail.com", "Ximena", "Calle Nina", Sex.FEMALE, 58.0, 26.0, 158),
            ("federico.limachi@mail.com", "Federico", "Limachi Poma", Sex.MALE, 100.0, 29.0, 179),
        ]
        goals_cycle = [FitnessGoal.FAT_LOSS, FitnessGoal.MUSCLE_GAIN, FitnessGoal.MAINTENANCE, FitnessGoal.REHAB]
        activity_cycle = [ActivityLevel.LIGHT, ActivityLevel.MODERATE, ActivityLevel.ACTIVE, ActivityLevel.VERY_ACTIVE]

        fz_members = []
        for i, (email, first, last, sex, weight, bf, height) in enumerate(fz_roster):
            u = make_user(
                gym_id=fitzone.id, email=email, roles=[UserRole.MEMBER], first_name=first, last_name=last,
                sex=sex, date_of_birth=date(1988 + (i % 15), 1 + (i % 12), 5 + (i % 20)),
            )
            fz_members.append(u)
        db.add_all(fz_members)
        await db.flush()

        for i, u in enumerate(fz_members):
            _, _, _, _, weight, bf, height = fz_roster[i]
            trainer = fz_trainer1 if i % 2 == 0 else fz_trainer2
            plan = MemberPlan(
                user=u, gym_id=fitzone.id, memberships=[fz_mensual, fz_trimestral, fz_anual],
                branch_ids=fz_branches, join_days_ago=RNG.randint(30, DEEP_HISTORY_DAYS),
                sessions_per_week=RNG.randint(2, 5), goal=goals_cycle[i % len(goals_cycle)],
                activity=activity_cycle[i % len(activity_cycle)], base_weight=weight, base_bf=bf,
                height_cm=height, trainer=trainer, nutritionist=fz_nutri,
                force_expiring_soon=(i in (0, 1)), force_cancelled=(i == 9),
            )
            await generate_full_member(db, plan, exercise_pool, existing_log_dates)

        # ------------------------------------------------------------------
        # Two brand-new members per EXISTING gym: one deep-history veteran,
        # one whose only subscription expires within the next 7 days —
        # covers "expiring soon" for tenants that had none before.
        # ------------------------------------------------------------------
        pf_memberships = list(
            (await db.execute(select(Membership).where(Membership.gym_id == powerfit.id))).scalars().all()
        )
        it_memberships = list(
            (await db.execute(select(Membership).where(Membership.gym_id == irontemple.id))).scalars().all()
        )
        pf_trainer = (
            await db.execute(select(User).where(User.gym_id == powerfit.id, User.roles.any(UserRole.TRAINER)))
        ).scalars().first()
        pf_nutri = (
            await db.execute(select(User).where(User.gym_id == powerfit.id, User.roles.any(UserRole.NUTRITIONIST)))
        ).scalars().first()
        it_trainer = (
            await db.execute(select(User).where(User.gym_id == irontemple.id, User.roles.any(UserRole.TRAINER)))
        ).scalars().first()

        new_pf_members = [
            make_user(gym_id=powerfit.id, email="valentina.suarez@mail.com", roles=[UserRole.MEMBER],
                      first_name="Valentina", last_name="Suárez Roca", sex=Sex.FEMALE, date_of_birth=date(1993, 4, 2)),
            make_user(gym_id=powerfit.id, email="bruno.mendoza@mail.com", roles=[UserRole.MEMBER],
                      first_name="Bruno", last_name="Mendoza Ergueta", sex=Sex.MALE, date_of_birth=date(1989, 8, 19)),
        ]
        new_it_members = [
            make_user(gym_id=irontemple.id, email="gabriela.rios@mail.com", roles=[UserRole.MEMBER],
                      first_name="Gabriela", last_name="Ríos Bazán", sex=Sex.FEMALE, date_of_birth=date(1996, 2, 11)),
            make_user(gym_id=irontemple.id, email="esteban.paz@mail.com", roles=[UserRole.MEMBER],
                      first_name="Esteban", last_name="Paz Ontiveros", sex=Sex.MALE, date_of_birth=date(1991, 11, 6)),
        ]
        db.add_all(new_pf_members + new_it_members)
        await db.flush()

        plans = [
            MemberPlan(
                user=new_pf_members[0], gym_id=powerfit.id, memberships=pf_memberships, branch_ids=pf_branches,
                join_days_ago=RNG.randint(20, 30), sessions_per_week=3, goal=FitnessGoal.FAT_LOSS,
                activity=ActivityLevel.MODERATE, base_weight=63, base_bf=25, height_cm=161,
                trainer=pf_trainer, nutritionist=pf_nutri, force_expiring_soon=True,
            ),
            MemberPlan(
                user=new_pf_members[1], gym_id=powerfit.id, memberships=pf_memberships, branch_ids=pf_branches,
                join_days_ago=DEEP_HISTORY_DAYS, sessions_per_week=4, goal=FitnessGoal.MUSCLE_GAIN,
                activity=ActivityLevel.VERY_ACTIVE, base_weight=84, base_bf=17, height_cm=177,
                trainer=pf_trainer, nutritionist=pf_nutri,
            ),
            MemberPlan(
                user=new_it_members[0], gym_id=irontemple.id, memberships=it_memberships, branch_ids=it_branches,
                join_days_ago=RNG.randint(20, 30), sessions_per_week=2, goal=FitnessGoal.MAINTENANCE,
                activity=ActivityLevel.LIGHT, base_weight=59, base_bf=23, height_cm=159,
                trainer=it_trainer, nutritionist=None, force_expiring_soon=True,
            ),
            MemberPlan(
                user=new_it_members[1], gym_id=irontemple.id, memberships=it_memberships, branch_ids=it_branches,
                join_days_ago=DEEP_HISTORY_DAYS, sessions_per_week=3, goal=FitnessGoal.REHAB,
                activity=ActivityLevel.SEDENTARY, base_weight=91, base_bf=27, height_cm=181,
                trainer=it_trainer, nutritionist=None,
            ),
        ]
        for plan in plans:
            await generate_full_member(db, plan, exercise_pool, existing_log_dates)

        # ------------------------------------------------------------------
        # Backfill: existing PowerFit/Iron Temple members get an older,
        # already-closed subscription cycle + denser check-in/nutrition
        # history, without touching their current active subscription.
        # ------------------------------------------------------------------
        existing_members_query = await db.execute(
            select(User, MemberSubscription)
            .join(MemberSubscription, MemberSubscription.user_id == User.id)
            .where(User.gym_id.in_([powerfit.id, irontemple.id]), User.roles.any(UserRole.MEMBER))
        )
        seen_users: set[uuid.UUID] = set()
        for user, sub in existing_members_query.all():
            if user.id in seen_users:
                continue
            seen_users.add(user.id)
            membership = (
                await db.execute(select(Membership).where(Membership.id == sub.membership_id))
            ).scalar_one()
            branch_ids = pf_branches if user.gym_id == powerfit.id else it_branches
            trainer_for_gym = pf_trainer if user.gym_id == powerfit.id else it_trainer
            await backfill_existing_member(
                db, gym_id=user.gym_id, user=user, membership=membership, branch_ids=branch_ids,
                current_start=sub.start_date, existing_log_dates=existing_log_dates,
                trainer=trainer_for_gym,
            )

        await db.commit()
        print("Datos históricos expandidos correctamente.")
        print(f" - Nuevo gimnasio: {fitzone.name} (subdomain: fitzone) — admin: {fz_admin.email}")
        print(f" - Iron Temple: sucursales agregadas — {len(it_branches_existing) or 2} sucursal(es)")
        print(f" - Miembros nuevos en PowerFit/Iron Temple: {len(new_pf_members) + len(new_it_members)}")
        print(f" - Historial de respaldo agregado para {len(seen_users)} miembros existentes")


async def main() -> None:
    database_url = os.environ.get("SEED_DATABASE_URL") or os.environ.get("MIGRATION_DATABASE_URL")
    if not database_url:
        from app.core.config import settings

        database_url = settings.DATABASE_URL
        print("Aviso: usando settings.DATABASE_URL (rol restringido); define MIGRATION_DATABASE_URL o "
              "SEED_DATABASE_URL para usar el rol con privilegios de dueño de tabla si esto falla por RLS.")

    engine = create_async_engine(database_url)
    session_factory = async_sessionmaker(engine, expire_on_commit=False)
    try:
        await run(session_factory)
    finally:
        await engine.dispose()


if __name__ == "__main__":
    asyncio.run(main())
