import asyncio
from typing import Any
from uuid import UUID, uuid4

from fastapi.testclient import TestClient

from hring_api.db.session import SessionFactory
from hring_api.domains.billing.models import PaymentTransaction
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


async def _add_payment(user_id: UUID, *, amount_toman: int, ref_id: str) -> UUID:
    async with SessionFactory() as session:
        transaction = PaymentTransaction(
            user_id=user_id,
            provider="zarinpal",
            amount_toman=amount_toman,
            plan_type="individual_pro",
            status="verified",
            ref_id=ref_id,
            description="payment history isolation test",
        )
        session.add(transaction)
        await session.commit()
        return transaction.id


def test_billing_plans_are_seeded_and_publicly_readable() -> None:
    with TestClient(app) as client:
        response = client.get("/api/v1/billing/plans")

    assert response.status_code == 200, response.text
    plans = response.json()
    plan_types = {item["plan_type"] for item in plans}
    assert "individual_pro" in plan_types
    assert "individual_expert" not in plan_types
    assert "corporate_expert" in plan_types
    for plan in plans:
        assert plan["price_toman"] >= 0
        assert plan["monthly_credits"] >= 0
        assert plan["scope"] in {"individual", "corporate"}


def test_payment_history_requires_authentication_and_is_owner_scoped() -> None:
    with TestClient(app) as client:
        assert client.get("/api/v1/billing/payments").status_code == 401

        first = _register(client, "billing-history-first")
        second = _register(client, "billing-history-second")
        first_id = asyncio.run(
            _add_payment(
                UUID(first["user"]["id"]),
                amount_toman=490_000,
                ref_id=f"first-{uuid4()}",
            )
        )
        asyncio.run(
            _add_payment(
                UUID(second["user"]["id"]),
                amount_toman=990_000,
                ref_id=f"second-{uuid4()}",
            )
        )

        response = client.get("/api/v1/billing/payments", headers=_auth(first))

    assert response.status_code == 200, response.text
    transactions = response.json()
    assert [item["id"] for item in transactions] == [str(first_id)]
    assert transactions[0]["amount_toman"] == 490_000
