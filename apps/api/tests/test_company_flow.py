import asyncio
from uuid import UUID, uuid4

from fastapi.testclient import TestClient
from sqlalchemy import select

from hring_api.db.session import SessionFactory
from hring_api.domains.identity.models import Company, CompanyInvite, CompanyMember, Profile
from hring_api.main import app


PASSWORD = "correct horse battery staple"
RESET_PASSWORD = "new corporate password value"


def _register(client: TestClient, prefix: str) -> dict:
    email = f"{prefix}-{uuid4()}@example.com"
    response = client.post(
        "/api/v1/auth/register",
        json={"email": email, "password": PASSWORD, "full_name": prefix.title()},
    )
    assert response.status_code == 201, response.text
    return response.json()


def _auth(access_token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {access_token}"}


async def _seed_company(
    *,
    ceo_user_id: UUID,
    max_members: int = 10,
    status: str = "active",
) -> UUID:
    async with SessionFactory() as session:
        async with session.begin():
            company = Company(
                name=f"Company {uuid4().hex[:8]}",
                status=status,
                subscription_tier="corporate_expert",
                monthly_credits=100,
                used_credits=0,
                max_members=max_members,
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
            await session.flush()
            return company.id


async def _read_invite(invite_id: UUID) -> CompanyInvite:
    async with SessionFactory() as session:
        invite = await session.get(CompanyInvite, invite_id)
        assert invite is not None
        return invite


async def _read_profile(user_id: UUID) -> Profile:
    async with SessionFactory() as session:
        profile = await session.get(Profile, user_id)
        assert profile is not None
        return profile


async def _set_company_status(company_id: UUID, status: str) -> None:
    async with SessionFactory() as session:
        async with session.begin():
            company = await session.get(Company, company_id)
            assert company is not None
            company.status = status


async def _active_member_count(company_id: UUID) -> int:
    async with SessionFactory() as session:
        result = await session.execute(
            select(CompanyMember).where(
                CompanyMember.company_id == company_id,
                CompanyMember.is_active.is_(True),
            )
        )
        return len(list(result.scalars().all()))


def test_invite_join_is_transactional_and_idempotent() -> None:
    with TestClient(app) as client:
        ceo = _register(client, "ceo")
        candidate = _register(client, "candidate")
        ceo_id = UUID(ceo["user"]["id"])
        candidate_id = UUID(candidate["user"]["id"])
        company_id = asyncio.run(_seed_company(ceo_user_id=ceo_id, max_members=4))

        create_invite = client.post(
            f"/api/v1/companies/{company_id}/invites",
            json={"role": "employee", "max_uses": 2, "expires_in_days": 7},
            headers=_auth(ceo["tokens"]["access_token"]),
        )
        assert create_invite.status_code == 201, create_invite.text
        invite = create_invite.json()

        validated = client.post(
            "/api/v1/company-invites/validate",
            json={"invite_code": invite["invite_code"]},
        )
        assert validated.status_code == 200, validated.text
        assert validated.json()["is_valid"] is True
        assert validated.json()["company_id"] == str(company_id)

        joined = client.post(
            f"/api/v1/company-invites/{invite['invite_code']}/join",
            headers=_auth(candidate["tokens"]["access_token"]),
        )
        assert joined.status_code == 200, joined.text
        assert joined.json()["already_member"] is False
        assert joined.json()["role"] == "employee"

        joined_again = client.post(
            f"/api/v1/company-invites/{invite['invite_code']}/join",
            headers=_auth(candidate["tokens"]["access_token"]),
        )
        assert joined_again.status_code == 200, joined_again.text
        assert joined_again.json()["already_member"] is True

        stored_invite = asyncio.run(_read_invite(UUID(invite["id"])))
        assert stored_invite.used_count == 1
        assert stored_invite.is_active is True
        assert asyncio.run(_active_member_count(company_id)) == 2

        profile = asyncio.run(_read_profile(candidate_id))
        assert profile.user_type == "corporate"


def test_capacity_is_enforced_after_invite_creation() -> None:
    with TestClient(app) as client:
        ceo = _register(client, "capacity-ceo")
        candidate = _register(client, "capacity-candidate")
        ceo_id = UUID(ceo["user"]["id"])
        company_id = asyncio.run(_seed_company(ceo_user_id=ceo_id, max_members=2))
        ceo_header = _auth(ceo["tokens"]["access_token"])

        invite_response = client.post(
            f"/api/v1/companies/{company_id}/invites",
            json={"role": "employee", "max_uses": 5, "expires_in_days": 7},
            headers=ceo_header,
        )
        assert invite_response.status_code == 201, invite_response.text
        invite_code = invite_response.json()["invite_code"]

        provision = client.post(
            f"/api/v1/companies/{company_id}/users",
            json={
                "email": f"provisioned-{uuid4()}@example.com",
                "password": PASSWORD,
                "full_name": "Provisioned User",
                "role": "employee",
            },
            headers=ceo_header,
        )
        assert provision.status_code == 201, provision.text
        assert asyncio.run(_active_member_count(company_id)) == 2

        join = client.post(
            f"/api/v1/company-invites/{invite_code}/join",
            headers=_auth(candidate["tokens"]["access_token"]),
        )
        assert join.status_code == 409, join.text
        assert asyncio.run(_active_member_count(company_id)) == 2


def test_non_ceo_cannot_manage_users_but_explicit_invite_permission_works() -> None:
    with TestClient(app) as client:
        ceo = _register(client, "permission-ceo")
        ceo_id = UUID(ceo["user"]["id"])
        company_id = asyncio.run(_seed_company(ceo_user_id=ceo_id, max_members=5))
        ceo_header = _auth(ceo["tokens"]["access_token"])

        provision = client.post(
            f"/api/v1/companies/{company_id}/users",
            json={
                "email": f"employee-{uuid4()}@example.com",
                "password": PASSWORD,
                "full_name": "Employee",
                "role": "employee",
            },
            headers=ceo_header,
        )
        assert provision.status_code == 201, provision.text
        employee_email = provision.json()["email"]
        employee_id = provision.json()["id"]
        employee_login = client.post(
            "/api/v1/auth/login",
            json={"email": employee_email, "password": PASSWORD},
        )
        assert employee_login.status_code == 200, employee_login.text
        employee_header = _auth(employee_login.json()["tokens"]["access_token"])

        forbidden = client.post(
            f"/api/v1/companies/{company_id}/users",
            json={
                "email": f"forbidden-{uuid4()}@example.com",
                "password": PASSWORD,
                "full_name": "Forbidden",
                "role": "employee",
            },
            headers=employee_header,
        )
        assert forbidden.status_code == 403

        members = client.get(
            f"/api/v1/companies/{company_id}/members",
            headers=ceo_header,
        )
        assert members.status_code == 200, members.text
        employee_member = next(item for item in members.json() if item["user_id"] == employee_id)

        before_permission = client.post(
            f"/api/v1/companies/{company_id}/invites",
            json={"role": "employee", "max_uses": 1, "expires_in_days": 7},
            headers=employee_header,
        )
        assert before_permission.status_code == 403

        permission = client.patch(
            f"/api/v1/companies/{company_id}/members/{employee_member['id']}/invite-permission",
            json={"can_invite": True},
            headers=ceo_header,
        )
        assert permission.status_code == 200, permission.text

        after_permission = client.post(
            f"/api/v1/companies/{company_id}/invites",
            json={"role": "employee", "max_uses": 1, "expires_in_days": 7},
            headers=employee_header,
        )
        assert after_permission.status_code == 201, after_permission.text


def test_ceo_password_reset_revokes_target_sessions_and_ceo_is_protected() -> None:
    with TestClient(app) as client:
        ceo = _register(client, "reset-ceo")
        ceo_id = UUID(ceo["user"]["id"])
        company_id = asyncio.run(_seed_company(ceo_user_id=ceo_id, max_members=5))
        ceo_header = _auth(ceo["tokens"]["access_token"])

        provision = client.post(
            f"/api/v1/companies/{company_id}/users",
            json={
                "email": f"reset-target-{uuid4()}@example.com",
                "password": PASSWORD,
                "full_name": "Reset Target",
                "role": "employee",
            },
            headers=ceo_header,
        )
        assert provision.status_code == 201, provision.text
        target = provision.json()

        target_login = client.post(
            "/api/v1/auth/login",
            json={"email": target["email"], "password": PASSWORD},
        )
        assert target_login.status_code == 200, target_login.text
        target_access = target_login.json()["tokens"]["access_token"]

        reset = client.post(
            f"/api/v1/companies/{company_id}/users/{target['id']}/reset-password",
            json={"new_password": RESET_PASSWORD},
            headers=ceo_header,
        )
        assert reset.status_code == 204, reset.text

        revoked = client.get(
            "/api/v1/auth/me",
            headers=_auth(target_access),
        )
        assert revoked.status_code == 401

        old_login = client.post(
            "/api/v1/auth/login",
            json={"email": target["email"], "password": PASSWORD},
        )
        assert old_login.status_code == 401
        new_login = client.post(
            "/api/v1/auth/login",
            json={"email": target["email"], "password": RESET_PASSWORD},
        )
        assert new_login.status_code == 200, new_login.text

        reset_ceo = client.post(
            f"/api/v1/companies/{company_id}/users/{ceo_id}/reset-password",
            json={"new_password": RESET_PASSWORD},
            headers=ceo_header,
        )
        assert reset_ceo.status_code == 403


def test_suspended_company_rejects_invite_use() -> None:
    with TestClient(app) as client:
        ceo = _register(client, "suspended-ceo")
        candidate = _register(client, "suspended-candidate")
        ceo_id = UUID(ceo["user"]["id"])
        company_id = asyncio.run(_seed_company(ceo_user_id=ceo_id, max_members=3))

        invite_response = client.post(
            f"/api/v1/companies/{company_id}/invites",
            json={"role": "employee", "max_uses": 1, "expires_in_days": 7},
            headers=_auth(ceo["tokens"]["access_token"]),
        )
        assert invite_response.status_code == 201, invite_response.text
        invite_code = invite_response.json()["invite_code"]
        asyncio.run(_set_company_status(company_id, "suspended"))

        validate = client.post(
            "/api/v1/company-invites/validate",
            json={"invite_code": invite_code},
        )
        assert validate.status_code == 200
        assert validate.json()["is_valid"] is False

        join = client.post(
            f"/api/v1/company-invites/{invite_code}/join",
            headers=_auth(candidate["tokens"]["access_token"]),
        )
        assert join.status_code == 409
