import asyncio
from uuid import UUID, uuid4

from fastapi.testclient import TestClient

from hring_api.db.session import SessionFactory
from hring_api.domains.access.models import PlatformRoleAssignment
from hring_api.domains.ai.gateway_client import AiGatewayResult
from hring_api.domains.headhunting.schemas import AnalyzeCandidatesRequest, CandidateInput, JobRequirements
from hring_api.domains.headhunting.service import analyze_candidates
from hring_api.domains.identity.dependencies import Principal
from hring_api.domains.identity.models import User
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


async def _grant_platform_admin(user_id: UUID) -> None:
    async with SessionFactory() as session:
        async with session.begin():
            session.add(
                PlatformRoleAssignment(
                    user_id=user_id,
                    role="platform_admin",
                    created_by=user_id,
                )
            )


def _create_company(client: TestClient, actor: dict, prefix: str) -> dict:
    response = client.post(
        "/api/v1/admin/platform/companies",
        headers=_auth(actor),
        json={
            "name": f"{prefix} Company",
            "domain": f"{prefix}-{uuid4().hex[:8]}.example.com",
            "status": "active",
            "subscription_tier": "corporate_expert",
            "monthly_credits": 250,
            "max_members": 20,
            "owner": {
                "email": f"owner-{prefix}-{uuid4()}@example.com",
                "password": PASSWORD,
                "full_name": f"{prefix} Owner",
            },
        },
    )
    assert response.status_code == 201, response.text
    return response.json()


def _login(client: TestClient, email: str) -> dict:
    response = client.post("/api/v1/auth/login", json={"email": email, "password": PASSWORD})
    assert response.status_code == 200, response.text
    return response.json()


def test_headhunting_campaign_and_candidates_are_isolated_between_tenants() -> None:
    with TestClient(app) as client:
        platform = _register(client, "headhunting-platform")
        asyncio.run(_grant_platform_admin(UUID(platform["user"]["id"])))
        first = _create_company(client, platform, "headhunt-a")
        second = _create_company(client, platform, "headhunt-b")
        first_owner = _login(client, first["owner"]["email"])
        second_owner = _login(client, second["owner"]["email"])

        create = client.post(
            "/api/v1/headhunting/campaigns",
            headers=_auth(first_owner),
            json={
                "name": "Senior Python",
                "city": "Tehran",
                "job_title": "Senior Python Developer",
                "skills": ["Python", "FastAPI"],
                "company_id": first["company"]["id"],
            },
        )
        assert create.status_code == 201, create.text
        campaign_id = create.json()["id"]
        assert create.json()["company_id"] == first["company"]["id"]

        add = client.post(
            f"/api/v1/headhunting/campaigns/{campaign_id}/candidates",
            headers=_auth(first_owner),
            json={
                "candidates": [
                    {
                        "name": "Candidate One",
                        "email": "candidate@example.com",
                        "skills": "Python, FastAPI",
                        "match_score": 91,
                        "candidate_temperature": "hot",
                    }
                ]
            },
        )
        assert add.status_code == 201, add.text

        detail = client.get(
            f"/api/v1/headhunting/campaigns/{campaign_id}", headers=_auth(first_owner)
        )
        assert detail.status_code == 200, detail.text
        assert detail.json()["campaign"]["candidates_count"] == 1
        assert detail.json()["campaign"]["avg_match_score"] == 91
        assert detail.json()["candidates"][0]["email"] == "candidate@example.com"

        forbidden_detail = client.get(
            f"/api/v1/headhunting/campaigns/{campaign_id}", headers=_auth(second_owner)
        )
        assert forbidden_detail.status_code == 404
        forbidden_delete = client.delete(
            f"/api/v1/headhunting/campaigns/{campaign_id}", headers=_auth(second_owner)
        )
        assert forbidden_delete.status_code == 404

        wrong_scope = client.post(
            "/api/v1/headhunting/campaigns",
            headers=_auth(first_owner),
            json={
                "name": "Wrong Tenant",
                "city": "Tehran",
                "company_id": second["company"]["id"],
            },
        )
        assert wrong_scope.status_code == 403


def test_ai_analysis_preserves_source_identity(monkeypatch) -> None:
    async def fake_generate(**kwargs) -> AiGatewayResult:
        return AiGatewayResult(
            request_id=uuid4(),
            content=(
                '[{"sourceIndex":0,"matchScore":88,"candidateTemperature":"warm",'
                '"layerScores":{"hardSkillMatch":90},"greenFlags":["Python"],'
                '"redFlags":[],"summary":"fit","recommendation":"تماس"}]'
            ),
            provider="fake",
            model="fake-model",
            usage={"input_tokens": 10, "output_tokens": 5},
            provider_cost_microusd=1,
        )

    monkeypatch.setattr(
        "hring_api.domains.headhunting.service.generate_with_ai_gateway",
        fake_generate,
    )
    user_id = uuid4()
    principal = Principal(
        user=User(id=user_id, email=f"analysis-{uuid4()}@example.com", is_active=True),
        session_id=uuid4(),
        app_roles=[],
        memberships=[],
    )
    result = asyncio.run(
        analyze_candidates(
            principal=principal,
            payload=AnalyzeCandidatesRequest(
                candidates=[
                    CandidateInput(
                        name="Original Name",
                        email="original@example.com",
                        phone="09120000000",
                        skills="Python",
                    )
                ],
                job_requirements=JobRequirements(job_title="Python Developer", city="Tehran"),
                enable_web_search=False,
            ),
            company_id=None,
        )
    )
    candidate = result.candidates[0]
    assert candidate.name == "Original Name"
    assert candidate.email == "original@example.com"
    assert candidate.phone == "09120000000"
    assert candidate.match_score == 88
    assert candidate.candidate_temperature == "warm"
