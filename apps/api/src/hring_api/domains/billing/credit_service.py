from __future__ import annotations

from collections.abc import Awaitable, Callable
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from typing import Any, TypeVar
from uuid import UUID

from sqlalchemy import func, or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from hring_api.domains.admin.repository import add_audit_log
from hring_api.domains.billing.models import (
    AiExecutionLease,
    CreditAccount,
    CreditLedgerEntry,
    CreditReservation,
)
from hring_api.domains.identity.dependencies import Principal
from hring_api.domains.identity.models import Company, FeaturePermission, Profile, User


class CreditError(RuntimeError):
    pass


class CreditNotFoundError(CreditError):
    pass


class CreditForbiddenError(CreditError):
    pass


class CreditConflictError(CreditError):
    pass


class InsufficientCreditsError(CreditError):
    pass


class CreditReservationExpiredError(CreditConflictError):
    pass


@dataclass(frozen=True)
class CreditBalance:
    account: CreditAccount
    owner_id: UUID
    ledger_available: int
    ledger_reserved: int

    @property
    def reconciled(self) -> bool:
        return (
            self.account.available_credits == self.ledger_available
            and self.account.reserved_credits == self.ledger_reserved
        )


@dataclass(frozen=True)
class CreditReservationResult:
    reservation: CreditReservation
    idempotent_replay: bool


@dataclass(frozen=True)
class AdminCreditAccountSummary:
    account_id: UUID | None
    owner_type: str
    owner_id: UUID
    owner_label: str
    owner_secondary_label: str | None
    available_credits: int
    reserved_credits: int
    legacy_available_credits: int
    projection_reconciled: bool


@dataclass(frozen=True)
class CreditReconciliation:
    account_id: UUID
    projected_available: int
    ledger_available: int
    projected_reserved: int
    ledger_reserved: int
    legacy_available: int

    @property
    def reconciled(self) -> bool:
        return (
            self.projected_available == self.ledger_available
            and self.projected_reserved == self.ledger_reserved
            and self.projected_available == self.legacy_available
        )


T = TypeVar("T")
OwnerModel = Profile | Company


def _account_owner_id(account: CreditAccount) -> UUID:
    owner_id = account.user_id if account.owner_type == "user" else account.company_id
    if owner_id is None:
        raise CreditConflictError("Credit account owner scope is invalid")
    return owner_id


def _legacy_available(owner: OwnerModel) -> int:
    if isinstance(owner, Company) and owner.credit_pool_enabled:
        return max(0, int(owner.credit_pool or 0))
    return max(0, int(owner.monthly_credits) - int(owner.used_credits))


async def _lock_owner(
    session: AsyncSession,
    *,
    owner_type: str,
    owner_id: UUID,
) -> OwnerModel:
    if owner_type == "user":
        result = await session.execute(
            select(Profile).where(Profile.id == owner_id).with_for_update()
        )
        owner = result.scalar_one_or_none()
    elif owner_type == "company":
        result = await session.execute(
            select(Company).where(Company.id == owner_id).with_for_update()
        )
        owner = result.scalar_one_or_none()
    else:
        raise CreditConflictError("Unsupported credit owner type")
    if owner is None:
        raise CreditNotFoundError("Credit owner not found")
    return owner


async def _find_account(
    session: AsyncSession,
    *,
    owner_type: str,
    owner_id: UUID,
    for_update: bool,
) -> CreditAccount | None:
    if owner_type == "user":
        statement = select(CreditAccount).where(CreditAccount.user_id == owner_id)
    else:
        statement = select(CreditAccount).where(CreditAccount.company_id == owner_id)
    if for_update:
        statement = statement.with_for_update()
    result = await session.execute(statement)
    return result.scalar_one_or_none()


