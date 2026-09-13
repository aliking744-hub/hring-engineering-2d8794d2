import asyncio
from datetime import UTC, datetime, timedelta
from typing import Any
from uuid import UUID, uuid4

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import func, select, text, update
from sqlalchemy.exc import DBAPIError

from hring_api.config import Settings
from hring_api.db.session import SessionFactory
from hring_api.domains.access.models import PlatformRoleAssignment
from hring_api.domains.admin.models import AuditLog
from hring_api.domains.billing.credit_service import (
    CreditForbiddenError,
    InsufficientCreditsError,
    admin_adjust_credits,
    consume_reservation,
    expire_available_credits,
    get_credit_balance,
    refund_credits,
    release_reservation,
    reserve_credits,
)
from hring_api.domains.billing.models import (
    BillingPlan,
    CreditAccount,
    CreditLedgerEntry,
    CreditReservation,
    PaymentTransaction,
)
from hring_api.domains.billing.service import verify_payment
from hring_api.domains.identity.dependencies import Principal
from hring_api.domains.identity.mfa_security import generate_totp_code
from hring_api.domains.identity.models import Company, CompanyMember, Profile, User
from hring_api.domains.identity.repository import list_company_memberships, list_user_roles
from hring_api.integrations.payment.base import PaymentVerifyResult
from hring_api.main import app


PASSWORD = "correct horse battery staple"


def _register(client: TestClient, prefix: str) -> dict[str, Any]:
    response = client.post(
        "/api/v1/auth/register",
        json={
            "email": f"{prefix}-{uuid4()}@example.com",
            "password": PASSWORD,
            "full_name": prefix,
        },
    )
    assert response.status_code == 201, response.text
    return response.json()


def _auth(account: dict[str, Any]) -> dict[str, str]:
    return {"Authorization": f"Bearer {account['tokens']['access_token']}"}


async def _principal(user_id: UUID) -> Principal:
    async with SessionFactory() as session:
        user = await session.get(User, user_id)
        assert user is not None
        return Principal(
            user=user,
            session_id=uuid4(),
            app_roles=await list_user_roles(session, user_id),
            memberships=await list_company_memberships(session, user_id),
        )


async def _grant_platform_role(user_id: UUID, role: str) -> None:
    async with SessionFactory() as session:
        async with session.begin():
            session.add(
                PlatformRoleAssignment(
                    user_id=user_id,
                    role=role,
                    created_by=user_id,
                )
            )


def _privileged_account(client: TestClient, prefix: str) -> dict[str, Any]:
    account = _register(client, prefix)
    asyncio.run(_grant_platform_role(UUID(account["user"]["id"]), "platform_admin"))
    enrollment = client.post("/api/v1/auth/mfa/enroll", headers=_auth(account))
    assert enrollment.status_code == 200, enrollment.text
    confirmation = client.post(
        "/api/v1/auth/mfa/confirm",
        headers=_auth(account),
        json={"code": generate_totp_code(enrollment.json()["secret"])},
    )
    assert confirmation.status_code == 200, confirmation.text
    return account


async def _credit_account_for_user(user_id: UUID) -> CreditAccount:
    async with SessionFactory() as session:
        account = await session.scalar(
            select(CreditAccount).where(CreditAccount.user_id == user_id)
        )
        assert account is not None
        return account


async def _ledger_events(account_id: UUID) -> list[CreditLedgerEntry]:
    async with SessionFactory() as session:
        result = await session.execute(
            select(CreditLedgerEntry)
            .where(CreditLedgerEntry.account_id == account_id)
            .order_by(CreditLedgerEntry.created_at, CreditLedgerEntry.id)
        )
        return list(result.scalars())


