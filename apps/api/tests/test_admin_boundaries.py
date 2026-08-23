import asyncio
from uuid import UUID, uuid4

from fastapi.testclient import TestClient
from sqlalchemy import delete

from hring_api.db.session import SessionFactory
from hring_api.domains.access.models import PlatformRoleAssignment
from hring_api.domains.identity.mfa_security import generate_totp_code
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


async def _keep_only_super_admin(user_id: UUID) -> None:
    async with SessionFactory() as session:
        async with session.begin():
            await session.execute(
                delete(PlatformRoleAssignment).where(
                    PlatformRoleAssignment.role == "super_admin",
                    PlatformRoleAssignment.user_id != user_id,
                )
            )


def _register_with_platform_role(client: TestClient, prefix: str, role: str) -> dict:
    account = _register(client, prefix)
    asyncio.run(_grant_platform_role(UUID(account["user"]["id"]), role))
    enrollment = client.post("/api/v1/auth/mfa/enroll", headers=_auth(account))
    assert enrollment.status_code == 200, enrollment.text
    confirmation = client.post(
        "/api/v1/auth/mfa/confirm",
        headers=_auth(account),
        json={"code": generate_totp_code(enrollment.json()["secret"])},
    )
    assert confirmation.status_code == 200, confirmation.text
    return account


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


def _login(client: TestClient, email: str, password: str = PASSWORD) -> dict:
    response = client.post(
        "/api/v1/auth/login",
        json={"email": email, "password": password},
    )
    assert response.status_code == 200, response.text
    return response.json()


def test_platform_and_product_admin_surfaces_are_separated() -> None:
    with TestClient(app) as client:
        platform_admin = _register_with_platform_role(client, "platform-admin", "platform_admin")
        content_admin = _register_with_platform_role(client, "content-admin", "content_admin")
        super_admin = _register_with_platform_role(client, "super-admin", "super_admin")

        assert client.get(
            "/api/v1/admin/platform/overview", headers=_auth(platform_admin)
        ).status_code == 200
        assert client.get(
            "/api/v1/admin/platform/overview", headers=_auth(content_admin)
        ).status_code == 403
        assert client.get(
            "/api/v1/admin/product/settings", headers=_auth(content_admin)
        ).status_code == 200
        assert client.get(
            "/api/v1/admin/product/settings", headers=_auth(platform_admin)
        ).status_code == 403
        assert client.get(
            "/api/v1/admin/product/settings", headers=_auth(super_admin)
        ).status_code == 200


def test_product_settings_reject_secrets_and_public_endpoint_filters_private_values() -> None:
    with TestClient(app) as client:
        content_admin = _register_with_platform_role(client, "content-settings", "content_admin")
        header = _auth(content_admin)

        secret_attempt = client.put(
            "/api/v1/admin/product/settings/gemini_api_key",
            headers=header,
            json={
                "value": "should-never-be-here",
                "label": "Gemini key",
                "category": "integrations",
                "value_type": "text",
                "is_public": False,
            },
        )
        assert secret_attempt.status_code == 409

        public_setting = client.put(
            "/api/v1/admin/product/settings/hero_title",
            headers=header,
            json={
                "value": "HRing Independent",
                "label": "Hero title",
                "category": "landing",
                "value_type": "text",
                "is_public": True,
            },
        )
        assert public_setting.status_code == 200, public_setting.text

        private_setting = client.put(
            "/api/v1/admin/product/settings/internal_release_note",
            headers=header,
            json={
                "value": "internal only",
                "label": "Internal note",
                "category": "operations",
                "value_type": "text",
                "is_public": False,
            },
        )
        assert private_setting.status_code == 200, private_setting.text

        public = client.get("/api/v1/public/settings")
        assert public.status_code == 200, public.text
        settings = public.json()["settings"]
        assert settings["hero_title"] == "HRing Independent"
        assert "internal_release_note" not in settings
        assert "gemini_api_key" not in settings


def test_product_settings_bulk_update_is_atomic() -> None:
    with TestClient(app) as client:
        content_admin = _register_with_platform_role(client, "content-cms", "content_admin")
        header = _auth(content_admin)

        saved = client.put(
            "/api/v1/admin/product/settings/bulk",
            headers=header,
            json={
                "settings": [
                    {
                        "key": "site_name",
                        "value": "HRing CMS",
                        "label": "Site name",
                        "category": "branding",
                        "value_type": "text",
                        "is_public": True,
                    },
                    {
                        "key": "color_primary",
                        "value": "#2563eb",
                        "label": "Primary color",
                        "category": "theme",
                        "value_type": "text",
                        "is_public": True,
                    },
                ]
            },
        )
        assert saved.status_code == 200, saved.text
        assert {row["key"] for row in saved.json()} == {"site_name", "color_primary"}

        unique_safe_key = f"cms_atomic_{uuid4().hex}"
        rejected = client.put(
            "/api/v1/admin/product/settings/bulk",
            headers=header,
            json={
                "settings": [
                    {
                        "key": unique_safe_key,
                        "value": "must roll back",
                        "label": "Atomic marker",
                        "category": "test",
                        "value_type": "text",
                        "is_public": True,
                    },
                    {
                        "key": "openai_api_key",
                        "value": "never-store-this",
                        "label": "Forbidden secret",
                        "category": "integrations",
                        "value_type": "text",
                        "is_public": False,
                    },
                ]
            },
        )
        assert rejected.status_code == 409, rejected.text

        public = client.get("/api/v1/public/settings")
        assert public.status_code == 200, public.text
        settings = public.json()["settings"]
        assert settings["site_name"] == "HRing CMS"
        assert settings["color_primary"] == "#2563eb"
        assert unique_safe_key not in settings


