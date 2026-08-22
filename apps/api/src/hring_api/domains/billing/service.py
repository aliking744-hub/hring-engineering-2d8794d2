from __future__ import annotations

from dataclasses import dataclass
from datetime import UTC, datetime
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from hring_api.config import Settings
from hring_api.domains.billing.models import BillingPlan, PaymentTransaction
from hring_api.domains.identity.dependencies import Principal
from hring_api.domains.identity.models import Company, Profile
from hring_api.integrations.payment.base import PaymentProviderError
from hring_api.integrations.payment.providers import get_payment_provider


class BillingError(RuntimeError):
    pass


class BillingForbiddenError(BillingError):
    pass


class BillingUnavailableError(BillingError):
    pass


class BillingNotFoundError(BillingError):
    pass


class PaymentVerificationError(BillingError):
    pass


@dataclass(frozen=True)
class PaymentInitResult:
    authority: str
    payment_url: str


@dataclass(frozen=True)
class PaymentVerifiedResult:
    ref_id: str | None
    already_verified: bool


def _corporate_company_id(principal: Principal) -> UUID | None:
    for membership in principal.memberships:
        if membership.is_active and membership.role in {"ceo", "deputy"}:
            return membership.company_id
    return None


def _callback_url(settings: Settings) -> str:
    return f"{settings.public_app_url.rstrip('/')}{settings.payment_callback_path}"


async def list_billing_plans(db: AsyncSession, *, include_inactive: bool = False) -> list[BillingPlan]:
    statement = select(BillingPlan).order_by(BillingPlan.price_toman.asc())
    if not include_inactive:
        statement = statement.where(BillingPlan.is_active.is_(True))
    result = await db.execute(statement)
    return list(result.scalars().all())


async def initialize_payment(
    db: AsyncSession,
    *,
    principal: Principal,
    plan_type: str,
    settings: Settings,
) -> PaymentInitResult:
    plan = await db.get(BillingPlan, plan_type)
    if plan is None or not plan.is_active or plan.price_toman <= 0:
        raise BillingNotFoundError("Selected billing plan is not available")

    company_id: UUID | None = None
    if plan.scope == "corporate":
        company_id = _corporate_company_id(principal)
        if company_id is None:
            raise BillingForbiddenError("Corporate plans require CEO or deputy access")

    try:
        payment_provider = await get_payment_provider(db, settings)
    except PaymentProviderError as exc:
        raise BillingUnavailableError("Payment provider is not configured or unavailable") from exc

    transaction = PaymentTransaction(
        user_id=principal.user_id,
        company_id=company_id,
        provider=payment_provider.name,
        amount_toman=plan.price_toman,
        plan_type=plan.plan_type,
        status="pending",
        description=f"ارتقا به پلن {plan.plan_type}",
    )
    db.add(transaction)
    await db.commit()

    try:
        requested = await payment_provider.request_payment(
            amount_rial=plan.price_toman * 10,
            description=transaction.description or f"HRing {plan.plan_type}",
            callback_url=_callback_url(settings),
            email=principal.user.email,
            plan_type=plan.plan_type,
        )
    except PaymentProviderError as exc:
        transaction.status = "failed"
        await db.commit()
        raise BillingUnavailableError("Payment provider is not configured or unavailable") from exc

    transaction.authority = requested.authority
    await db.commit()
    return PaymentInitResult(
        authority=requested.authority,
        payment_url=requested.payment_url,
    )


async def verify_payment(
    db: AsyncSession,
    *,
    principal: Principal,
    authority: str,
    settings: Settings,
) -> PaymentVerifiedResult:
    result = await db.execute(
        select(PaymentTransaction).where(PaymentTransaction.authority == authority)
    )
    transaction = result.scalar_one_or_none()
    if transaction is None:
        raise BillingNotFoundError("Payment transaction not found")
    if transaction.user_id != principal.user_id:
        raise BillingForbiddenError("Payment transaction does not belong to this account")
    if transaction.status == "verified":
        return PaymentVerifiedResult(ref_id=transaction.ref_id, already_verified=True)
    if transaction.status != "pending":
        raise PaymentVerificationError("Payment transaction is not pending")

    try:
        payment_provider = await get_payment_provider(db, settings)
        verified = await payment_provider.verify_payment(
            amount_rial=transaction.amount_toman * 10,
            authority=authority,
        )
    except PaymentProviderError as exc:
        raise BillingUnavailableError("Payment verification service is unavailable") from exc

    locked_result = await db.execute(
        select(PaymentTransaction)
        .where(PaymentTransaction.id == transaction.id)
        .with_for_update()
    )
    locked = locked_result.scalar_one()
    if locked.status == "verified":
        return PaymentVerifiedResult(ref_id=locked.ref_id, already_verified=True)
    if not verified.verified:
        locked.status = "failed"
        await db.commit()
        raise PaymentVerificationError("Payment verification failed")

    plan = await db.get(BillingPlan, locked.plan_type)
    if plan is None:
        raise BillingNotFoundError("Billing plan no longer exists")
    now = datetime.now(UTC)
    if locked.company_id is not None:
        company_result = await db.execute(
            select(Company).where(Company.id == locked.company_id).with_for_update()
        )
        company = company_result.scalar_one_or_none()
        if company is None:
            raise BillingNotFoundError("Company no longer exists")
        company.subscription_tier = plan.plan_type
        company.monthly_credits = plan.monthly_credits
        company.used_credits = 0
        company.credit_pool = plan.monthly_credits
        company.last_credit_reset = now
    else:
        profile_result = await db.execute(
            select(Profile).where(Profile.id == locked.user_id).with_for_update()
        )
        profile = profile_result.scalar_one_or_none()
        if profile is None:
            raise BillingNotFoundError("User profile no longer exists")
        profile.subscription_tier = plan.plan_type
        profile.monthly_credits = plan.monthly_credits
        profile.used_credits = 0
        profile.last_credit_reset = now

    locked.status = "verified"
    locked.ref_id = verified.ref_id
    locked.verified_at = now
    await db.commit()
    return PaymentVerifiedResult(
        ref_id=verified.ref_id,
        already_verified=verified.already_verified,
    )