def test_reservation_lifecycle_is_idempotent_and_never_double_spends() -> None:
    with TestClient(app) as client:
        account = _register(client, "credit-lifecycle")
    user_id = UUID(account["user"]["id"])

    async def scenario() -> None:
        principal = await _principal(user_id)
        key = f"reservation-{uuid4()}"
        async with SessionFactory() as session:
            reserved = await reserve_credits(
                session,
                principal=principal,
                amount=30,
                idempotency_key=key,
                feature_key="test.credit.lifecycle",
                description="lifecycle test",
                request_id="lifecycle-request",
            )
            assert reserved.idempotent_replay is False
            replay = await reserve_credits(
                session,
                principal=principal,
                amount=30,
                idempotency_key=key,
                feature_key="test.credit.lifecycle",
                description="lifecycle test",
                request_id="lifecycle-replay",
            )
            assert replay.idempotent_replay is True
            assert replay.reservation.id == reserved.reservation.id
            reservation_id = reserved.reservation.id

            with pytest.raises(InsufficientCreditsError):
                await reserve_credits(
                    session,
                    principal=principal,
                    amount=30,
                    idempotency_key=f"reservation-{uuid4()}",
                    feature_key="test.credit.lifecycle",
                    description="double-spend test",
                    request_id="lifecycle-rejected",
                )

            consumed = await consume_reservation(
                session,
                principal=principal,
                reservation_id=reservation_id,
                request_id="lifecycle-consume",
            )
            assert consumed.idempotent_replay is False
            consume_replay = await consume_reservation(
                session,
                principal=principal,
                reservation_id=reservation_id,
                request_id="lifecycle-consume-replay",
            )
            assert consume_replay.idempotent_replay is True

            balance = await get_credit_balance(session, principal=principal)
            assert balance.account.available_credits == 20
            assert balance.account.reserved_credits == 0
            assert balance.reconciled is True

    asyncio.run(scenario())
    stored_account = asyncio.run(_credit_account_for_user(user_id))
    events = asyncio.run(_ledger_events(stored_account.id))
    assert [event.event_type for event in events].count("reserve") == 1
    assert [event.event_type for event in events].count("consume") == 1


def test_concurrent_reservations_serialize_and_preserve_nonnegative_balance() -> None:
    with TestClient(app) as client:
        registered = _register(client, "credit-concurrency")
    user_id = UUID(registered["user"]["id"])

    async def scenario() -> list[str]:
        principal = await _principal(user_id)
        start = asyncio.Event()

        async def reserve_once(key: str) -> str:
            async with SessionFactory() as session:
                await start.wait()
                try:
                    await reserve_credits(
                        session,
                        principal=principal,
                        amount=40,
                        idempotency_key=key,
                        feature_key="test.credit.concurrent",
                        description="concurrency test",
                        request_id=key,
                    )
                except InsufficientCreditsError:
                    return "insufficient"
                return "reserved"

        tasks = [
            asyncio.create_task(reserve_once(f"concurrent-{uuid4()}")),
            asyncio.create_task(reserve_once(f"concurrent-{uuid4()}")),
        ]
        start.set()
        return await asyncio.gather(*tasks)

    outcomes = asyncio.run(scenario())
    assert sorted(outcomes) == ["insufficient", "reserved"]
    stored = asyncio.run(_credit_account_for_user(user_id))
    assert stored.available_credits == 10
    assert stored.reserved_credits == 40


def test_insufficient_request_still_persists_due_reservation_expiry() -> None:
    with TestClient(app) as client:
        registered = _register(client, "credit-expiry-before-insufficient")
    user_id = UUID(registered["user"]["id"])

    async def scenario() -> None:
        principal = await _principal(user_id)
        async with SessionFactory() as session:
            reserved = await reserve_credits(
                session,
                principal=principal,
                amount=45,
                idempotency_key=f"expiring-{uuid4()}",
                feature_key="test.credit.expiry-before-insufficient",
                description="expiry before insufficient test",
                request_id="expiry-before-insufficient",
            )
            reservation_id = reserved.reservation.id

        async with SessionFactory() as session:
            reservation = await session.get(CreditReservation, reservation_id)
            assert reservation is not None
            reservation.expires_at = datetime.now(UTC) - timedelta(seconds=1)
            await session.commit()

        async with SessionFactory() as session:
            with pytest.raises(InsufficientCreditsError):
                await reserve_credits(
                    session,
                    principal=principal,
                    amount=60,
                    idempotency_key=f"still-insufficient-{uuid4()}",
                    feature_key="test.credit.expiry-before-insufficient",
                    description="insufficient after expiry",
                    request_id="insufficient-after-expiry",
                )

        async with SessionFactory() as session:
            account = await session.scalar(
                select(CreditAccount).where(CreditAccount.user_id == user_id)
            )
            reservation = await session.get(CreditReservation, reservation_id)
            assert account is not None and reservation is not None
            assert account.available_credits == 50
            assert account.reserved_credits == 0
            assert reservation.status == "expired"

    asyncio.run(scenario())


