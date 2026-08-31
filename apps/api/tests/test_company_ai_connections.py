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
                max_members=10,
                created_by=ceo_user_id,
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


def test_company_byok_is_tenant_private_and_never_returns_secret() -> None:
    with TestClient(app) as client:
        ceo = _register(client, "company-ai-ceo")
        outsider = _register(client, "company-ai-outsider")
        company_id = asyncio.run(_seed_company(UUID(ceo["user"]["id"]), name="AI Company"))
        secret = "sk-this-must-never-be-returned"

        created = client.put(
            f"/api/v1/companies/{company_id}/ai-connections/job_ads.smart_ad_text",
            headers=_auth(ceo),
            json={
                "mode": "byok",
                "provider_key": "openai-company",
                "adapter": "openai",
                "base_url": "https://api.openai.com/v1",
                "default_model": "gpt-5-mini",
                "auth_scheme": "bearer",
                "secret": secret,
            },
        )
        assert created.status_code == 200, created.text
        body = created.json()
        assert body["mode"] == "byok"
        assert body["secret_configured"] is True
        assert body["secret_hint"].endswith(secret[-4:])
        assert secret not in created.text
        assert "secret_ciphertext" not in body

        listed = client.get(
            f"/api/v1/companies/{company_id}/ai-connections", headers=_auth(ceo)
        )
        assert listed.status_code == 200, listed.text
        assert listed.json()[0]["capability_key"] == "job_ads.smart_ad_text"
        assert secret not in listed.text

        catalog = client.get(
            f"/api/v1/companies/{company_id}/ai-connections/catalog", headers=_auth(ceo)
        )
        assert catalog.status_code == 200, catalog.text
        assert all(
            not item["feature_key"].startswith("smart_headhunting.")
            for item in catalog.json()
        )
        assert secret not in catalog.text

        assert client.get(
            f"/api/v1/companies/{company_id}/ai-connections", headers=_auth(outsider)
        ).status_code == 403
        assert client.put(
            f"/api/v1/companies/{company_id}/ai-connections/job_ads.smart_ad_text",
            headers=_auth(outsider),
            json={"mode": "hring_managed"},
        ).status_code == 403


def test_company_managed_mode_clears_byok_secret_and_headhunting_stays_deferred() -> None:
    with TestClient(app) as client:
        ceo = _register(client, "company-ai-mode")
        company_id = asyncio.run(_seed_company(UUID(ceo["user"]["id"]), name="Mode Company"))
        managed = client.put(
            f"/api/v1/companies/{company_id}/ai-connections/interview.kit",
            headers=_auth(ceo),
            json={"mode": "hring_managed"},
        )
        assert managed.status_code == 200, managed.text
        assert managed.json()["secret_configured"] is False
        assert managed.json()["provider_key"] is None

        deferred = client.put(
            f"/api/v1/companies/{company_id}/ai-connections/smart_headhunting.candidate_analysis",
            headers=_auth(ceo),
            json={"mode": "hring_managed"},
        )
        assert deferred.status_code == 404
