from __future__ import annotations

from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from hmac import compare_digest
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from hring_api.config import Settings
from hring_api.domains.admin.repository import add_audit_log
from hring_api.domains.billing.credit_service import CreditError, add_available_credits_for_plan
from hring_api.domains.billing.models import BillingPlan, PaymentTransaction
from hring_api.domains.billing.pricing import ExchangeRateError, assert_pricing_is_safe
from hring_api.domains.identity.dependencies import Principal
from hring_api.domains.identity.models import Company, Profile
from hring_api.integrations.payment.base import PaymentProviderError, PaymentVerifyResult
from hring_api.integrations.payment.providers import SepPaymentProvider, get_payment_provider


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


@dataclass(frozen=True)
class SepCallbackResult:
    authority: str
    verified: bool
    ref_id: str | None = None
    already_verified: bool = False


def _corporate_company_id(principal: Principal) -> UUID | None:
    for membership in principal.memberships:
        if membership.is_active and membership.role in {"ceo", "deputy"}:
            return membership.company_id
    return None


def _callback_url(settings: Settings, *, provider: str) -> str:
    path = (
        "/api/v1/billing/payments/sep/callback"
        if provider == "sep"
        else settings.payment_callback_path
    )
    return f"{settings.public_app_url.rstrip('/')}{path}"


async def list_billing_plans(
    db: AsyncSession, *, include_inactive: bool = False
) -> list[BillingPlan]:
    statement = select(BillingPlan).order_by(BillingPlan.price_toman.asc())
    if not include_inactive:
        statement = statement.where(BillingPlan.is_active.is_(True))
    result = await db.execute(statement)
    return list(result.scalars().all())


async def list_payment_transactions(
    db: AsyncSession,
    *,
    principal: Principal,
    limit: int = 200,
) -> list[PaymentTransaction]:
    result = await db.execute(
        select(PaymentTransaction)
        .where(PaymentTransaction.user_id == principal.user_id)
        .order_by(PaymentTransaction.created_at.desc(), PaymentTransaction.id.desc())
        .limit(limit)
    )
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
    if plan.scope == "corporate":
        raise BillingForbiddenError("Corporate plans require contacting support")
    try:
        await assert_pricing_is_safe(db, plan)
    except ExchangeRateError as exc:
        raise BillingUnavailableError(str(exc)) from exc

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
            callback_url=_callback_url(settings, provider=payment_provider.name),
            email=principal.user.email,
            plan_type=plan.plan_type,
            order_id=str(transaction.id),
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


