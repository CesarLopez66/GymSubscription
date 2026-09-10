"""Seed the database with realistic demo data covering every role and every
main feature of the system (gyms, memberships, subscriptions, payments,
check-ins, evaluations, exercises, workout plans, nutrition plans,
notifications, promotions and gym audit logs).

Connects with a table-owner / superuser role (reads MIGRATION_DATABASE_URL,
falling back to DATABASE_URL) so it bypasses Row-Level Security entirely —
seeding intentionally writes rows for multiple tenants (gyms) in one run,
which the app's own restricted runtime role could never do.

Usage (from backend/, with the venv active):
    python -m scripts.seed_demo_data
"""

import asyncio
import os
import sys
import uuid
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.core.security import hash_password  # noqa: E402
from app.models import (  # noqa: E402
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


def uid() -> uuid.UUID:
    return uuid.uuid4()


def days_ago(n: int) -> date:
    return TODAY - timedelta(days=n)


def make_user(
    *,
    gym_id: uuid.UUID | None,
    email: str,
    role: UserRole,
    first_name: str,
    last_name: str,
    sex: Sex | None = None,
    phone: str | None = None,
    date_of_birth: date | None = None,
) -> User:
    return User(
        id=uid(),
        gym_id=gym_id,
        email=email,
        password_hash=DEMO_PASSWORD_HASH,
        roles=[role],
        first_name=first_name,
        last_name=last_name,
        phone=phone,
        date_of_birth=date_of_birth,
        sex=sex,
        is_active=True,
    )


async def seed(session_factory: async_sessionmaker) -> None:
    async with session_factory() as db:
        existing = await db.execute(select(Gym).where(Gym.subdomain == "powerfit"))
        if existing.scalar_one_or_none() is not None:
            print("Ya existe un gym con subdomain 'powerfit' — abortando para no duplicar datos.")
            return

        # ------------------------------------------------------------------
        # Gyms
        # ------------------------------------------------------------------
        powerfit = Gym(
            id=uid(),
            name="PowerFit Gym",
            subdomain="powerfit",
            status=GymStatus.ACTIVE,
            plan_tier=SaaSPlanTier.PRO,
            contact_email="contacto@powerfitgym.com",
            contact_phone="+591 700 11 222",
            address="Av. América #123, Cochabamba",
        )
        iron_temple = Gym(
            id=uid(),
            name="Iron Temple",
            subdomain="irontemple",
            status=GymStatus.TRIAL,
            plan_tier=SaaSPlanTier.BASIC,
            contact_email="hola@irontemple.com",
            contact_phone="+591 777 33 444",
            address="Calle Bolívar #456, Santa Cruz",
        )
        db.add_all([powerfit, iron_temple])
        # Exercise/User/etc. below are linked via raw gym_id columns, not the
        # `gym = relationship(...)` attribute, so the unit-of-work flush
        # ordering (which sorts by relationship dependency processors) can't
        # infer they must follow the gym rows — flush explicitly after every
        # layer instead of relying on that inference.
        await db.flush()

        # ------------------------------------------------------------------
        # Users — one per role exactly as requested (rol1..rol5), plus extra
        # staff/members for a realistic volume of data.
        # ------------------------------------------------------------------
        rol1_superadmin = make_user(
            gym_id=None,
            email="rol1@subgym.com",
            roles=[UserRole.SUPERADMIN],
            first_name="Rol1",
            last_name="Super Administrador",
        )
        rol2_admin = make_user(
            gym_id=powerfit.id,
            email="rol2@subgym.com",
            roles=[UserRole.GYM_ADMIN],
            first_name="Rol2",
            last_name="Administrador",
        )
        rol3_trainer = make_user(
            gym_id=powerfit.id,
            email="rol3@subgym.com",
            roles=[UserRole.TRAINER],
            first_name="Rol3",
            last_name="Entrenador",
        )
        rol4_nutritionist = make_user(
            gym_id=powerfit.id,
            email="rol4@subgym.com",
            roles=[UserRole.NUTRITIONIST],
            first_name="Rol4",
            last_name="Nutricionista",
        )
        rol5_member = make_user(
            gym_id=powerfit.id,
            email="rol5@subgym.com",
            roles=[UserRole.MEMBER],
            first_name="Rol5",
            last_name="Miembro",
            sex=Sex.MALE,
            date_of_birth=date(1996, 4, 12),
        )

        miguel_trainer = make_user(
            gym_id=powerfit.id,
            email="miguel.rojas@powerfitgym.com",
            roles=[UserRole.TRAINER],
            first_name="Miguel Ángel",
            last_name="Rojas",
            sex=Sex.MALE,
        )
        valeria_nutri = make_user(
            gym_id=powerfit.id,
            email="valeria.ortiz@powerfitgym.com",
            roles=[UserRole.NUTRITIONIST],
            first_name="Valeria",
            last_name="Ortiz Salinas",
            sex=Sex.FEMALE,
        )

        ana = make_user(
            gym_id=powerfit.id, email="ana.gutierrez@mail.com", roles=[UserRole.MEMBER],
            first_name="Ana", last_name="Gutiérrez Paz", sex=Sex.FEMALE, date_of_birth=date(1994, 2, 18),
        )
        jorge = make_user(
            gym_id=powerfit.id, email="jorge.fernandez@mail.com", roles=[UserRole.MEMBER],
            first_name="Jorge", last_name="Fernández Quiroga", sex=Sex.MALE, date_of_birth=date(1990, 7, 3),
        )
        lucia = make_user(
            gym_id=powerfit.id, email="lucia.mamani@mail.com", roles=[UserRole.MEMBER],
            first_name="Lucía", last_name="Mamani Choque", sex=Sex.FEMALE, date_of_birth=date(1998, 11, 25),
        )
        diego = make_user(
            gym_id=powerfit.id, email="diego.torrez@mail.com", roles=[UserRole.MEMBER],
            first_name="Diego", last_name="Torrez Vaca", sex=Sex.MALE, date_of_birth=date(1988, 5, 30),
        )
        camila = make_user(
            gym_id=powerfit.id, email="camila.rivas@mail.com", roles=[UserRole.MEMBER],
            first_name="Camila", last_name="Rivas Solano", sex=Sex.FEMALE, date_of_birth=date(2001, 9, 14),
        )
        sebastian = make_user(
            gym_id=powerfit.id, email="sebastian.flores@mail.com", roles=[UserRole.MEMBER],
            first_name="Sebastián", last_name="Flores Cruz", sex=Sex.MALE, date_of_birth=date(1992, 1, 9),
        )
        fernanda = make_user(
            gym_id=powerfit.id, email="fernanda.vargas@mail.com", roles=[UserRole.MEMBER],
            first_name="Fernanda", last_name="Vargas Ibáñez", sex=Sex.FEMALE, date_of_birth=date(1995, 6, 21),
        )
        ricardo = make_user(
            gym_id=powerfit.id, email="ricardo.salazar@mail.com", roles=[UserRole.MEMBER],
            first_name="Ricardo", last_name="Salazar Nina", sex=Sex.MALE, date_of_birth=date(1985, 12, 2),
        )
        paola = make_user(
            gym_id=powerfit.id, email="paola.aguilar@mail.com", roles=[UserRole.MEMBER],
            first_name="Paola", last_name="Aguilar Rojas", sex=Sex.FEMALE, date_of_birth=date(1999, 3, 17),
        )

        andrea_admin = make_user(
            gym_id=iron_temple.id, email="andrea.salinas@irontemple.com", roles=[UserRole.GYM_ADMIN],
            first_name="Andrea", last_name="Salinas Butrón", sex=Sex.FEMALE,
        )
        hugo_trainer = make_user(
            gym_id=iron_temple.id, email="hugo.vega@irontemple.com", roles=[UserRole.TRAINER],
            first_name="Hugo", last_name="Vega Terán", sex=Sex.MALE,
        )
        marcelo = make_user(
            gym_id=iron_temple.id, email="marcelo.choque@mail.com", roles=[UserRole.MEMBER],
            first_name="Marcelo", last_name="Choque Apaza", sex=Sex.MALE, date_of_birth=date(1993, 8, 8),
        )
        daniela = make_user(
            gym_id=iron_temple.id, email="daniela.rocha@mail.com", roles=[UserRole.MEMBER],
            first_name="Daniela", last_name="Rocha Peña", sex=Sex.FEMALE, date_of_birth=date(1997, 10, 27),
        )
        ivan = make_user(
            gym_id=iron_temple.id, email="ivan.cespedes@mail.com", roles=[UserRole.MEMBER],
            first_name="Iván", last_name="Céspedes Luna", sex=Sex.MALE, date_of_birth=date(1991, 4, 4),
        )

        db.add_all(
            [
                rol1_superadmin, rol2_admin, rol3_trainer, rol4_nutritionist, rol5_member,
                miguel_trainer, valeria_nutri,
                ana, jorge, lucia, diego, camila, sebastian, fernanda, ricardo, paola,
                andrea_admin, hugo_trainer, marcelo, daniela, ivan,
            ]
        )
        await db.flush()

        # ------------------------------------------------------------------
        # Memberships
        # ------------------------------------------------------------------
        pf_mensual = Membership(
            id=uid(), gym_id=powerfit.id, name="Plan Mensual",
            description="Acceso ilimitado al gimnasio durante 30 días.",
            price=Decimal("150.00"), duration_days=30,
        )
        pf_trimestral = Membership(
            id=uid(), gym_id=powerfit.id, name="Plan Trimestral",
            description="Acceso ilimitado durante 90 días, incluye 1 evaluación física.",
            price=Decimal("400.00"), duration_days=90,
        )
        pf_anual = Membership(
            id=uid(), gym_id=powerfit.id, name="Plan Anual",
            description="Acceso ilimitado durante 365 días, incluye evaluaciones trimestrales.",
            price=Decimal("1400.00"), duration_days=365,
        )
        pf_pase_dia = Membership(
            id=uid(), gym_id=powerfit.id, name="Pase Día",
            description="Acceso por un solo día para visitantes.",
            price=Decimal("20.00"), duration_days=1,
        )
        it_mensual = Membership(
            id=uid(), gym_id=iron_temple.id, name="Plan Básico Mensual",
            description="Acceso al gimnasio durante 30 días.",
            price=Decimal("100.00"), duration_days=30,
        )
        it_trimestral = Membership(
            id=uid(), gym_id=iron_temple.id, name="Plan Trimestral Iron",
            description="Acceso durante 90 días.",
            price=Decimal("270.00"), duration_days=90,
        )
        db.add_all([pf_mensual, pf_trimestral, pf_anual, pf_pase_dia, it_mensual, it_trimestral])
        await db.flush()

        # ------------------------------------------------------------------
        # Subscriptions
        # ------------------------------------------------------------------
        def subscription(gym_id, user, membership, start, duration_days, status):
            return MemberSubscription(
                id=uid(), gym_id=gym_id, user_id=user.id, membership_id=membership.id,
                start_date=start, end_date=start + timedelta(days=duration_days), status=status,
            )

        sub_rol5 = subscription(powerfit.id, rol5_member, pf_mensual, days_ago(10), 30, SubscriptionStatus.ACTIVE)
        sub_ana = subscription(powerfit.id, ana, pf_mensual, days_ago(5), 30, SubscriptionStatus.ACTIVE)
        sub_jorge = subscription(powerfit.id, jorge, pf_trimestral, days_ago(20), 90, SubscriptionStatus.ACTIVE)
        sub_lucia = subscription(powerfit.id, lucia, pf_anual, days_ago(100), 365, SubscriptionStatus.ACTIVE)
        sub_diego = subscription(powerfit.id, diego, pf_mensual, days_ago(2), 30, SubscriptionStatus.ACTIVE)
        sub_camila = subscription(powerfit.id, camila, pf_mensual, days_ago(15), 30, SubscriptionStatus.ACTIVE)
        sub_sebastian = subscription(powerfit.id, sebastian, pf_mensual, days_ago(45), 30, SubscriptionStatus.EXPIRED)
        sub_fernanda = subscription(powerfit.id, fernanda, pf_trimestral, days_ago(150), 90, SubscriptionStatus.EXPIRED)
        sub_ricardo = subscription(powerfit.id, ricardo, pf_mensual, days_ago(40), 30, SubscriptionStatus.CANCELLED)
        sub_paola = subscription(powerfit.id, paola, pf_anual, TODAY, 365, SubscriptionStatus.PENDING)

        sub_marcelo = subscription(iron_temple.id, marcelo, it_mensual, days_ago(3), 30, SubscriptionStatus.ACTIVE)
        sub_daniela = subscription(iron_temple.id, daniela, it_mensual, TODAY, 30, SubscriptionStatus.PENDING)
        sub_ivan = subscription(iron_temple.id, ivan, it_trimestral, days_ago(10), 90, SubscriptionStatus.ACTIVE)

        db.add_all(
            [
                sub_rol5, sub_ana, sub_jorge, sub_lucia, sub_diego, sub_camila,
                sub_sebastian, sub_fernanda, sub_ricardo, sub_paola,
                sub_marcelo, sub_daniela, sub_ivan,
            ]
        )
        await db.flush()

        # ------------------------------------------------------------------
        # Payments
        # ------------------------------------------------------------------
        def payment(
            gym_id, user, amount, method, status=PaymentStatus.COMPLETED,
            payment_type=PaymentType.MEMBERSHIP, subscription=None, membership=None,
            processed_by=None, description=None, reference=None, proof_image=None,
        ):
            return Payment(
                id=uid(), gym_id=gym_id, user_id=user.id if user else None,
                subscription_id=subscription.id if subscription else None,
                membership_id=membership.id if membership else None,
                processed_by_id=processed_by.id if processed_by else None,
                payment_type=payment_type, payment_method=method, status=status,
                amount=amount, currency="BOB", description=description, reference=reference,
                proof_image=proof_image,
            )

        db.add_all(
            [
                payment(powerfit.id, rol5_member, Decimal("150.00"), PaymentMethod.CASH,
                        subscription=sub_rol5, membership=pf_mensual, processed_by=rol2_admin,
                        description="Pago Plan Mensual"),
                payment(powerfit.id, ana, Decimal("150.00"), PaymentMethod.QR,
                        subscription=sub_ana, membership=pf_mensual, processed_by=rol2_admin,
                        description="Pago Plan Mensual", reference="QR-00231"),
                payment(powerfit.id, jorge, Decimal("400.00"), PaymentMethod.TRANSFER,
                        subscription=sub_jorge, membership=pf_trimestral, processed_by=rol2_admin,
                        description="Pago Plan Trimestral", reference="TRF-88213"),
                payment(powerfit.id, lucia, Decimal("1400.00"), PaymentMethod.CARD,
                        subscription=sub_lucia, membership=pf_anual, processed_by=rol2_admin,
                        description="Pago Plan Anual"),
                payment(powerfit.id, diego, Decimal("150.00"), PaymentMethod.CASH,
                        subscription=sub_diego, membership=pf_mensual, processed_by=rol2_admin,
                        description="Pago Plan Mensual"),
                payment(powerfit.id, camila, Decimal("150.00"), PaymentMethod.QR,
                        subscription=sub_camila, membership=pf_mensual, processed_by=rol2_admin,
                        description="Pago Plan Mensual", reference="QR-00255"),
                payment(powerfit.id, sebastian, Decimal("150.00"), PaymentMethod.CASH,
                        subscription=sub_sebastian, membership=pf_mensual, processed_by=rol2_admin,
                        description="Pago Plan Mensual (vencido)"),
                payment(powerfit.id, fernanda, Decimal("400.00"), PaymentMethod.TRANSFER,
                        subscription=sub_fernanda, membership=pf_trimestral, processed_by=rol2_admin,
                        description="Pago Plan Trimestral (vencido)"),
                payment(powerfit.id, ricardo, Decimal("150.00"), PaymentMethod.CASH,
                        status=PaymentStatus.REFUNDED, subscription=sub_ricardo, membership=pf_mensual,
                        processed_by=rol2_admin, description="Reembolso por cancelación de membresía"),
                payment(powerfit.id, paola, Decimal("1400.00"), PaymentMethod.QR,
                        status=PaymentStatus.PENDING, subscription=sub_paola, membership=pf_anual,
                        description="Comprobante de transferencia enviado por la socia",
                        proof_image="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII="),
                payment(powerfit.id, rol5_member, Decimal("25.00"), PaymentMethod.CASH,
                        payment_type=PaymentType.RETAIL, processed_by=rol2_admin,
                        description="Batido proteico"),
                payment(powerfit.id, jorge, Decimal("10.00"), PaymentMethod.CARD,
                        payment_type=PaymentType.OTHER, processed_by=rol2_admin,
                        description="Alquiler de toalla"),
                payment(iron_temple.id, marcelo, Decimal("100.00"), PaymentMethod.CASH,
                        subscription=sub_marcelo, membership=it_mensual, processed_by=andrea_admin,
                        description="Pago Plan Básico Mensual"),
                payment(iron_temple.id, daniela, Decimal("100.00"), PaymentMethod.QR,
                        status=PaymentStatus.PENDING, subscription=sub_daniela, membership=it_mensual,
                        description="Comprobante QR enviado por la socia",
                        proof_image="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII="),
                payment(iron_temple.id, ivan, Decimal("270.00"), PaymentMethod.TRANSFER,
                        subscription=sub_ivan, membership=it_trimestral, processed_by=andrea_admin,
                        description="Pago Plan Trimestral Iron", reference="TRF-55021"),
            ]
        )
        await db.flush()

        # ------------------------------------------------------------------
        # Check-ins
        # ------------------------------------------------------------------
        def checkins_for(gym_id, user, offsets_hours, granted=True, denial_reason=None):
            rows = []
            for off in offsets_hours:
                rows.append(
                    CheckIn(
                        id=uid(), gym_id=gym_id, user_id=user.id,
                        timestamp=datetime.now(timezone.utc) - timedelta(hours=off),
                        access_granted=granted, denial_reason=denial_reason,
                    )
                )
            return rows

        for member, base_hours in [
            (rol5_member, [4, 28, 52, 100, 148, 220]),
            (ana, [6, 30, 78, 150]),
            (jorge, [10, 34, 82, 130, 178]),
            (lucia, [8, 56, 104, 200, 300]),
            (diego, [5, 29]),
            (camila, [7, 55, 103]),
        ]:
            db.add_all(checkins_for(powerfit.id, member, base_hours))

        db.add_all(checkins_for(powerfit.id, sebastian, [12, 300], granted=False, denial_reason="Suscripción expirada"))
        db.add_all(checkins_for(powerfit.id, ricardo, [20], granted=False, denial_reason="Sin suscripción activa"))
        db.add_all(checkins_for(iron_temple.id, marcelo, [3, 27, 51]))
        db.add_all(checkins_for(iron_temple.id, ivan, [9, 33]))
        await db.flush()

        # ------------------------------------------------------------------
        # Physical evaluations
        # ------------------------------------------------------------------
        db.add_all(
            [
                PhysicalEvaluation(
                    id=uid(), gym_id=powerfit.id, user_id=rol5_member.id, evaluated_by_id=rol3_trainer.id,
                    age=30, weight_kg=Decimal("82.50"), height_cm=Decimal("178.00"),
                    body_fat_percentage=Decimal("18.50"), fitness_goal=FitnessGoal.MUSCLE_GAIN,
                    activity_level=ActivityLevel.ACTIVE,
                    notes="Buen progreso en fuerza de tren superior. Aumentar volumen de piernas.",
                ),
                PhysicalEvaluation(
                    id=uid(), gym_id=powerfit.id, user_id=ana.id, evaluated_by_id=miguel_trainer.id,
                    age=32, weight_kg=Decimal("64.00"), height_cm=Decimal("162.00"),
                    body_fat_percentage=Decimal("26.00"), fitness_goal=FitnessGoal.FAT_LOSS,
                    activity_level=ActivityLevel.MODERATE,
                    notes="Objetivo: reducir grasa corporal manteniendo masa muscular.",
                ),
                PhysicalEvaluation(
                    id=uid(), gym_id=powerfit.id, user_id=jorge.id, evaluated_by_id=rol3_trainer.id,
                    age=36, weight_kg=Decimal("90.20"), height_cm=Decimal("175.00"),
                    body_fat_percentage=Decimal("22.00"), fitness_goal=FitnessGoal.MAINTENANCE,
                    activity_level=ActivityLevel.LIGHT,
                    notes="Mantener rutina actual, mejorar consistencia semanal.",
                ),
                PhysicalEvaluation(
                    id=uid(), gym_id=powerfit.id, user_id=lucia.id, evaluated_by_id=miguel_trainer.id,
                    age=27, weight_kg=Decimal("58.00"), height_cm=Decimal("165.00"),
                    body_fat_percentage=Decimal("21.00"), fitness_goal=FitnessGoal.MAINTENANCE,
                    activity_level=ActivityLevel.VERY_ACTIVE,
                    notes="Atleta constante, sin lesiones reportadas.",
                ),
                PhysicalEvaluation(
                    id=uid(), gym_id=powerfit.id, user_id=diego.id, evaluated_by_id=rol3_trainer.id,
                    age=38, weight_kg=Decimal("95.00"), height_cm=Decimal("180.00"),
                    body_fat_percentage=Decimal("28.00"), fitness_goal=FitnessGoal.REHAB,
                    activity_level=ActivityLevel.SEDENTARY,
                    notes="Recuperación post lesión de rodilla, evitar sentadilla profunda.",
                ),
            ]
        )
        await db.flush()

        # ------------------------------------------------------------------
        # Exercises — global catalog (gym_id=None) + one gym-specific each
        # ------------------------------------------------------------------
        def exercise(name, muscle_group, equipment, gym_id=None, description=None, video_url=None):
            e = Exercise(
                id=uid(), gym_id=gym_id, name=name, muscle_group=muscle_group,
                equipment=equipment, description=description, video_url=video_url,
            )
            db.add(e)
            return e

        ex_sentadilla = exercise("Sentadilla con barra", "Piernas", "Barra y rack",
                                  description="Sentadilla trasera con barra olímpica.")
        ex_peso_muerto = exercise("Peso muerto", "Espalda / Piernas", "Barra")
        ex_press_banca = exercise("Press de banca", "Pecho", "Barra y banco")
        ex_press_militar = exercise("Press militar", "Hombros", "Barra")
        ex_dominadas = exercise("Dominadas", "Espalda", "Barra de dominadas")
        ex_remo_barra = exercise("Remo con barra", "Espalda", "Barra")
        ex_curl_biceps = exercise("Curl de bíceps", "Brazos", "Mancuernas")
        ex_ext_triceps = exercise("Extensión de tríceps en polea", "Brazos", "Polea")
        ex_plancha = exercise("Plancha abdominal", "Core", "Peso corporal")
        ex_zancadas = exercise("Zancadas con mancuernas", "Piernas", "Mancuernas")
        ex_elev_laterales = exercise("Elevaciones laterales", "Hombros", "Mancuernas")
        ex_face_pull = exercise("Face pull", "Espalda / Hombros", "Polea")

        ex_powerfit_circuito = exercise(
            "Circuito funcional PowerFit", "Full body", "Kettlebell y TRX", gym_id=powerfit.id,
            description="Circuito propio de PowerFit combinando kettlebells y TRX.",
        )
        ex_iron_combate = exercise(
            "Combate funcional Iron", "Full body", "Sacos y cuerdas", gym_id=iron_temple.id,
            description="Circuito de acondicionamiento propio de Iron Temple.",
        )
        await db.flush()

        # ------------------------------------------------------------------
        # Workout plans
        # ------------------------------------------------------------------
        def plan_item(workout_plan_id, exercise_obj, day, sets, reps, order, rpe=None, rest_seconds=None, notes=None):
            return WorkoutPlanItem(
                id=uid(), workout_plan_id=workout_plan_id, exercise_id=exercise_obj.id,
                day_of_week=day, sets=sets, reps=reps, rpe=rpe, rest_seconds=rest_seconds,
                order=order, notes=notes,
            )

        wp_rol5 = WorkoutPlan(
            id=uid(), gym_id=powerfit.id, user_id=rol5_member.id, created_by_id=rol3_trainer.id,
            name="Plan Fuerza Full Body", fitness_goal=FitnessGoal.MUSCLE_GAIN,
            start_date=days_ago(10), is_active=True,
        )
        db.add(wp_rol5)
        await db.flush()
        wp_rol5_items = [
            plan_item(wp_rol5.id, ex_sentadilla, DayOfWeek.MONDAY, 4, 8, 1, rpe=Decimal("7.0"), rest_seconds=90),
            plan_item(wp_rol5.id, ex_press_banca, DayOfWeek.MONDAY, 4, 8, 2, rpe=Decimal("7.0"), rest_seconds=90),
            plan_item(wp_rol5.id, ex_plancha, DayOfWeek.MONDAY, 3, 45, 3, notes="Reps = segundos sostenidos"),
            plan_item(wp_rol5.id, ex_peso_muerto, DayOfWeek.WEDNESDAY, 4, 6, 1, rpe=Decimal("8.0"), rest_seconds=120),
            plan_item(wp_rol5.id, ex_remo_barra, DayOfWeek.WEDNESDAY, 4, 10, 2, rest_seconds=90),
            plan_item(wp_rol5.id, ex_face_pull, DayOfWeek.WEDNESDAY, 3, 15, 3, rest_seconds=60),
            plan_item(wp_rol5.id, ex_press_militar, DayOfWeek.FRIDAY, 4, 8, 1, rest_seconds=90),
            plan_item(wp_rol5.id, ex_dominadas, DayOfWeek.FRIDAY, 4, 8, 2, rest_seconds=90),
            plan_item(wp_rol5.id, ex_zancadas, DayOfWeek.FRIDAY, 3, 12, 3, rest_seconds=60),
        ]
        db.add_all(wp_rol5_items)

        wp_ana = WorkoutPlan(
            id=uid(), gym_id=powerfit.id, user_id=ana.id, created_by_id=miguel_trainer.id,
            name="Plan Pérdida de Grasa", fitness_goal=FitnessGoal.FAT_LOSS,
            start_date=days_ago(5), is_active=True,
        )
        db.add(wp_ana)
        await db.flush()
        db.add_all(
            [
                plan_item(wp_ana.id, ex_sentadilla, DayOfWeek.MONDAY, 3, 15, 1, rest_seconds=45),
                plan_item(wp_ana.id, ex_zancadas, DayOfWeek.MONDAY, 3, 15, 2, rest_seconds=45),
                plan_item(wp_ana.id, ex_plancha, DayOfWeek.MONDAY, 3, 40, 3),
                plan_item(wp_ana.id, ex_remo_barra, DayOfWeek.TUESDAY, 3, 12, 1, rest_seconds=60),
                plan_item(wp_ana.id, ex_curl_biceps, DayOfWeek.TUESDAY, 3, 12, 2, rest_seconds=45),
                plan_item(wp_ana.id, ex_peso_muerto, DayOfWeek.THURSDAY, 3, 10, 1, rest_seconds=90),
                plan_item(wp_ana.id, ex_elev_laterales, DayOfWeek.THURSDAY, 3, 15, 2, rest_seconds=45),
            ]
        )

        wp_jorge = WorkoutPlan(
            id=uid(), gym_id=powerfit.id, user_id=jorge.id, created_by_id=rol3_trainer.id,
            name="Plan Mantenimiento", fitness_goal=FitnessGoal.MAINTENANCE,
            start_date=days_ago(20), end_date=days_ago(1), is_active=False,
        )
        db.add(wp_jorge)
        await db.flush()
        db.add_all(
            [
                plan_item(wp_jorge.id, ex_press_banca, DayOfWeek.MONDAY, 3, 10, 1, rest_seconds=60),
                plan_item(wp_jorge.id, ex_curl_biceps, DayOfWeek.MONDAY, 3, 12, 2, rest_seconds=45),
                plan_item(wp_jorge.id, ex_sentadilla, DayOfWeek.FRIDAY, 3, 10, 1, rest_seconds=60),
            ]
        )

        wp_marcelo = WorkoutPlan(
            id=uid(), gym_id=iron_temple.id, user_id=marcelo.id, created_by_id=hugo_trainer.id,
            name="Plan Inicial Iron", fitness_goal=FitnessGoal.FAT_LOSS,
            start_date=days_ago(3), is_active=True,
        )
        db.add(wp_marcelo)
        await db.flush()
        db.add_all(
            [
                plan_item(wp_marcelo.id, ex_sentadilla, DayOfWeek.MONDAY, 3, 12, 1, rest_seconds=60),
                plan_item(wp_marcelo.id, ex_iron_combate, DayOfWeek.MONDAY, 3, 10, 2, rest_seconds=60),
            ]
        )
        await db.flush()

        # ------------------------------------------------------------------
        # Workout completions (adherence tracking)
        # ------------------------------------------------------------------
        db.add_all(
            [
                WorkoutCompletion(id=uid(), gym_id=powerfit.id, user_id=rol5_member.id,
                                   workout_plan_item_id=wp_rol5_items[0].id, completed_date=days_ago(7)),
                WorkoutCompletion(id=uid(), gym_id=powerfit.id, user_id=rol5_member.id,
                                   workout_plan_item_id=wp_rol5_items[1].id, completed_date=days_ago(7)),
                WorkoutCompletion(id=uid(), gym_id=powerfit.id, user_id=rol5_member.id,
                                   workout_plan_item_id=wp_rol5_items[3].id, completed_date=days_ago(5)),
                WorkoutCompletion(id=uid(), gym_id=powerfit.id, user_id=rol5_member.id,
                                   workout_plan_item_id=wp_rol5_items[6].id, completed_date=days_ago(3)),
            ]
        )

        # ------------------------------------------------------------------
        # Nutrition plans + logs
        # ------------------------------------------------------------------
        np_rol5 = NutritionPlan(
            id=uid(), gym_id=powerfit.id, user_id=rol5_member.id, created_by_id=rol4_nutritionist.id,
            fitness_goal=FitnessGoal.MUSCLE_GAIN, bmr=Decimal("1750.00"), tdee=Decimal("2450.00"),
            calories=2600, protein_g=180, carbs_g=280, fats_g=80, water_ml=3000,
            start_date=days_ago(10), is_active=True, notes="Prioridad: superávit calórico moderado.",
        )
        np_ana = NutritionPlan(
            id=uid(), gym_id=powerfit.id, user_id=ana.id, created_by_id=valeria_nutri.id,
            fitness_goal=FitnessGoal.FAT_LOSS, bmr=Decimal("1400.00"), tdee=Decimal("1900.00"),
            calories=1600, protein_g=130, carbs_g=140, fats_g=50, water_ml=2500,
            start_date=days_ago(5), is_active=True, notes="Déficit moderado, alto en proteína.",
        )
        np_lucia = NutritionPlan(
            id=uid(), gym_id=powerfit.id, user_id=lucia.id, created_by_id=rol4_nutritionist.id,
            fitness_goal=FitnessGoal.MAINTENANCE, bmr=Decimal("1500.00"), tdee=Decimal("2100.00"),
            calories=2100, protein_g=140, carbs_g=220, fats_g=65, water_ml=2700,
            start_date=days_ago(30), is_active=True,
        )
        db.add_all([np_rol5, np_ana, np_lucia])

        db.add_all(
            [
                NutritionLog(id=uid(), gym_id=powerfit.id, user_id=rol5_member.id, log_date=days_ago(1),
                             protein_g=Decimal("175.0"), carbs_g=Decimal("270.0"), fats_g=Decimal("78.0")),
                NutritionLog(id=uid(), gym_id=powerfit.id, user_id=rol5_member.id, log_date=days_ago(2),
                             protein_g=Decimal("182.0"), carbs_g=Decimal("290.0"), fats_g=Decimal("82.0")),
                NutritionLog(id=uid(), gym_id=powerfit.id, user_id=rol5_member.id, log_date=days_ago(3),
                             protein_g=Decimal("168.0"), carbs_g=Decimal("260.0"), fats_g=Decimal("75.0")),
                NutritionLog(id=uid(), gym_id=powerfit.id, user_id=ana.id, log_date=days_ago(1),
                             protein_g=Decimal("128.0"), carbs_g=Decimal("135.0"), fats_g=Decimal("48.0")),
                NutritionLog(id=uid(), gym_id=powerfit.id, user_id=ana.id, log_date=days_ago(2),
                             protein_g=Decimal("132.0"), carbs_g=Decimal("138.0"), fats_g=Decimal("52.0")),
            ]
        )

        # ------------------------------------------------------------------
        # Notifications
        # ------------------------------------------------------------------
        now = datetime.now(timezone.utc)
        db.add_all(
            [
                Notification(id=uid(), gym_id=powerfit.id, user_id=rol5_member.id,
                             kind="payment_approved", title="Pago aprobado",
                             body="Tu pago de Bs 150.00 fue aprobado. ¡Bienvenido de nuevo!",
                             related_id=sub_rol5.id, read_at=now - timedelta(days=9)),
                Notification(id=uid(), gym_id=powerfit.id, user_id=sebastian.id,
                             kind="subscription_expiring", title="Tu suscripción está por vencer",
                             body="Tu membresía Plan Mensual vence pronto. Renueva para seguir entrenando.",
                             related_id=sub_sebastian.id),
                Notification(id=uid(), gym_id=powerfit.id, user_id=paola.id,
                             kind="payment_pending", title="Pago en revisión",
                             body="Tu pago de Bs 1400.00 está pendiente de aprobación por el administrador.",
                             related_id=sub_paola.id),
                Notification(id=uid(), gym_id=powerfit.id, user_id=rol2_admin.id,
                             kind="payment_pending", title="Nuevo pago por revisar",
                             body="Paola Aguilar registró un pago pendiente de Bs 1400.00.",
                             related_id=sub_paola.id),
                Notification(id=uid(), gym_id=iron_temple.id, user_id=andrea_admin.id,
                             kind="payment_pending", title="Nuevo pago por revisar",
                             body="Daniela Rocha registró un pago pendiente de Bs 100.00.",
                             related_id=sub_daniela.id),
            ]
        )

        # ------------------------------------------------------------------
        # Promotions
        # ------------------------------------------------------------------
        db.add_all(
            [
                Promotion(id=uid(), gym_id=powerfit.id, membership_id=pf_mensual.id,
                          name="Promo Bienvenida", description="15% de descuento en tu primer Plan Mensual.",
                          discount_type=DiscountType.PERCENTAGE, discount_value=Decimal("15.00"),
                          start_date=days_ago(30), end_date=TODAY + timedelta(days=30), is_active=True),
                Promotion(id=uid(), gym_id=powerfit.id, membership_id=None,
                          name="Descuento Aniversario", description="Bs 200 de descuento en cualquier plan.",
                          discount_type=DiscountType.FIXED_AMOUNT, discount_value=Decimal("200.00"),
                          start_date=days_ago(5), end_date=TODAY + timedelta(days=10), is_active=True),
            ]
        )

        # ------------------------------------------------------------------
        # Gym audit logs
        # ------------------------------------------------------------------
        db.add_all(
            [
                GymAuditLog(id=uid(), gym_id=powerfit.id, actor_id=rol1_superadmin.id,
                            action="status_changed:TRIAL->ACTIVE", reason=None),
                GymAuditLog(id=uid(), gym_id=powerfit.id, actor_id=rol1_superadmin.id,
                            action="plan_tier_changed:BASIC->PRO", reason="Upgrade solicitado por el gimnasio"),
                GymAuditLog(id=uid(), gym_id=iron_temple.id, actor_id=rol1_superadmin.id,
                            action="plan_tier_changed:FREE->BASIC", reason="Activación de prueba gratuita"),
            ]
        )

        await db.commit()
        print("Datos de prueba insertados correctamente.")
        print(f" - Gyms: {powerfit.name}, {iron_temple.name}")
        print(" - Usuarios por rol (password '12345' para todos):")
        print(f"   SUPERADMIN     rol1@subgym.com")
        print(f"   GYM_ADMIN      rol2@subgym.com   (gym: {powerfit.name})")
        print(f"   TRAINER        rol3@subgym.com   (gym: {powerfit.name})")
        print(f"   NUTRITIONIST   rol4@subgym.com   (gym: {powerfit.name})")
        print(f"   MEMBER         rol5@subgym.com   (gym: {powerfit.name})")


async def main() -> None:
    database_url = os.environ.get("SEED_DATABASE_URL") or os.environ.get("MIGRATION_DATABASE_URL")
    if not database_url:
        from app.core.config import settings

        database_url = settings.DATABASE_URL
        print("Aviso: usando settings.DATABASE_URL (rol restringido); si tiene RLS forzado y no es "
              "superusuario, los inserts entre distintos gyms pueden fallar. Define "
              "MIGRATION_DATABASE_URL o SEED_DATABASE_URL para usar el rol con privilegios de dueño de tabla.")

    engine = create_async_engine(database_url)
    session_factory = async_sessionmaker(engine, expire_on_commit=False)
    try:
        await seed(session_factory)
    finally:
        await engine.dispose()


if __name__ == "__main__":
    asyncio.run(main())