async def _seed_credit_company(user_id: UUID, label: str) -> UUID:
    async with SessionFactory() as session:
        async with session.begin():
            company = Company(
                name=f"{label} {uuid4().hex[:8]}",
                status="active",
                subscription_tier="corporate_expert",
                monthly_credits=100,
                used_credits=0,
                credit_pool=100,
                credit_pool_enabled=True,
                max_members=10,
                created_by=user_id,
            )
            session.add(company)
            await session.flush()
            session.add(
                CompanyMember(
                    company_id=company.id,
                    user_id=user_id,
                    role="ceo",
                    can_invite=True,
                    is_active=True,
                )
            )
            return company.id


def test_company_credit_reservations_enforce_tenant_isolation() -> None:
    with TestClient(app) as client:
        first = _register(client, "credit-tenant-a")
        second = _register(client, "credit-tenant-b")
        first_company = asyncio.run(_seed_credit_company(UUID(first["user"]["id"]), "Tenant A"))
        second_company = asyncio.run(_seed_credit_company(UUID(second["user"]["id"]), "Tenant B"))

        first_balance = client.get("/api/v1/billing/credits/me", headers=_auth(first))
        second_balance = client.get("/api/v1/billing/credits/me", headers=_auth(second))
        assert first_balance.json()["owner_id"] == str(first_company)
        assert second_balance.json()["owner_id"] == str(second_company)

        async def isolation_scenario() -> None:
            first_principal = await _principal(UUID(first["user"]["id"]))
            second_principal = await _principal(UUID(second["user"]["id"]))
            async with SessionFactory() as session:
                reserved = await reserve_credits(
                    session,
                    principal=first_principal,
                    amount=25,
                    idempotency_key=f"tenant-{uuid4()}",
                    feature_key="test.credit.tenant",
                    description="tenant isolation test",
                    request_id="tenant-first",
                )
            async with SessionFactory() as session:
                with pytest.raises(CreditForbiddenError):
                    await consume_reservation(
                        session,
                        principal=second_principal,
                        reservation_id=reserved.reservation.id,
                        request_id="tenant-foreign-consume",
                    )
            async with SessionFactory() as session:
                with pytest.raises(CreditForbiddenError):
                    await release_reservation(
                        session,
                        principal=second_principal,
                        reservation_id=reserved.reservation.id,
                        request_id="tenant-foreign-release",
                    )

        asyncio.run(isolation_scenario())
        assert (
            client.get("/api/v1/billing/credits/me", headers=_auth(second)).json()[
                "available_credits"
            ]
            == 100
        )


