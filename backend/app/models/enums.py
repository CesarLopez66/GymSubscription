import enum
from decimal import Decimal


class UserRole(str, enum.Enum):
    SUPERADMIN = "SUPERADMIN"
    GYM_ADMIN = "GYM_ADMIN"
    BRANCH_MANAGER = "BRANCH_MANAGER"
    TRAINER = "TRAINER"
    NUTRITIONIST = "NUTRITIONIST"
    MEMBER = "MEMBER"


class GymStatus(str, enum.Enum):
    TRIAL = "TRIAL"
    ACTIVE = "ACTIVE"
    SUSPENDED = "SUSPENDED"
    CANCELLED = "CANCELLED"


class SaaSPlanTier(str, enum.Enum):
    FREE = "FREE"
    BASIC = "BASIC"
    PRO = "PRO"
    ENTERPRISE = "ENTERPRISE"


# Maximum number of MEMBER-role users a gym may have while on each tier.
# None means unlimited.
SAAS_PLAN_MEMBER_LIMITS: dict["SaaSPlanTier", int | None] = {
    SaaSPlanTier.FREE: 25,
    SaaSPlanTier.BASIC: 100,
    SaaSPlanTier.PRO: 500,
    SaaSPlanTier.ENTERPRISE: None,
}

# Monthly price (Bs) a gym pays the platform for each tier. FREE never
# requires a payment; ENTERPRISE has no self-service price — it's arranged
# directly with the superadmin, so it's excluded from the self-service
# upgrade flow entirely (see gym_subscription_service.submit_subscription_payment).
# Placeholders until real pricing is set — change here, no other code depends
# on the actual numbers.
SAAS_PLAN_PRICES: dict["SaaSPlanTier", Decimal | None] = {
    SaaSPlanTier.FREE: Decimal("0"),
    SaaSPlanTier.BASIC: Decimal("150"),
    SaaSPlanTier.PRO: Decimal("400"),
    SaaSPlanTier.ENTERPRISE: None,
}


class SubscriptionRequestStatus(str, enum.Enum):
    PENDING = "PENDING"
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"


class SubscriptionStatus(str, enum.Enum):
    ACTIVE = "ACTIVE"
    EXPIRED = "EXPIRED"
    CANCELLED = "CANCELLED"
    PENDING = "PENDING"


class DiscountType(str, enum.Enum):
    PERCENTAGE = "PERCENTAGE"
    FIXED_AMOUNT = "FIXED_AMOUNT"


class Sex(str, enum.Enum):
    MALE = "MALE"
    FEMALE = "FEMALE"


class FitnessGoal(str, enum.Enum):
    FAT_LOSS = "FAT_LOSS"
    MUSCLE_GAIN = "MUSCLE_GAIN"
    MAINTENANCE = "MAINTENANCE"
    REHAB = "REHAB"


class ActivityLevel(str, enum.Enum):
    SEDENTARY = "SEDENTARY"
    LIGHT = "LIGHT"
    MODERATE = "MODERATE"
    ACTIVE = "ACTIVE"
    VERY_ACTIVE = "VERY_ACTIVE"


class PaymentType(str, enum.Enum):
    MEMBERSHIP = "MEMBERSHIP"
    RETAIL = "RETAIL"
    OTHER = "OTHER"


class PaymentMethod(str, enum.Enum):
    QR = "QR"
    CASH = "CASH"
    CARD = "CARD"
    TRANSFER = "TRANSFER"
    OTHER = "OTHER"


class PaymentStatus(str, enum.Enum):
    PENDING = "PENDING"
    COMPLETED = "COMPLETED"
    REFUNDED = "REFUNDED"
    FAILED = "FAILED"


class DayOfWeek(str, enum.Enum):
    MONDAY = "MONDAY"
    TUESDAY = "TUESDAY"
    WEDNESDAY = "WEDNESDAY"
    THURSDAY = "THURSDAY"
    FRIDAY = "FRIDAY"
    SATURDAY = "SATURDAY"
    SUNDAY = "SUNDAY"