async def _append_entry(
    session: AsyncSession,
    *,
    account: CreditAccount,
    event_type: str,
    amount: int,
    available_delta: int,
    reserved_delta: int,
    idempotency_key: str,
    actor_user_id: UUID | None = None,
    reservation_id: UUID | None = None,
    feature_key: str | None = None,
    reason: str | None = None,
    description: str | None = None,
    request_id: str | None = None,
    metadata_json: dict[str, object] | None = None,
) -> tuple[CreditLedgerEntry, bool]:
    existing_result = await session.execute(
        select(CreditLedgerEntry).where(
            CreditLedgerEntry.account_id == account.id,
            CreditLedgerEntry.idempotency_key == idempotency_key,
        )
    )
    existing = existing_result.scalar_one_or_none()
    if existing is not None:
        if (
            existing.event_type != event_type
            or existing.amount != amount
            or existing.available_delta != available_delta
            or existing.reserved_delta != reserved_delta
            or existing.reservation_id != reservation_id
            or existing.feature_key != feature_key
            or existing.reason != reason
        ):
            raise CreditConflictError("Idempotency key was already used for another operation")
        return existing, True

    entry = CreditLedgerEntry(
        account_id=account.id,
        reservation_id=reservation_id,
        actor_user_id=actor_user_id,
        event_type=event_type,
        amount=amount,
        available_delta=available_delta,
        reserved_delta=reserved_delta,
        idempotency_key=idempotency_key,
        feature_key=feature_key,
        reason=reason,
        description=description,
        request_id=request_id,
        metadata_json=metadata_json or {},
    )
    session.add(entry)
    await session.flush()
    return entry, False


async def _lock_account_for_owner(
    session: AsyncSession,
    *,
    owner_type: str,
    owner_id: UUID,
) -> tuple[CreditAccount, OwnerModel]:
    # The stable owner row serializes first-account creation and keeps lock ordering uniform.
    owner = await _lock_owner(session, owner_type=owner_type, owner_id=owner_id)
    account = await _find_account(
        session,
        owner_type=owner_type,
        owner_id=owner_id,
        for_update=True,
    )
    if account is not None:
        return account, owner

    initial_available = _legacy_available(owner)
    account = CreditAccount(
        owner_type=owner_type,
        user_id=owner_id if owner_type == "user" else None,
        company_id=owner_id if owner_type == "company" else None,
        available_credits=initial_available,
        reserved_credits=0,
    )
    session.add(account)
    await session.flush()
    if initial_available > 0:
        await _append_entry(
            session,
            account=account,
            event_type="grant",
            amount=initial_available,
            available_delta=initial_available,
            reserved_delta=0,
            idempotency_key=f"bootstrap:{owner_type}:{owner_id}",
            reason="Legacy credit projection bootstrap",
            metadata_json={"source": "legacy_projection"},
        )
    return account, owner


async def _sync_legacy_projection(
    account: CreditAccount,
    owner: OwnerModel,
) -> None:
    available = int(account.available_credits)
    if available > int(owner.monthly_credits):
        owner.monthly_credits = available
        owner.used_credits = 0
    else:
        owner.used_credits = max(0, int(owner.monthly_credits) - available)
    if isinstance(owner, Company):
        owner.credit_pool = available


async def _ledger_totals(session: AsyncSession, account_id: UUID) -> tuple[int, int]:
    result = await session.execute(
        select(
            func.coalesce(func.sum(CreditLedgerEntry.available_delta), 0),
            func.coalesce(func.sum(CreditLedgerEntry.reserved_delta), 0),
        ).where(CreditLedgerEntry.account_id == account_id)
    )
    row = result.one()
    return int(row[0]), int(row[1])


async def _expire_due_reservations_locked(
    session: AsyncSession,
    *,
    account: CreditAccount,
    owner: OwnerModel,
    request_id: str | None,
) -> int:
    now = datetime.now(UTC)
    result = await session.execute(
        select(CreditReservation)
        .where(
            CreditReservation.account_id == account.id,
            CreditReservation.status == "active",
            CreditReservation.expires_at <= now,
        )
        .order_by(CreditReservation.created_at)
        .with_for_update()
    )
    expired = list(result.scalars().all())
    for reservation in expired:
        await _append_entry(
            session,
            account=account,
            event_type="expire",
            amount=reservation.amount,
            available_delta=reservation.amount,
            reserved_delta=-reservation.amount,
            idempotency_key=f"reservation:{reservation.id}:expire",
            actor_user_id=reservation.created_by_user_id,
            reservation_id=reservation.id,
            feature_key=reservation.feature_key,
            reason="Reservation expired",
            description=reservation.description,
            request_id=request_id or reservation.request_id,
        )
        account.available_credits += reservation.amount
        account.reserved_credits -= reservation.amount
        reservation.status = "expired"
        reservation.finalized_at = now
    if expired:
        await _sync_legacy_projection(account, owner)
    return len(expired)