def test_release_refund_expiration_reconciliation_and_append_only_guard() -> None:
    with TestClient(app) as client:
        registered = _register(client, "credit-events")
    user_id = UUID(registered["user"]["id"])

    async def scenario() -> tuple[UUID, UUID]:
        principal = await _principal(user_id)
        async with SessionFactory() as session:
            reserved = await reserve_credits(
                session,
                principal=principal,
                amount=10,
                idempotency_key=f"release-{uuid4()}",
                feature_key="test.credit.release",
                description="release test",
                request_id="release-request",
            )
            await release_reservation(
                session,
                principal=principal,
                reservation_id=reserved.reservation.id,
                request_id="release-request",
            )
            refunded = await refund_credits(
                session,
                owner_type="user",
                owner_id=user_id,
                amount=7,
                idempotency_key=f"refund-{uuid4()}",
                reason="test refund",
                request_id="refund-request",
            )
            await expire_available_credits(
                session,
                owner_type="user",
                owner_id=user_id,
                amount=2,
                idempotency_key=f"expire-{uuid4()}",
                reason="test expiration",
                request_id="expire-request",
            )
            expiring = await reserve_credits(
                session,
                principal=principal,
                amount=5,
                idempotency_key=f"reservation-expire-{uuid4()}",
                feature_key="test.credit.expiration",
                description="expiration test",
                request_id="reservation-expire-request",
            )

        async with SessionFactory() as session:
            reservation = await session.get(CreditReservation, expiring.reservation.id)
            assert reservation is not None
            reservation.expires_at = datetime.now(UTC) - timedelta(seconds=1)
            await session.commit()

        async with SessionFactory() as session:
            balance = await get_credit_balance(
                session,
                principal=principal,
                request_id="expire-sweep",
            )
            assert balance.account.available_credits == 55
            assert balance.account.reserved_credits == 0
            assert balance.reconciled is True

        async with SessionFactory() as session:
            profile = await session.get(Profile, user_id)
            assert profile is not None
            assert profile.monthly_credits - profile.used_credits == 55
        return balance.account.id, refunded.id

    account_id, protected_entry_id = asyncio.run(scenario())
    events = asyncio.run(_ledger_events(account_id))
    assert {"grant", "reserve", "release", "refund", "expire"}.issubset(
        {event.event_type for event in events}
    )

    async def mutate_ledger() -> None:
        async with SessionFactory() as session:
            with pytest.raises(DBAPIError):
                await session.execute(
                    update(CreditLedgerEntry)
                    .where(CreditLedgerEntry.id == protected_entry_id)
                    .values(reason="mutated")
                )
                await session.commit()
            await session.rollback()
            with pytest.raises(DBAPIError):
                await session.execute(text("TRUNCATE TABLE credit_ledger_entries"))
                await session.commit()
            await session.rollback()

    asyncio.run(mutate_ledger())


def test_admin_adjustment_requires_permission_reason_audit_and_is_idempotent() -> None:
    with TestClient(app) as client:
        target = _register(client, "credit-adjust-target")
        platform_admin = _privileged_account(client, "credit-adjust-admin")
        target_id = target["user"]["id"]
        payload = {
            "owner_type": "user",
            "owner_id": target_id,
            "amount": 25,
            "reason": "Service recovery credit",
            "idempotency_key": f"admin-{uuid4()}",
        }

        forbidden = client.post(
            "/api/v1/platform/billing/credits/adjustments",
            headers=_auth(target),
            json=payload,
        )
        assert forbidden.status_code == 403

        adjusted = client.post(
            "/api/v1/platform/billing/credits/adjustments",
            headers=_auth(platform_admin),
            json=payload,
        )
        assert adjusted.status_code == 200, adjusted.text
        replay = client.post(
            "/api/v1/platform/billing/credits/adjustments",
            headers=_auth(platform_admin),
            json=payload,
        )
        assert replay.status_code == 200, replay.text
        assert replay.json()["id"] == adjusted.json()["id"]

        invalid_reason = client.post(
            "/api/v1/platform/billing/credits/adjustments",
            headers=_auth(platform_admin),
            json={**payload, "reason": "x", "idempotency_key": f"admin-{uuid4()}"},
        )
        assert invalid_reason.status_code == 422

        balance = client.get("/api/v1/billing/credits/me", headers=_auth(target))
        assert balance.status_code == 200, balance.text
        assert balance.json()["available_credits"] == 75

        ledger = client.get(
            "/api/v1/platform/billing/credits/ledger",
            headers=_auth(platform_admin),
            params={"account_id": adjusted.json()["account_id"]},
        )
        assert ledger.status_code == 200, ledger.text
        assert sum(row["event_type"] == "admin_adjustment" for row in ledger.json()) == 1

        reconciliation = client.get(
            "/api/v1/platform/billing/credits/reconciliation",
            headers=_auth(platform_admin),
            params={"account_id": adjusted.json()["account_id"]},
        )
        assert reconciliation.status_code == 200, reconciliation.text
        assert reconciliation.json() == [
            {
                "account_id": adjusted.json()["account_id"],
                "projected_available": 75,
                "ledger_available": 75,
                "projected_reserved": 0,
                "ledger_reserved": 0,
                "legacy_available": 75,
                "reconciled": True,
            }
        ]

    async def audit_count() -> int:
        async with SessionFactory() as session:
            return int(
                await session.scalar(
                    select(func.count(AuditLog.id)).where(
                        AuditLog.action == "billing.credit.admin_adjustment",
                        AuditLog.resource_id == adjusted.json()["account_id"],
                    )
                )
                or 0
            )

    assert asyncio.run(audit_count()) == 1


