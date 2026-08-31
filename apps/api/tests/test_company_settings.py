import asyncio
from uuid import UUID, uuid4

from fastapi.testclient import TestClient

from hring_api.db.session import SessionFactory
from hring_api.domains.identity.models import Company, CompanyMember
from hring_api.main import app


PASSWORD = "correct horse battery staple"


def _register(client: TestClient, prefix: str) -> dict:
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


def _auth(account: dict) -> dict[str, str]:
    return {"Authorization": f"Bearer {account['tokens']['access_token']}"}


async def _seed_company(ceo_user_id: UUID, *, name: str) -> UUID:
    async with SessionFactory() as session:
        async with session.begin():
            company = Company(
                name=name,
                status="active",
                subscription_tier="corporate_expert",
                monthly_credits=100,
                used_credits=7,
                max_members=10,
                created_by=ceo_user_id,
                credit_pool=40,
                credit_pool_enabled=False,
            )
            session.add(company)
            await session.flush()
            session.add(
                CompanyMember(
                    company_id=company.id,
                    user_id=ceo_user_id,
                    role="ceo",
                    can_invite=True,
                    is_active=True,
                )
            )
            return company.id


async def _read_company(company_id: UUID) -> Company:
    async with SessionFactory() as session:
        company = await session.get(Company, company_id)
        assert company is not None
        return company


def test_ceo_can_update_safe_tenant_settings_only() -> None:
    with TestClient(app) as client:
        ceo = _register(client, "settings-ceo")
        company_id = asyncio.run(
            _seed_company(UUID(ceo["user"]["id"]), name="Before")
        )

        response = client.patch(
            f"/api/v1/companies/{company_id}/settings",
            headers=_auth(ceo),
            json={
                "name": "After",
                "domain": "tenant.example.com",
                "credit_pool_enabled": True,
            },
        )
        assert response.status_code == 200, response.text
        body = response.json()
        assert body["name"] == "After"
        assert body["domain"] == "tenant.example.com"
        assert body["credit_pool_enabled"] is True
        assert body["subscription_tier"] == "corporate_expert"
        assert body["monthly_credits"] == 100
        assert body["max_members"] == 10

        stored = asyncio.run(_read_company(company_id))
        assert stored.subscription_tier == "corporate_expert"
        assert stored.monthly_credits == 100
        assert stored.max_members == 10

        forbidden_contract_change = client.patch(
            f"/api/v1/companies/{company_id}/settings",
            headers=_auth(ceo),
            json={"subscription_tier": "corporate_decision_making"},
        )
        assert forbidden_contract_change.status_code == 422


def test_company_settings_are_cross_tenant_isolated() -> None:
    with TestClient(app) as client:
        alpha = _register(client, "alpha-ceo")
        beta = _register(client, "beta-ceo")
        alpha_id = asyncio.run(
            _seed_company(UUID(alpha["user"]["id"]), name="Alpha")
        )
        beta_id = asyncio.run(
            _seed_company(UUID(beta["user"]["id"]), name="Beta")
        )

        response = client.patch(
            f"/api/v1/companies/{beta_id}/settings",
            headers=_auth(alpha),
            json={"name": "Hijacked"},
        )
        assert response.status_code == 403
        beta_company = asyncio.run(_read_company(beta_id))
        assert beta_company.name == "Beta"

        own = client.patch(
            f"/api/v1/companies/{alpha_id}/settings",
            headers=_auth(alpha),
            json={"name": "Alpha Updated"},
        )
        assert own.status_code == 200, own.text


def test_auth_context_contains_effective_company_permissions() -> None:
    with TestClient(app) as client:
        ceo = _register(client, "context-ceo")
        company_id = asyncio.run(
            _seed_company(UUID(ceo["user"]["id"]), name="Context")
        )

        response = client.get("/api/v1/auth/context", headers=_auth(ceo))
        assert response.status_code == 200, response.text
        body = response.json()
        assert body["company_id"] == str(company_id)
        assert body["company_role"] == "ceo"
        assert body["company_can_invite"] is True
        assert "company.members.manage" in body["company_permissions"]
        assert "company.settings.manage" in body["company_permissions"]
        assert "company.features.manage" in body["company_permissions"]
        assert "company.integrations.read" in body["company_permissions"]
        assert "company.integrations.manage" in body["company_permissions"]