async def _effective_owner(
    session: AsyncSession,
    principal: Principal,
) -> tuple[str, UUID]:
    for membership in principal.memberships:
        if not membership.is_active:
            continue
        company = await session.get(Company, membership.company_id)
        if company is not None and company.credit_pool_enabled:
            return "company", company.id
    return "user", principal.user_id


def _authorize_account(principal: Principal, account: CreditAccount) -> None:
    if account.owner_type == "user":
        if account.user_id != principal.user_id:
            raise CreditForbiddenError("Credit account does not belong to this user")
        return
    if account.company_id is None or not any(
        membership.is_active and membership.company_id == account.company_id
        for membership in principal.memberships
    ):
        raise CreditForbiddenError("Credit account does not belong to this tenant")


async def get_credit_balance(
    session: AsyncSession,
    *,
    principal: Principal,
    request_id: str | None = None,
) -> CreditBalance:
    owner_type, owner_id = await _effective_owner(session, principal)
    account, owner = await _lock_account_for_owner(
        session,
        owner_type=owner_type,
        owner_id=owner_id,
    )
    await _expire_due_reservations_locked(
        session,
        account=account,
        owner=owner,
        request_id=request_id,
    )
    ledger_available, ledger_reserved = await _ledger_totals(session, account.id)
    await session.commit()
    return CreditBalance(
        account=account,
        owner_id=owner_id,
        ledger_available=ledger_available,
        ledger_reserved=ledger_reserved,
    )


async def reserve_credits(
    session: AsyncSession,
    *,
    principal: Principal,
    amount: int,
    idempotency_key: str,
    feature_key: str | None,
    description: str | None,
    request_id: str | None,
    expires_in_seconds: int = 1_800,
) -> CreditReservationResult:
    if amount <= 0:
        raise CreditConflictError("Reservation amount must be positive")
    if not 60 <= expires_in_seconds <= 86_400:
        raise CreditConflictError("Reservation lifetime must be between 60 and 86400 seconds")
    owner_type, owner_id = await _effective_owner(session, principal)
    account, owner = await _lock_account_for_owner(
        session,
        owner_type=owner_type,
        owner_id=owner_id,
    )
    await _expire_due_reservations_locked(
        session,
        account=account,
        owner=owner,
        request_id=request_id,
    )
    existing_result = await session.execute(
        select(CreditReservation)
        .where(
            CreditReservation.account_id == account.id,
            CreditReservation.idempotency_key == idempotency_key,
        )
        .with_for_update()
    )
    existing = existing_result.scalar_one_or_none()
    if existing is not None:
        if existing.amount != amount or existing.feature_key != feature_key:
            raise CreditConflictError("Idempotency key was already used for another reservation")
        await session.commit()
        return CreditReservationResult(existing, True)

    if account.available_credits < amount:
        # Persist any bootstrap/expiry work completed while holding the account lock.
        # No reservation has been created at this point, so the failed request cannot
        # consume credits, while expired reservations stay correctly released.
        await session.commit()
        raise InsufficientCreditsError("Insufficient credits")

    reservation = CreditReservation(
        account_id=account.id,
        created_by_user_id=principal.user_id,
        idempotency_key=idempotency_key,
        amount=amount,
        status="active",
        feature_key=feature_key,
        description=description,
        request_id=request_id,
        expires_at=datetime.now(UTC) + timedelta(seconds=expires_in_seconds),
    )
    session.add(reservation)
    await session.flush()
    await _append_entry(
        session,
        account=account,
        event_type="reserve",
        amount=amount,
        available_delta=-amount,
        reserved_delta=amount,
        idempotency_key=f"reservation:{reservation.id}:reserve",
        actor_user_id=principal.user_id,
        reservation_id=reservation.id,
        feature_key=feature_key,
        reason="Credit reservation",
        description=description,
        request_id=request_id,
    )
    account.available_credits -= amount
    account.reserved_credits += amount
    await _sync_legacy_projection(account, owner)
    await session.commit()
    return CreditReservationResult(reservation, False)


async def _lock_reservation_for_principal(
    session: AsyncSession,
    *,
    principal: Principal,
    reservation_id: UUID,
) -> tuple[CreditReservation, CreditAccount, OwnerModel]:
    reservation = await session.get(CreditReservation, reservation_id)
    if reservation is None:
        raise CreditNotFoundError("Credit reservation not found")
    account = await session.get(CreditAccount, reservation.account_id)
    if account is None:
        raise CreditNotFoundError("Credit account not found")
    _authorize_account(principal, account)
    owner_id = _account_owner_id(account)
    locked_account, owner = await _lock_account_for_owner(
        session,
        owner_type=account.owner_type,
        owner_id=owner_id,
    )
    locked_result = await session.execute(
        select(CreditReservation).where(CreditReservation.id == reservation_id).with_for_update()
    )
    locked_reservation = locked_result.scalar_one_or_none()
    if locked_reservation is None:
        raise CreditNotFoundError("Credit reservation not found")
    return locked_reservation, locked_account, owner