def test_negative_adjustment_replay_does_not_reapply_or_fail_after_balance_changes() -> None:
    with TestClient(app) as client:
        registered = _register(client, "credit-negative-replay")
    user_id = UUID(registered["user"]["id"])

    async def scenario() -> None:
        key = f"admin-negative-{uuid4()}"
        async with SessionFactory() as session:
            first = await admin_adjust_credits(
                session,
                owner_type="user",
                owner_id=user_id,
                amount=-10,
                idempotency_key=key,
                reason="test negative adjustment",
                actor_user_id=user_id,
                request_id="negative-first",
                ip_address=None,
            )
            await expire_available_credits(
                session,
                owner_type="user",
                owner_id=user_id,
                amount=35,
                idempotency_key=f"expire-after-adjustment-{uuid4()}",
                reason="test balance reduction",
            )
            replay = await admin_adjust_credits(
                session,
                owner_type="user",
                owner_id=user_id,
                amount=-10,
                idempotency_key=key,
                reason="test negative adjustment",
                actor_user_id=user_id,
                request_id="negative-replay",
                ip_address=None,
            )
            assert replay.id == first.id

        principal = await _principal(user_id)
        async with SessionFactory() as session:
            balance = await get_credit_balance(session, principal=principal)
            assert balance.account.available_credits == 5

    asyncio.run(scenario())


