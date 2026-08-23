import asyncio
from datetime import UTC, datetime, timedelta
from typing import Any
from uuid import UUID, uuid4

from fastapi.testclient import TestClient
from sqlalchemy import select

from hring_api.db.session import SessionFactory
from hring_api.domains.access.models import PlatformRoleAssignment
from hring_api.domains.identity.account_security_models import (
    LoginAttempt,
    MfaFactor,
    MfaRecoveryCode,
)
from hring_api.domains.identity.mfa_security import generate_totp_code, match_totp_step
from hring_api.domains.identity.models import User
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


def _grant(account: dict[str, Any], role: str) -> None:
    asyncio.run(_grant_platform_role(UUID(account["user"]["id"]), role))


def _enroll(client: TestClient, account: dict[str, Any]) -> tuple[str, list[str]]:
    enrollment = client.post("/api/v1/auth/mfa/enroll", headers=_auth(account))
    assert enrollment.status_code == 200, enrollment.text
    secret = enrollment.json()["secret"]
    confirmation = client.post(
        "/api/v1/auth/mfa/confirm",
        headers=_auth(account),
        json={"code": generate_totp_code(secret)},
    )
    assert confirmation.status_code == 200, confirmation.text
    return secret, confirmation.json()["recovery_codes"]


def _register_privileged(client: TestClient, prefix: str, role: str) -> dict[str, Any]:
    account = _register(client, prefix)
    _grant(account, role)
    _enroll(client, account)
    return account


async def _stored_security_state(email: str) -> tuple[User, MfaFactor | None, list[MfaRecoveryCode]]:
    async with SessionFactory() as session:
        user = (
            await session.execute(select(User).where(User.email == email))
        ).scalar_one()
        factor = (
            await session.execute(select(MfaFactor).where(MfaFactor.user_id == user.id))
        ).scalar_one_or_none()
        codes = list(
            (
                await session.execute(
                    select(MfaRecoveryCode).where(MfaRecoveryCode.user_id == user.id)
                )
            ).scalars()
        )
        return user, factor, codes


async def _login_outcomes(email: str) -> list[str]:
    async with SessionFactory() as session:
        user_id = (
            await session.execute(select(User.id).where(User.email == email))
        ).scalar_one()
        result = await session.execute(
            select(LoginAttempt.outcome)
            .where(LoginAttempt.user_id == user_id)
            .order_by(LoginAttempt.created_at)
        )
        return list(result.scalars())


def test_totp_uses_rfc6238_counter_and_replay_floor() -> None:
    secret = "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ"
    at = datetime.fromtimestamp(59, tz=UTC)
    assert generate_totp_code(secret, at=at) == "287082"
    step = match_totp_step(secret, "287082", at=at)
    assert step is not None
    assert match_totp_step(secret, "287082", at=at, after_step=step) is None


def test_privileged_session_requires_mfa_and_never_repeats_secret() -> None:
    with TestClient(app) as client:
        account = _register(client, "mfa-privileged")
        _grant(account, "platform_admin")

        blocked = client.get("/api/v1/admin/platform/overview", headers=_auth(account))
        assert blocked.status_code == 403
        assert blocked.json()["detail"] == {
            "code": "mfa_required",
            "enrollment_required": True,
        }

        status_response = client.get("/api/v1/auth/mfa/status", headers=_auth(account))
        assert status_response.status_code == 200, status_response.text
        assert status_response.json()["enrollment_required"] is True

        secret, recovery_codes = _enroll(client, account)
        assert len(recovery_codes) == 10
        assert len(set(recovery_codes)) == len(recovery_codes)
        assert client.get(
            "/api/v1/admin/platform/overview", headers=_auth(account)
        ).status_code == 200

        status_after = client.get("/api/v1/auth/mfa/status", headers=_auth(account))
        assert status_after.status_code == 200
        assert "secret" not in status_after.json()
        assert "otpauth_uri" not in status_after.json()

        user, factor, stored_codes = asyncio.run(_stored_security_state(account["user"]["email"]))
        assert factor is not None and factor.status == "enabled"
        assert secret not in factor.secret_ciphertext
        assert all(raw.replace("-", "") not in row.code_hash for raw, row in zip(recovery_codes, stored_codes))
        assert user.failed_login_attempts == 0

        next_login = client.post(
            "/api/v1/auth/login",
            json={"email": account["user"]["email"], "password": PASSWORD},
        )
        assert next_login.status_code == 200, next_login.text
        challenged = next_login.json()
        assert challenged["mfa_required"] is True
        assert challenged["mfa_enrollment_required"] is False
        assert challenged["mfa_verified"] is False
        assert client.get(
            "/api/v1/auth/context", headers=_auth(challenged)
        ).status_code == 403

        future_code = generate_totp_code(secret, at=datetime.now(UTC) + timedelta(seconds=30))
        verified = client.post(
            "/api/v1/auth/mfa/verify",
            headers=_auth(challenged),
            json={"code": future_code},
        )
        assert verified.status_code == 200, verified.text
        assert verified.json()["verified"] is True

        replay_login = client.post(
            "/api/v1/auth/login",
            json={"email": account["user"]["email"], "password": PASSWORD},
        ).json()
        replay = client.post(
            "/api/v1/auth/mfa/verify",
            headers=_auth(replay_login),
            json={"code": future_code},
        )
        assert replay.status_code == 401