async def consume_reservation(
    session: AsyncSession,
    *,
    principal: Principal,
    reservation_id: UUID,
    request_id: str | None,
) -> CreditReservationResult:
    reservation, account, owner = await _lock_reservation_for_principal(
        session,
        principal=principal,
        reservation_id=reservation_id,
    )
    if reservation.status == "consumed":
        await session.commit()
        return CreditReservationResult(reservation, True)
    if reservation.status in {"released", "expired"}:
        raise CreditConflictError("Reservation is already finalized")
    if reservation.expires_at <= datetime.now(UTC):
        await _expire_due_reservations_locked(
            session,
            account=account,
            owner=owner,
            request_id=request_id,
        )
        await session.commit()
        raise CreditReservationExpiredError("Reservation expired")
    if account.reserved_credits < reservation.amount:
        raise CreditConflictError("Reserved credit projection is inconsistent")

    await _append_entry(
        session,
        account=account,
        event_type="consume",
        amount=reservation.amount,
        available_delta=0,
        reserved_delta=-reservation.amount,
        idempotency_key=f"reservation:{reservation.id}:consume",
        actor_user_id=principal.user_id,
        reservation_id=reservation.id,
        feature_key=reservation.feature_key,
        reason="Reserved credits consumed",
        description=reservation.description,
        request_id=request_id or reservation.request_id,
    )
    account.reserved_credits -= reservation.amount
    reservation.status = "consumed"
    reservation.finalized_at = datetime.now(UTC)
    await _sync_legacy_projection(account, owner)
    await session.commit()
    return CreditReservationResult(reservation, False)


async def release_reservation(
    session: AsyncSession,
    *,
    principal: Principal,
    reservation_id: UUID,
    request_id: str | None,
) -> CreditReservationResult:
    reservation, account, owner = await _lock_reservation_for_principal(
        session,
        principal=principal,
        reservation_id=reservation_id,
    )
    if reservation.status == "released":
        await session.commit()
        return CreditReservationResult(reservation, True)
    if reservation.status in {"consumed", "expired"}:
        raise CreditConflictError("Reservation is already finalized")
    if account.reserved_credits < reservation.amount:
        raise CreditConflictError("Reserved credit projection is inconsistent")

    await _append_entry(
        session,
        account=account,
        event_type="release",
        amount=reservation.amount,
        available_delta=reservation.amount,
        reserved_delta=-reservation.amount,
        idempotency_key=f"reservation:{reservation.id}:release",
        actor_user_id=principal.user_id,
        reservation_id=reservation.id,
        feature_key=reservation.feature_key,
        reason="Reserved credits released",
        description=reservation.description,
        request_id=request_id or reservation.request_id,
    )
    account.available_credits += reservation.amount
    account.reserved_credits -= reservation.amount
    reservation.status = "released"
    reservation.finalized_at = datetime.now(UTC)
    await _sync_legacy_projection(account, owner)
    await session.commit()
    return CreditReservationResult(reservation, False)