def test_ai_provider_failure_releases_reservation_and_retry_is_not_free(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    calls = 0

    async def fail_gateway(**kwargs: object) -> object:
        nonlocal calls
        calls += 1
        assert kwargs["credits_charged"] == 50
        from hring_api.domains.ai.gateway_client import AiGatewayError

        raise AiGatewayError("provider failed")

    monkeypatch.setattr(
        "hring_api.domains.compat.functions.generate_with_ai_gateway",
        fail_gateway,
    )

    with TestClient(app) as client:
        registered = _register(client, "credit-provider-failure")
        headers = {**_auth(registered), "X-Idempotency-Key": str(uuid4())}
        before = client.get("/api/v1/billing/credits/me", headers=headers).json()
        failed = client.post(
            "/api/v1/compat/functions/generate-job-profile",
            headers=headers,
            json={"body": {"jobTitle": "Engineer"}},
        )
        assert failed.status_code == 502, failed.text
        after = client.get("/api/v1/billing/credits/me", headers=headers).json()
        assert after["available_credits"] == before["available_credits"]
        assert after["reserved_credits"] == 0

        replay = client.post(
            "/api/v1/compat/functions/generate-job-profile",
            headers=headers,
            json={"body": {"jobTitle": "Engineer"}},
        )
        assert replay.status_code == 409, replay.text
        assert calls == 1

    stored = asyncio.run(_credit_account_for_user(UUID(registered["user"]["id"])))
    events = asyncio.run(_ledger_events(stored.id))
    assert [
        event.event_type for event in events if event.feature_key == "compat.generate-job-profile"
    ] == ["reserve", "release"]


def test_successful_ai_operation_consumes_once_and_reports_the_same_metered_cost(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    from hring_api.domains.ai.gateway_client import AiGatewayResult

    calls = 0

    async def succeed_gateway(**kwargs: object) -> AiGatewayResult:
        nonlocal calls
        calls += 1
        assert kwargs["credits_charged"] == 50
        return AiGatewayResult(
            request_id=uuid4(),
            content='{"content":"ok"}',
            provider="test",
            model="test-model",
            usage={"input_tokens": 10, "output_tokens": 3},
            provider_cost_microusd=1,
        )

    monkeypatch.setattr(
        "hring_api.domains.compat.functions.generate_with_ai_gateway",
        succeed_gateway,
    )

    with TestClient(app) as client:
        registered = _register(client, "credit-provider-success")
        headers = {**_auth(registered), "X-Idempotency-Key": str(uuid4())}
        succeeded = client.post(
            "/api/v1/compat/functions/generate-job-profile",
            headers=headers,
            json={"body": {"jobTitle": "Engineer"}},
        )
        assert succeeded.status_code == 200, succeeded.text
        assert succeeded.json()["data"] == {"content": "ok"}
        balance = client.get("/api/v1/billing/credits/me", headers=headers).json()
        assert balance["available_credits"] == 0
        assert balance["reserved_credits"] == 0

        replay = client.post(
            "/api/v1/compat/functions/generate-job-profile",
            headers=headers,
            json={"body": {"jobTitle": "Engineer"}},
        )
        assert replay.status_code == 409, replay.text
        assert calls == 1

    stored = asyncio.run(_credit_account_for_user(UUID(registered["user"]["id"])))
    events = asyncio.run(_ledger_events(stored.id))
    assert [
        event.event_type for event in events if event.feature_key == "compat.generate-job-profile"
    ] == ["reserve", "consume"]


def test_verified_payment_reconciles_ledger_once_and_updates_legacy_projection(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    calls = 0

    class FakePaymentProvider:
        name = "fake"

        async def verify_payment(self, *, amount_rial: int, authority: str) -> PaymentVerifyResult:
            nonlocal calls
            assert amount_rial > 0
            assert authority
            calls += 1
            return PaymentVerifyResult(verified=True, ref_id="test-ref")

    async def fake_provider(*_args: object, **_kwargs: object) -> FakePaymentProvider:
        return FakePaymentProvider()

    monkeypatch.setattr(
        "hring_api.domains.billing.service.get_payment_provider",
        fake_provider,
    )

    with TestClient(app) as client:
        registered = _register(client, "credit-payment")
    user_id = UUID(registered["user"]["id"])

    async def scenario() -> None:
        principal = await _principal(user_id)
        authority = f"test-authority-{uuid4()}"
        async with SessionFactory() as session:
            plan = await session.get(BillingPlan, "individual_pro")
            assert plan is not None
            transaction = PaymentTransaction(
                user_id=user_id,
                provider="fake",
                amount_toman=plan.price_toman,
                plan_type=plan.plan_type,
                authority=authority,
                status="pending",
            )
            session.add(transaction)
            await session.commit()
            transaction_id = transaction.id

            first = await verify_payment(
                session,
                principal=principal,
                authority=authority,
                settings=Settings(),
                request_id="payment-request",
            )
            second = await verify_payment(
                session,
                principal=principal,
                authority=authority,
                settings=Settings(),
                request_id="payment-replay",
            )
            assert first.already_verified is False
            assert second.already_verified is True

        async with SessionFactory() as session:
            plan = await session.get(BillingPlan, "individual_pro")
            profile = await session.get(Profile, user_id)
            account = await session.scalar(
                select(CreditAccount).where(CreditAccount.user_id == user_id)
            )
            assert plan is not None and profile is not None and account is not None
            assert account.available_credits == plan.monthly_credits
            assert account.reserved_credits == 0
            assert profile.monthly_credits == plan.monthly_credits
            assert profile.used_credits == 0
            grants = int(
                await session.scalar(
                    select(func.count(CreditLedgerEntry.id)).where(
                        CreditLedgerEntry.account_id == account.id,
                        CreditLedgerEntry.idempotency_key == f"payment:{transaction_id}:grant",
                    )
                )
                or 0
            )
            assert grants == 1

    asyncio.run(scenario())
    assert calls == 1