def test_platform_company_creation_provisions_an_isolated_ceo_account() -> None:
    with TestClient(app) as client:
        platform_admin = _register_with_platform_role(client, "tenant-platform", "platform_admin")
        first = _create_company(client, platform_admin, "alpha")
        second = _create_company(client, platform_admin, "beta")

        alpha_owner = _login(client, first["owner"]["email"])
        alpha_company_id = first["company"]["id"]
        beta_company_id = second["company"]["id"]

        own_company = client.get(
            f"/api/v1/companies/{alpha_company_id}", headers=_auth(alpha_owner)
        )
        assert own_company.status_code == 200, own_company.text
        other_company = client.get(
            f"/api/v1/companies/{beta_company_id}", headers=_auth(alpha_owner)
        )
        assert other_company.status_code == 403

        members = client.get(
            f"/api/v1/companies/{alpha_company_id}/members", headers=_auth(alpha_owner)
        )
        assert members.status_code == 200, members.text
        owner_member = next(
            member for member in members.json() if member["user_id"] == first["owner"]["id"]
        )
        assert owner_member["role"] == "ceo"


def test_company_permission_override_is_tenant_scoped_and_non_ceo_cannot_edit_matrix() -> None:
    with TestClient(app) as client:
        platform_admin = _register_with_platform_role(client, "matrix-platform", "platform_admin")
        first = _create_company(client, platform_admin, "matrix-a")
        second = _create_company(client, platform_admin, "matrix-b")
        company_id = first["company"]["id"]
        ceo = _login(client, first["owner"]["email"])
        ceo_header = _auth(ceo)

        provision_manager = client.post(
            f"/api/v1/companies/{company_id}/users",
            headers=ceo_header,
            json={
                "email": f"manager-{uuid4()}@example.com",
                "password": PASSWORD,
                "full_name": "Tenant Manager",
                "role": "manager",
            },
        )
        assert provision_manager.status_code == 201, provision_manager.text
        manager = _login(client, provision_manager.json()["email"])
        manager_header = _auth(manager)

        initially_forbidden = client.post(
            f"/api/v1/companies/{company_id}/users",
            headers=manager_header,
            json={
                "email": f"before-{uuid4()}@example.com",
                "password": PASSWORD,
                "full_name": "Before Override",
                "role": "employee",
            },
        )
        assert initially_forbidden.status_code == 403

        matrix = client.get(
            f"/api/v1/company-admin/{company_id}/permissions", headers=ceo_header
        )
        assert matrix.status_code == 200, matrix.text
        override = client.put(
            f"/api/v1/company-admin/{company_id}/permissions",
            headers=ceo_header,
            json={
                "role": "manager",
                "permission_key": "company.members.manage",
                "allowed": True,
            },
        )
        assert override.status_code == 200, override.text

        now_allowed = client.post(
            f"/api/v1/companies/{company_id}/users",
            headers=manager_header,
            json={
                "email": f"after-{uuid4()}@example.com",
                "password": PASSWORD,
                "full_name": "After Override",
                "role": "employee",
            },
        )
        assert now_allowed.status_code == 201, now_allowed.text

        manager_cannot_edit_policy = client.put(
            f"/api/v1/company-admin/{company_id}/permissions",
            headers=manager_header,
            json={
                "role": "manager",
                "permission_key": "company.features.manage",
                "allowed": True,
            },
        )
        assert manager_cannot_edit_policy.status_code == 403
        cross_tenant = client.get(
            f"/api/v1/company-admin/{second['company']['id']}/permissions",
            headers=ceo_header,
        )
        assert cross_tenant.status_code == 403


def test_last_super_admin_cannot_remove_own_super_admin_role_and_audit_is_written() -> None:
    with TestClient(app) as client:
        super_admin = _register_with_platform_role(client, "last-super", "super_admin")
        user_id = super_admin["user"]["id"]
        header = _auth(super_admin)
        asyncio.run(_keep_only_super_admin(UUID(user_id)))

        removal = client.put(
            f"/api/v1/admin/platform/users/{user_id}/roles",
            headers=header,
            json={"roles": []},
        )
        assert removal.status_code == 403

        created = _create_company(client, super_admin, "audit-company")
        logs = client.get("/api/v1/admin/platform/audit-logs", headers=header)
        assert logs.status_code == 200, logs.text
        assert any(
            row["action"] == "platform.company.create"
            and row["resource_id"] == created["company"]["id"]
            for row in logs.json()
        )