async def _apply_available_event(
    session: AsyncSession,
    *,
    owner_type: str,
    owner_id: UUID,
    event_type: str,
    amount_delta: int,
    idempotency_key: str,
    actor_user_id: UUID | None,
    reason: str,
    request_id: str | None,
    feature_key: str | None = None,
    metadata_json: dict[str, object] | None = None,
) -> tuple[CreditAccount, CreditLedgerEntry, bool]:
    if amount_delta == 0:
        raise CreditConflictError("Credit delta must not be zero")
    if event_type in {"grant", "refund"} and amount_delta < 0:
        raise CreditConflictError(f"{event_type} must increase available credits")
    if event_type == "expire" and amount_delta > 0:
        raise CreditConflictError("expire must decrease available credits")
    if event_type not in {"grant", "refund", "expire", "admin_adjustment"}:
        raise CreditConflictError("Unsupported available credit event")
    account, owner = await _lock_account_for_owner(
        session,
        owner_type=owner_type,
        owner_id=owner_id,
    )
    await _expire_due_reservations_locked(
        session,
        account=account,
        owner=owner,
        request_id=request_id,
    )

    existing_result = await session.execute(
        select(CreditLedgerEntry).where(
            CreditLedgerEntry.account_id == account.id,
            CreditLedgerEntry.idempotency_key == idempotency_key,
        )
    )
    existing = existing_result.scalar_one_or_none()
    if existing is not None:
        if (
            existing.event_type != event_type
            or existing.amount != abs(amount_delta)
            or existing.available_delta != amount_delta
            or existing.reserved_delta != 0
            or existing.feature_key != feature_key
            or existing.reason != reason
        ):
            raise CreditConflictError("Idempotency key was already used for another operation")
        return account, existing, True

    if amount_delta < 0 and account.available_credits < abs(amount_delta):
        raise InsufficientCreditsError("Adjustment would make credits negative")
    entry, replay = await _append_entry(
        session,
        account=account,
        event_type=event_type,
        amount=abs(amount_delta),
        available_delta=amount_delta,
        reserved_delta=0,
        idempotency_key=idempotency_key,
        actor_user_id=actor_user_id,
        feature_key=feature_key,
        reason=reason,
        request_id=request_id,
        metadata_json=metadata_json,
    )
    if not replay:
        account.available_credits += amount_delta
        await _sync_legacy_projection(account, owner)
    return account, entry, replay


async def grant_credits(
    session: AsyncSession,
    *,
    owner_type: str,
    owner_id: UUID,
    amount: int,
    idempotency_key: str,
    reason: str,
    actor_user_id: UUID | None = None,
    request_id: str | None = None,
) -> CreditLedgerEntry:
    if amount <= 0:
        raise CreditConflictError("Grant amount must be positive")
    _, entry, _ = await _apply_available_event(
        session,
        owner_type=owner_type,
        owner_id=owner_id,
        event_type="grant",
        amount_delta=amount,
        idempotency_key=idempotency_key,
        actor_user_id=actor_user_id,
        reason=reason,
        request_id=request_id,
    )
    await session.commit()
    return entry


async def refund_credits(
    session: AsyncSession,
    *,
    owner_type: str,
    owner_id: UUID,
    amount: int,
    idempotency_key: str,
    reason: str,
    actor_user_id: UUID | None = None,
    request_id: str | None = None,
) -> CreditLedgerEntry:
    if amount <= 0:
        raise CreditConflictError("Refund amount must be positive")
    _, entry, _ = await _apply_available_event(
        session,
        owner_type=owner_type,
        owner_id=owner_id,
        event_type="refund",
        amount_delta=amount,
        idempotency_key=idempotency_key,
        actor_user_id=actor_user_id,
        reason=reason,
        request_id=request_id,
    )
    await session.commit()
    return entry


async def expire_available_credits(
    session: AsyncSession,
    *,
    owner_type: str,
    owner_id: UUID,
    amount: int,
    idempotency_key: str,
    reason: str,
    request_id: str | None = None,
) -> CreditLedgerEntry:
    if amount <= 0:
        raise CreditConflictError("Expiration amount must be positive")
    _, entry, _ = await _apply_available_event(
        session,
        owner_type=owner_type,
        owner_id=owner_id,
        event_type="expire",
        amount_delta=-amount,
        idempotency_key=idempotency_key,
        actor_user_id=None,
        reason=reason,
        request_id=request_id,
    )
    await session.commit()
    return entry


async def admin_adjust_credits(
    session: AsyncSession,
    *,
    owner_type: str,
    owner_id: UUID,
    amount: int,
    idempotency_key: str,
    reason: str,
    actor_user_id: UUID,
    request_id: str | None,
    ip_address: str | None,
) -> CreditLedgerEntry:
    if amount == 0:
        raise CreditConflictError("Credit adjustment must not be zero")
    if len(reason.strip()) < 3:
        raise CreditConflictError("Credit adjustment reason is required")
    account, entry, replay = await _apply_available_event(
        session,
        owner_type=owner_type,
        owner_id=owner_id,
        event_type="admin_adjustment",
        amount_delta=amount,
        idempotency_key=idempotency_key,
        actor_user_id=actor_user_id,
        reason=reason,
        request_id=request_id,
        metadata_json={"direction": "grant" if amount > 0 else "deduct"},
    )
    if not replay:
        await add_audit_log(
            session,
            actor_user_id=actor_user_id,
            company_id=owner_id if owner_type == "company" else None,
            action="billing.credit.admin_adjustment",
            resource_type="credit_account",
            resource_id=str(account.id),
            metadata_json={
                "owner_type": owner_type,
                "owner_id": str(owner_id),
                "amount": amount,
                "reason": reason,
                "request_id": request_id or "",
            },
            ip_address=ip_address,
        )
    await session.commit()
    return entry