def test_recovery_code_is_one_time_and_normal_user_can_disable_mfa() -> None:
    with TestClient(app) as client:
        account = _register(client, "mfa-recovery")
        _secret, recovery_codes = _enroll(client, account)

        login = client.post(
            "/api/v1/auth/login",
            json={"email": account["user"]["email"], "password": PASSWORD},
        ).json()
        recovered = client.post(
            "/api/v1/auth/mfa/verify",
            headers=_auth(login),
            json={"code": recovery_codes[0]},
        )
        assert recovered.status_code == 200, recovered.text
        assert recovered.json()["recovery_codes_remaining"] == len(recovery_codes) - 1

        next_login = client.post(
            "/api/v1/auth/login",
            json={"email": account["user"]["email"], "password": PASSWORD},
        ).json()
        reused = client.post(
            "/api/v1/auth/mfa/verify",
            headers=_auth(next_login),
            json={"code": recovery_codes[0]},
        )
        assert reused.status_code == 401
        fresh = client.post(
            "/api/v1/auth/mfa/verify",
            headers=_auth(next_login),
            json={"code": recovery_codes[1]},
        )
        assert fresh.status_code == 200, fresh.text

        disabled = client.request(
            "DELETE",
            "/api/v1/auth/mfa",
            headers=_auth(next_login),
            json={"current_password": PASSWORD},
        )
        assert disabled.status_code == 204, disabled.text
        no_challenge = client.post(
            "/api/v1/auth/login",
            json={"email": account["user"]["email"], "password": PASSWORD},
        )
        assert no_challenge.status_code == 200
        assert no_challenge.json()["mfa_required"] is False


def test_account_lockout_is_persistent_non_enumerating_and_super_admin_unlocks() -> None:
    with TestClient(app) as client:
        target = _register(client, "lockout-target")
        unknown_email = f"missing-{uuid4()}@example.com"
        unknown = client.post(
            "/api/v1/auth/login",
            json={"email": unknown_email, "password": "wrong"},
        )
        wrong = client.post(
            "/api/v1/auth/login",
            json={"email": target["user"]["email"], "password": "wrong"},
        )
        assert unknown.status_code == wrong.status_code == 401
        assert unknown.json() == wrong.json()

        for _ in range(4):
            response = client.post(
                "/api/v1/auth/login",
                json={"email": target["user"]["email"], "password": "wrong"},
            )
            assert response.status_code == 401

        locked_login = client.post(
            "/api/v1/auth/login",
            json={"email": target["user"]["email"], "password": PASSWORD},
        )
        assert locked_login.status_code == 401
        user, _factor, _codes = asyncio.run(_stored_security_state(target["user"]["email"]))
        assert user.failed_login_attempts == 5
        assert user.locked_until is not None and user.locked_until > datetime.now(UTC)
        assert (awaited_outcomes := asyncio.run(_login_outcomes(target["user"]["email"]))).count(
            "locked"
        ) >= 2
        assert awaited_outcomes[0] == "invalid_credentials"

        platform_admin = _register_privileged(
            client, "lockout-platform", "platform_admin"
        )
        forbidden = client.post(
            f"/api/v1/admin/platform/users/{target['user']['id']}/unlock",
            headers=_auth(platform_admin),
        )
        assert forbidden.status_code == 403

        super_admin = _register_privileged(client, "lockout-super", "super_admin")
        unlocked = client.post(
            f"/api/v1/admin/platform/users/{target['user']['id']}/unlock",
            headers=_auth(super_admin),
        )
        assert unlocked.status_code == 204, unlocked.text
        login_after_unlock = client.post(
            "/api/v1/auth/login",
            json={"email": target["user"]["email"], "password": PASSWORD},
        )
        assert login_after_unlock.status_code == 200, login_after_unlock.text


def test_privileged_mfa_cannot_be_disabled_and_super_admin_reset_revokes_sessions() -> None:
    with TestClient(app) as client:
        target = _register(client, "mfa-reset-target")
        _grant(target, "content_admin")
        _enroll(client, target)

        forbidden_disable = client.request(
            "DELETE",
            "/api/v1/auth/mfa",
            headers=_auth(target),
            json={"current_password": PASSWORD},
        )
        assert forbidden_disable.status_code == 409

        super_admin = _register_privileged(client, "mfa-reset-super", "super_admin")
        reset = client.delete(
            f"/api/v1/admin/platform/users/{target['user']['id']}/mfa",
            headers=_auth(super_admin),
        )
        assert reset.status_code == 204, reset.text
        assert client.get("/api/v1/auth/me", headers=_auth(target)).status_code == 401

        next_login = client.post(
            "/api/v1/auth/login",
            json={"email": target["user"]["email"], "password": PASSWORD},
        )
        assert next_login.status_code == 200, next_login.text
        assert next_login.json()["mfa_required"] is True
        assert next_login.json()["mfa_enrollment_required"] is True