async def _finalize_verified_payment(
    db: AsyncSession,
    *,
    transaction: PaymentTransaction,
    verified: PaymentVerifyResult,
    actor_user_id: UUID,
    request_id: str | None = None,
    ip_address: str | None = None,
) -> PaymentVerifiedResult:
    locked_result = await db.execute(
        select(PaymentTransaction)
        .where(PaymentTransaction.id == transaction.id)
        .with_for_update()
        .execution_options(populate_existing=True)
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
    owner_type = "company" if locked.company_id is not None else "user"
    owner_id = locked.company_id or locked.user_id
    try:
        credit_account = await add_available_credits_for_plan(
            db,
            owner_type=owner_type,
            owner_id=owner_id,
            credits=plan.monthly_credits,
            operation_key=f"payment:{locked.id}",
            actor_user_id=actor_user_id,
            request_id=request_id,
            grant_reason="Verified plan credit grant",
            source="verified_payment",
            valid_until=now + timedelta(hours=720),
        )
    except CreditError as exc:
        await db.rollback()
        raise PaymentVerificationError("Payment credit reconciliation failed") from exc

    if locked.company_id is not None:
        company = await db.get(Company, locked.company_id)
        if company is None:
            raise BillingNotFoundError("Company no longer exists")
        company.subscription_tier = plan.plan_type
        company.monthly_credits = credit_account.available_credits
        company.used_credits = 0
        company.credit_pool = credit_account.available_credits
        company.last_credit_reset = now
    else:
        profile = await db.get(Profile, locked.user_id)
        if profile is None:
            raise BillingNotFoundError("User profile no longer exists")
        profile.subscription_tier = plan.plan_type
        profile.monthly_credits = credit_account.available_credits
        profile.used_credits = 0
        profile.last_credit_reset = now

    locked.status = "verified"
    locked.ref_id = verified.ref_id
    locked.verified_at = now
    await add_audit_log(
        db,
        actor_user_id=actor_user_id,
        company_id=locked.company_id,
        action="billing.payment.verified",
        resource_type="payment_transaction",
        resource_id=str(locked.id),
        metadata_json={
            "plan_type": plan.plan_type,
            "monthly_credits": plan.monthly_credits,
            "balance_after_grant": credit_account.available_credits,
            "grant_mode": "additive_rollover",
            "valid_for_hours": 720,
            "valid_until": (now + timedelta(hours=720)).isoformat(),
            "authority": locked.authority or "",
            "ref_id": verified.ref_id or "",
            "request_id": request_id or "",
        },
        ip_address=ip_address,
    )
    await db.commit()
    return PaymentVerifiedResult(
        ref_id=verified.ref_id,
        already_verified=verified.already_verified,
    )


async def verify_payment(
    db: AsyncSession,
    *,
    principal: Principal,
    authority: str,
    settings: Settings,
    request_id: str | None = None,
    ip_address: str | None = None,
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
        if payment_provider.name != transaction.provider:
            raise PaymentProviderError("Payment provider does not match the transaction")
        verified = await payment_provider.verify_payment(
            amount_rial=transaction.amount_toman * 10,
            authority=authority,
        )
    except PaymentProviderError as exc:
        raise BillingUnavailableError("Payment verification service is unavailable") from exc

    return await _finalize_verified_payment(
        db,
        transaction=transaction,
        verified=verified,
        actor_user_id=principal.user_id,
        request_id=request_id,
        ip_address=ip_address,
    )


async def verify_sep_callback(
    db: AsyncSession,
    *,
    res_num: str,
    token: str,
    ref_num: str | None,
    state: str,
    terminal_id: str,
    amount_rial: int,
    settings: Settings,
    request_id: str | None = None,
    ip_address: str | None = None,
) -> SepCallbackResult:
    try:
        transaction_id = UUID(res_num)
    except ValueError as exc:
        raise BillingNotFoundError("Payment transaction not found") from exc
    transaction = await db.get(PaymentTransaction, transaction_id)
    if transaction is None or transaction.provider != "sep" or not transaction.authority:
        raise BillingNotFoundError("Payment transaction not found")

    try:
        payment_provider = await get_payment_provider(db, settings)
    except PaymentProviderError as exc:
        raise BillingUnavailableError("Payment verification service is unavailable") from exc
    if not isinstance(payment_provider, SepPaymentProvider):
        raise BillingUnavailableError("SEP provider is not active")
    configured_terminal = payment_provider.terminal_id
    if (
        not compare_digest(transaction.authority, token.strip())
        or not configured_terminal
        or not compare_digest(configured_terminal, terminal_id.strip())
        or amount_rial != transaction.amount_toman * 10
    ):
        raise PaymentVerificationError("SEP callback validation failed")

    if transaction.status == "verified":
        return SepCallbackResult(
            authority=transaction.authority,
            verified=True,
            ref_id=transaction.ref_id,
            already_verified=True,
        )
    if transaction.status != "pending":
        return SepCallbackResult(authority=transaction.authority, verified=False)
    if state.strip().upper() != "OK":
        transaction.status = "cancelled"
        await db.commit()
        return SepCallbackResult(authority=transaction.authority, verified=False)
    if not ref_num or not ref_num.strip():
        raise PaymentVerificationError("SEP reference number is missing")

    try:
        verified = await payment_provider.verify_payment(
            amount_rial=transaction.amount_toman * 10,
            authority=transaction.authority,
            reference_number=ref_num.strip(),
        )
    except PaymentProviderError as exc:
        raise BillingUnavailableError("Payment verification service is unavailable") from exc

    try:
        finalized = await _finalize_verified_payment(
            db,
            transaction=transaction,
            verified=verified,
            actor_user_id=transaction.user_id,
            request_id=request_id,
            ip_address=ip_address,
        )
    except PaymentVerificationError:
        return SepCallbackResult(authority=transaction.authority, verified=False)
    return SepCallbackResult(
        authority=transaction.authority,
        verified=True,
        ref_id=finalized.ref_id,
        already_verified=finalized.already_verified,
    )