async def replace_available_credits_for_plan(
    session: AsyncSession,
    *,
    owner_type: str,
    owner_id: UUID,
    target_credits: int,
    operation_key: str,
    actor_user_id: UUID,
    request_id: str | None,
    grant_reason: str,
    source: str,
) -> CreditAccount:
    if target_credits < 0:
        raise CreditConflictError("Target credits must not be negative")
    account, owner = await _lock_account_for_owner(
        session,
        owner_type=owner_type,
        owner_id=owner_id,
    )
    await _expire_due_reservations_locked(
        session,
        account=account,
        owner=owner,
        request_id=request_id,
    )
    grant_key = f"{operation_key}:grant"
    existing_result = await session.execute(
        select(CreditLedgerEntry).where(
            CreditLedgerEntry.account_id == account.id,
            CreditLedgerEntry.idempotency_key == grant_key,
        )
    )
    existing_grant = existing_result.scalar_one_or_none()
    if existing_grant is not None:
        if existing_grant.amount != target_credits or existing_grant.reason != grant_reason:
            raise CreditConflictError("Plan credit operation key was already used")
        return account

    current_available = int(account.available_credits)
    if current_available > 0:
        await _append_entry(
            session,
            account=account,
            event_type="expire",
            amount=current_available,
            available_delta=-current_available,
            reserved_delta=0,
            idempotency_key=f"{operation_key}:expire",
            actor_user_id=actor_user_id,
            reason="Previous plan balance expired",
            request_id=request_id,
            metadata_json={"operation_key": operation_key, "source": source},
        )
    if target_credits > 0:
        await _append_entry(
            session,
            account=account,
            event_type="grant",
            amount=target_credits,
            available_delta=target_credits,
            reserved_delta=0,
            idempotency_key=grant_key,
            actor_user_id=actor_user_id,
            reason=grant_reason,
            request_id=request_id,
            metadata_json={"operation_key": operation_key, "source": source},
        )
    account.available_credits = target_credits
    await _sync_legacy_projection(account, owner)
    return account


async def run_with_ai_execution_guard(
    session: AsyncSession,
    *,
    principal: Principal,
    company_id: UUID | None,
    feature_key: str,
    idempotency_key: str,
    request_id: str | None,
    operation: Callable[[], Awaitable[T]],
) -> T:
    """Serialize a no-credit AI execution without manufacturing a credit ledger event.

    BYOK requests deliberately do not touch HRing credits.  They still need a
    durable guard so browser retries cannot invoke the customer's provider twice.
    Like the credit reservation path, a completed idempotency key is not replayed
    because the generated response itself is owned by the feature endpoint.
    """

    existing = await session.scalar(
        select(AiExecutionLease).where(
            AiExecutionLease.user_id == principal.user_id,
            AiExecutionLease.feature_key == feature_key,
            AiExecutionLease.idempotency_key == idempotency_key,
        )
    )
    if existing is not None:
        if existing.status == "active":
            raise CreditConflictError("Request with this idempotency key is already in progress")
        raise CreditConflictError("Request with this idempotency key was already completed")

    lease = AiExecutionLease(
        user_id=principal.user_id,
        company_id=company_id,
        feature_key=feature_key,
        idempotency_key=idempotency_key,
        request_id=request_id,
        status="active",
    )
    session.add(lease)
    try:
        await session.flush()
        lease_id = lease.id
        # Commit before reaching the external provider so another worker sees
        # the active lease instead of issuing a second paid customer request.
        await session.commit()
    except IntegrityError as exc:
        await session.rollback()
        raise CreditConflictError(
            "Request with this idempotency key is already in progress or completed"
        ) from exc
    except Exception:
        await session.rollback()
        raise

    try:
        result = await operation()
        lease.status = "completed"
        lease.finalized_at = datetime.now(UTC)
        await session.flush()
        await session.commit()
        return result
    except Exception as exc:
        await session.rollback()
        persisted = await session.get(AiExecutionLease, lease_id)
        if persisted is not None and persisted.status == "active":
            persisted.status = "failed"
            persisted.error_code = type(exc).__name__[:120]
            persisted.finalized_at = datetime.now(UTC)
            await session.commit()
        raise


async def run_with_credit_reservation(
    session: AsyncSession,
    *,
    principal: Principal,
    amount: int,
    idempotency_key: str,
    feature_key: str,
    description: str,
    request_id: str | None,
    operation: Callable[[], Awaitable[T]],
) -> T:
    if amount <= 0:
        return await operation()
    reserved = await reserve_credits(
        session,
        principal=principal,
        amount=amount,
        idempotency_key=idempotency_key,
        feature_key=feature_key,
        description=description,
        request_id=request_id,
    )
    if reserved.idempotent_replay:
        if reserved.reservation.status == "active":
            raise CreditConflictError("Request with this idempotency key is already in progress")
        if reserved.reservation.status == "consumed":
            raise CreditConflictError("Request with this idempotency key was already completed")
        raise CreditConflictError("Request with this idempotency key is already finalized")
    if reserved.reservation.status in {"released", "expired"}:
        raise CreditConflictError("Reservation is already finalized")
    try:
        result = await operation()
    except Exception:
        if reserved.reservation.status == "active":
            await release_reservation(
                session,
                principal=principal,
                reservation_id=reserved.reservation.id,
                request_id=request_id,
            )
        raise
    if reserved.reservation.status == "active":
        await consume_reservation(
            session,
            principal=principal,
            reservation_id=reserved.reservation.id,
            request_id=request_id,
        )
    return result


_COMPAT_CREDIT_COSTS = {
    "generate-job-profile": 5,
    "generate-interview-kit": 5,
    "generate-onboarding-plan": 15,
}


async def feature_credit_cost(
    session: AsyncSession,
    *,
    feature_key: str,
    default_cost: int,
) -> int:
    configured = await session.scalar(
        select(FeaturePermission).where(
            FeaturePermission.feature_key == feature_key,
            FeaturePermission.is_active.is_(True),
        )
    )
    if configured is not None and configured.credit_cost > 0:
        return int(configured.credit_cost)
    return max(0, default_cost)


async def compatibility_credit_cost(
    session: AsyncSession,
    *,
    function_name: str,
    body: Any,
) -> int:
    feature_key = f"compat.{function_name}"
    if function_name == "generate-job-ad":
        default_cost = 25 if isinstance(body, dict) and body.get("generateImage") is True else 5
    else:
        default_cost = _COMPAT_CREDIT_COSTS.get(function_name, 0)
    return await feature_credit_cost(
        session,
        feature_key=feature_key,
        default_cost=default_cost,
    )


async def list_credit_accounts_for_admin(
    session: AsyncSession,
    *,
    owner_type: str,
    search: str | None,
    limit: int,
    offset: int,
) -> list[AdminCreditAccountSummary]:
    if owner_type == "user":
        user_statement = (
            select(User, Profile, CreditAccount)
            .join(Profile, Profile.id == User.id)
            .outerjoin(CreditAccount, CreditAccount.user_id == User.id)
        )
        if search:
            pattern = f"%{search.strip()}%"
            user_statement = user_statement.where(
                or_(User.email.ilike(pattern), Profile.full_name.ilike(pattern))
            )
        result = await session.execute(
            user_statement.order_by(User.created_at.desc()).limit(limit).offset(offset)
        )
        raw_rows: list[tuple[UUID, str, str | None, OwnerModel, CreditAccount | None]] = [
            (user.id, profile.full_name or user.email, user.email, profile, account)
            for user, profile, account in result.all()
        ]
    elif owner_type == "company":
        company_statement = select(Company, CreditAccount).outerjoin(
            CreditAccount, CreditAccount.company_id == Company.id
        )
        if search:
            pattern = f"%{search.strip()}%"
            company_statement = company_statement.where(
                or_(Company.name.ilike(pattern), Company.domain.ilike(pattern))
            )
        result = await session.execute(
            company_statement.order_by(Company.created_at.desc()).limit(limit).offset(offset)
        )
        raw_rows = [
            (company.id, company.name, company.domain, company, account)
            for company, account in result.all()
        ]
    else:
        raise CreditConflictError("Unsupported credit owner type")

    account_ids = [account.id for *_, account in raw_rows if account is not None]
    totals: dict[UUID, tuple[int, int]] = {}
    if account_ids:
        totals_result = await session.execute(
            select(
                CreditLedgerEntry.account_id,
                func.coalesce(func.sum(CreditLedgerEntry.available_delta), 0),
                func.coalesce(func.sum(CreditLedgerEntry.reserved_delta), 0),
            )
            .where(CreditLedgerEntry.account_id.in_(account_ids))
            .group_by(CreditLedgerEntry.account_id)
        )
        totals = {row[0]: (int(row[1]), int(row[2])) for row in totals_result.all()}

    summaries: list[AdminCreditAccountSummary] = []
    for owner_id, label, secondary, owner, account in raw_rows:
        legacy_available = _legacy_available(owner)
        available = int(account.available_credits) if account is not None else legacy_available
        reserved = int(account.reserved_credits) if account is not None else 0
        ledger = totals.get(account.id) if account is not None else None
        summaries.append(
            AdminCreditAccountSummary(
                account_id=account.id if account is not None else None,
                owner_type=owner_type,
                owner_id=owner_id,
                owner_label=label,
                owner_secondary_label=secondary,
                available_credits=available,
                reserved_credits=reserved,
                legacy_available_credits=legacy_available,
                projection_reconciled=(
                    account is not None
                    and (ledger or (0, 0)) == (available, reserved)
                    and legacy_available == available
                ),
            )
        )
    return summaries


async def list_credit_ledger_entries(
    session: AsyncSession,
    *,
    account_id: UUID | None,
    event_type: str | None,
    limit: int,
    offset: int,
) -> list[CreditLedgerEntry]:
    statement = select(CreditLedgerEntry)
    if account_id is not None:
        statement = statement.where(CreditLedgerEntry.account_id == account_id)
    if event_type is not None:
        statement = statement.where(CreditLedgerEntry.event_type == event_type)
    result = await session.execute(
        statement.order_by(CreditLedgerEntry.created_at.desc()).limit(limit).offset(offset)
    )
    return list(result.scalars().all())


async def reconcile_credit_accounts(
    session: AsyncSession,
    *,
    account_id: UUID | None = None,
    limit: int = 100,
    offset: int = 0,
) -> list[CreditReconciliation]:
    statement = select(CreditAccount)
    if account_id is not None:
        statement = statement.where(CreditAccount.id == account_id)
    result = await session.execute(
        statement.order_by(CreditAccount.created_at).limit(limit).offset(offset)
    )
    accounts = list(result.scalars().all())
    account_ids = [account.id for account in accounts]
    totals: dict[UUID, tuple[int, int]] = {}
    if account_ids:
        totals_result = await session.execute(
            select(
                CreditLedgerEntry.account_id,
                func.coalesce(func.sum(CreditLedgerEntry.available_delta), 0),
                func.coalesce(func.sum(CreditLedgerEntry.reserved_delta), 0),
            )
            .where(CreditLedgerEntry.account_id.in_(account_ids))
            .group_by(CreditLedgerEntry.account_id)
        )
        totals = {row[0]: (int(row[1]), int(row[2])) for row in totals_result.all()}

    user_ids = [account.user_id for account in accounts if account.user_id is not None]
    company_ids = [account.company_id for account in accounts if account.company_id is not None]
    owners: dict[tuple[str, UUID], OwnerModel] = {}
    if user_ids:
        profiles_result = await session.execute(select(Profile).where(Profile.id.in_(user_ids)))
        owners.update({("user", profile.id): profile for profile in profiles_result.scalars()})
    if company_ids:
        companies_result = await session.execute(select(Company).where(Company.id.in_(company_ids)))
        owners.update({("company", company.id): company for company in companies_result.scalars()})

    reconciliations: list[CreditReconciliation] = []
    for account in accounts:
        owner_id = _account_owner_id(account)
        owner = owners.get((account.owner_type, owner_id))
        if owner is None:
            raise CreditConflictError("Credit account owner is missing")
        ledger_available, ledger_reserved = totals.get(account.id, (0, 0))
        reconciliations.append(
            CreditReconciliation(
                account_id=account.id,
                projected_available=int(account.available_credits),
                ledger_available=ledger_available,
                projected_reserved=int(account.reserved_credits),
                ledger_reserved=ledger_reserved,
                legacy_available=_legacy_available(owner),
            )
        )
    return reconciliations
